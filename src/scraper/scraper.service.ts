import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseCSV, scrapeForCSVLink } from 'src/utils/csvParser';
import { OrganizationRecord } from './interfaces/organization.interface';
import * as crypto from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChangeType } from '@prisma/client';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly batchSize = 10000;

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Cron expression for every 2 days at midnight
  async handleCron() {
    this.logger.debug('Running scheduled CSV download and processing');
    await this.downloadAndProcessCSV();
  }

  // async onModuleInit() {
  //   this.logger.debug(
  //     'Module initialization: Starting CSV download and processing',
  //   );
  //   await this.downloadAndProcessCSV();
  // }

  async downloadAndProcessCSV() {
    this.logger.debug('Starting downloadAndProcessCSV');
    const csvUrl = await scrapeForCSVLink();
    const response = await axios({
      method: 'GET',
      url: csvUrl,
      responseType: 'stream',
    });

    const records = await parseCSV(response.data);
    this.logger.debug(`Parsed ${records.length} records from CSV`);
    await this.processRecords(records);
  }

  async processRecords(records: OrganizationRecord[]) {
    this.logger.log(`Processing ${records.length} records...`);

    const existingRecords = await this.prisma.organization.findMany();
    const existingMap = new Map(existingRecords.map((rec) => [rec.name, rec]));

    const newRecords = new Set(records.map((rec) => rec.name));

    // Track changes
    const added = [];
    const updated = [];
    const removed = [];

    // Detect added and updated records
    for (const record of records) {
      const normalizedData = this.normalizeRecord(record);
      const dataHash = this.generateHash(normalizedData);
      const existingRecord = existingMap.get(normalizedData.name);

      if (!existingRecord) {
        added.push({ newData: normalizedData });
      } else if (existingRecord.dataHash !== dataHash) {
        updated.push({ oldData: existingRecord, newData: normalizedData });
      }
    }

    // Detect removed records
    for (const [name, existingRecord] of existingMap.entries()) {
      if (!newRecords.has(name)) {
        removed.push({ oldData: existingRecord });
      }
    }

    // Process changes
    await this.storeChanges(added, updated, removed);
    await this.updateMainTable(added, updated, removed);

    this.logger.log(
      `Processed ${added.length} added, ${updated.length} updated, and ${removed.length} removed records.`,
    );
  }

  async storeChanges(added, updated, removed) {
    const changeRecords = [];

    for (const add of added) {
      const organization = await this.prisma.organization.findUnique({
        where: { name: add.newData.name },
      });

      changeRecords.push({
        type: ChangeType.ADDED,
        newData: add.newData,
        organizationId: organization?.id,
      });
    }

    for (const update of updated) {
      const organization = await this.prisma.organization.findUnique({
        where: { name: update.newData.name },
      });

      changeRecords.push({
        type: ChangeType.UPDATED,
        oldData: update.oldData,
        newData: update.newData,
        organizationId: organization?.id,
      });
    }

    for (const remove of removed) {
      const organization = await this.prisma.organization.findUnique({
        where: { name: remove.oldData.name },
      });

      changeRecords.push({
        type: ChangeType.REMOVED,
        oldData: remove.oldData,
        organizationId: organization?.id,
      });
    }

    await this.prisma.organizationChange.createMany({ data: changeRecords });
  }

  async updateMainTable(added, updated, removed) {
    const upserts = added.concat(updated).map((change) => {
      const data = change.newData;
      data.dataHash = this.generateHash(data);

      return this.prisma.organization.upsert({
        where: { name: data.name },
        update: data,
        create: data,
      });
    });

    await this.prisma.$transaction(upserts);

    const deletions = removed.map((change) =>
      this.prisma.organization.delete({
        where: { name: change.oldData.name },
      }),
    );

    await this.prisma.$transaction(deletions);
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

  private generateHash(record: any): string {
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
