import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseCSV, scrapeForCSVLink } from 'src/utils/csvParser';
import { OrganizationRecord } from './interfaces/organization.interface';
import * as crypto from 'crypto';
import axios from 'axios';
import { Prisma } from '@prisma/client';

@Injectable()
export class ScraperService implements OnModuleInit {
  private readonly logger = new Logger(ScraperService.name);
  private readonly batchSize = 1000;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.debug(
      'Module initialization: Starting CSV download and processing',
    );
    const startTime = Date.now();
    await this.downloadAndProcessCSV();
    const endTime = Date.now();
    this.logExecutionTime(startTime, endTime);
  }

  async downloadAndProcessCSV() {
    try {
      const href = await scrapeForCSVLink();
      this.logger.debug(`Scraped CSV link: ${href}`);

      const response = await axios.get(href, { responseType: 'stream' });
      const records = await parseCSV(response.data);
      this.logger.debug(`Parsed ${records.length} records from CSV`);

      await this.processRecords(records);
      await this.logFinalRecordCount();
    } catch (error) {
      this.logger.error('Failed to download or process CSV:', error);
    }
  }

  async processRecords(records: OrganizationRecord[]) {
    this.logger.log(`Processing ${records.length} records...`);

    const existingRecords = await this.getExistingRecords();
    const existingMap = new Map(existingRecords.map((rec) => [rec.name, rec]));

    const batches = this.createBatches(records, this.batchSize);
    let totalInserted = 0;
    let totalSkipped = 0;

    for (const batch of batches) {
      await Promise.all(
        batch.map((record) =>
          this.processSingleRecord(record, existingMap).then((inserted) =>
            inserted ? totalInserted++ : totalSkipped++,
          ),
        ),
      );
      this.logger.log(`Processed batch of ${batch.length} records...`);
    }

    await this.handleRemovedRecords(
      existingMap,
      new Set(records.map((rec) => rec.name)),
    );
    this.logger.log(`Inserted: ${totalInserted}, Skipped: ${totalSkipped}`);
  }

  private async getExistingRecords() {
    return this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        townCity: true,
        county: true,
        typeRating: true,
        route: true,
        dataHash: true,
      },
    });
  }

  private async processSingleRecord(
    record: OrganizationRecord,
    existingMap: Map<string, any>,
  ) {
    const normalizedData = this.normalizeRecord(record);
    const dataHash = this.generateHash(normalizedData);
    const existingRecord = existingMap.get(normalizedData.name);

    if (existingRecord && existingRecord.dataHash === dataHash) {
      return false; // Skip if no changes
    }

    try {
      if (existingRecord) {
        await this.updateRecord(existingRecord, normalizedData, dataHash);
      } else {
        await this.createOrUpdateRecord(normalizedData, dataHash);
      }
      return true;
    } catch (error) {
      this.logger.error(
        `Error processing record "${normalizedData.name}": ${error.message}`,
      );
      return false;
    }
  }

  private async updateRecord(
    existingRecord: any,
    normalizedData: OrganizationRecord,
    dataHash: string,
  ) {
    await this.prisma.organization.update({
      where: { id: existingRecord.id },
      data: { ...normalizedData, dataHash },
    });

    await this.prisma.organizationChange.create({
      data: {
        type: 'UPDATED',
        oldData: existingRecord as unknown as Prisma.InputJsonValue,
        newData: normalizedData as unknown as Prisma.InputJsonValue,
        organizationId: existingRecord.id,
      },
    });
  }

  private async createOrUpdateRecord(
    normalizedData: OrganizationRecord,
    dataHash: string,
  ) {
    const createdRecord = await this.prisma.organization.upsert({
      where: { name: normalizedData.name },
      create: { ...normalizedData, dataHash },
      update: { ...normalizedData, dataHash },
    });

    await this.prisma.organizationChange.create({
      data: {
        type: 'ADDED',
        newData: normalizedData as unknown as Prisma.InputJsonValue,
        organizationId: createdRecord.id,
      },
    });
  }

  private async handleRemovedRecords(
    existingMap: Map<string, any>,
    newNames: Set<string>,
  ) {
    const removedNames = [...existingMap.keys()].filter(
      (name) => !newNames.has(name),
    );
    await Promise.all(
      removedNames.map(async (name) => {
        const existingRecord = existingMap.get(name);
        if (existingRecord) {
          await this.prisma.organizationChange.create({
            data: {
              type: 'REMOVED',
              oldData: existingRecord,
              organizationId: existingRecord.id,
            },
          });
          await this.prisma.organization.delete({
            where: { id: existingRecord.id },
          });
          this.logger.log(`Removed organization: ${name}`);
        }
      }),
    );
  }

  private createBatches(
    records: OrganizationRecord[],
    batchSize: number,
  ): OrganizationRecord[][] {
    const batches = [];
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }
    return batches;
  }

  private generateHash(record: OrganizationRecord): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(record))
      .digest('hex');
  }

  private normalizeRecord(record: OrganizationRecord): OrganizationRecord {
    return {
      name: String(record['name']).trim(),
      townCity:
        typeof record['townCity'] === 'string' ? record['townCity'].trim() : '',
      county:
        typeof record['county'] === 'string' ? record['county'].trim() : '',
      typeRating:
        typeof record['typeRating'] === 'string'
          ? record['typeRating'].trim()
          : '',
      route: typeof record['route'] === 'string' ? record['route'].trim() : '',
    };
  }

  private async logFinalRecordCount() {
    const count = await this.prisma.organization.count();
    this.logger.log(`Total records in the organization table: ${count}`);
  }

  private logExecutionTime(startTime: number, endTime: number) {
    const durationMs = endTime - startTime;
    const durationSec = (durationMs / 1000).toFixed(2);
    this.logger.log(
      `Execution time: ${durationMs} ms (${durationSec} seconds)`,
    );
  }
}
