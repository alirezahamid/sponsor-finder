import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseCSV } from 'src/utils/csvParser';
import { OrganizationRecord } from './interfaces/organization.interface';
import * as crypto from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import { Prisma } from '@prisma/client';

@Injectable()
export class ScraperService implements OnModuleInit {
  private readonly logger = new Logger(ScraperService.name);
  private readonly batchSize = 10000;

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    this.logger.debug('Running scheduled CSV download and processing');
    await this.downloadAndProcessCSV();
  }

  async onModuleInit() {
    this.logger.debug(
      'Module initialization: Starting CSV download and processing',
    );
    await this.downloadAndProcessCSV();
  }

  async downloadAndProcessCSV() {
    this.logger.debug('Starting downloadAndProcessCSV');
    const csvFilePath = './tmp/organizations.csv';
    const inputStream = fs.createReadStream(csvFilePath);
    const records = await parseCSV(inputStream);
    this.logger.debug(`Parsed ${records.length} records from CSV`);
    await this.processRecords(records);
  }

  async processRecords(records: OrganizationRecord[]) {
    this.logger.log(`Processing ${records.length} records...`);

    const existingRecords = await this.prisma.organization.findMany({
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
    const existingMap = new Map(
      existingRecords.map((rec) => [
        rec.name,
        {
          id: rec.id,
          name: rec.name,
          townCity: rec.townCity,
          county: rec.county,
          typeRating: rec.typeRating,
          route: rec.route,
          dataHash: rec.dataHash,
        },
      ]),
    );

    const existingNames = new Set(existingRecords.map((rec) => rec.name));
    const newNames = new Set(records.map((rec) => rec.name));

    const removedNames = [...existingNames].filter(
      (name) => !newNames.has(name),
    );

    const batches = this.createBatches(records, this.batchSize);
    for (const batch of batches) {
      const upserts = batch
        .map((record) => {
          const normalizedData = this.normalizeRecord(record);
          const dataHash = this.generateHash(normalizedData);

          const existingRecord = existingMap.get(normalizedData.name);

          if (existingRecord) {
            if (existingRecord.dataHash === dataHash) {
              return null; // Skip if no changes
            }

            // Update existing record
            return this.prisma.organization
              .update({
                where: { id: existingRecord.id },
                data: { ...normalizedData, dataHash },
              })
              .then(() =>
                this.prisma.organizationChange.create({
                  data: {
                    type: 'UPDATED',
                    oldData: existingRecord,
                    newData: normalizedData as unknown as Prisma.InputJsonValue,
                    organizationId: existingRecord.id,
                  },
                }),
              );
          }

          // Create new record
          return this.prisma.organization
            .create({
              data: { ...normalizedData, dataHash },
            })
            .then((createdRecord) =>
              this.prisma.organizationChange.create({
                data: {
                  type: 'ADDED',
                  newData: normalizedData as unknown as Prisma.InputJsonValue,
                  organizationId: createdRecord.id,
                },
              }),
            );
        })
        .filter(Boolean);

      await Promise.all(upserts);
      this.logger.log(`Processed batch of ${upserts.length} records...`);
    }

    // Handle removed records
    for (const name of removedNames) {
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
    }

    this.logger.log(`Processed ${records.length} records into the database.`);
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
}

// private normalizeRecord(record: OrganizationRecord): OrganizationRecord {
//   return {
//     name: String(record['name']).trim(),
//     townCity:
//       typeof record['townCity'] === 'string' ? record['townCity'].trim() : '',
//     county:
//       typeof record['county'] === 'string' ? record['county'].trim() : '',
//     typeRating:
//       typeof record['typeRating'] === 'string'
//         ? record['typeRating'].trim()
//         : '',
//     route: typeof record['route'] === 'string' ? record['route'].trim() : '',
//   };
// }
