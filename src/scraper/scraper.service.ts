import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseCSV, scrapeForCSVLink } from 'src/utils/csvParser';
import { OrganizationRecord } from './interfaces/organization.interface';
import * as crypto from 'crypto';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly batchSize = 10000;

  constructor(private prisma: PrismaService) {}

  @Cron('0 0 */2 * *') // Cron expression for every 2 days at midnight
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

    const records = await parseCSV(response);
    this.logger.debug(`Parsed ${records.length} records from CSV`);
    await this.insertOrUpdateRecords(records);
  }

  async insertOrUpdateRecords(records: OrganizationRecord[]) {
    this.logger.log(`Processing ${records.length} records...`);

    const existingRecords = await this.prisma.organization.findMany({
      select: { name: true, dataHash: true },
    });
    const existingMap = new Map(
      existingRecords.map((rec) => [rec.name, rec.dataHash]),
    );

    const batches = this.createBatches(records, this.batchSize);
    for (const batch of batches) {
      const upserts = batch
        .map((record) => {
          const normalizedData = this.normalizeRecord(record);
          const dataHash = this.generateHash(normalizedData);
          if (existingMap.get(normalizedData.name) === dataHash) {
            return null;
          }

          return this.prisma.organization.upsert({
            where: { name: normalizedData.name },
            update: { ...normalizedData, dataHash },
            create: { ...normalizedData, dataHash },
          });
        })
        .filter(Boolean);

      await Promise.all(upserts);
      this.logger.log(`Processed batch of ${upserts.length} records...`);
    }
    this.logger.log(`Imported ${records.length} records into the database.`);
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
      name: String(record.name),
      townCity: typeof record.townCity === 'string' ? record.townCity : '',
      county: typeof record.county === 'string' ? record.county : '',
      typeRating:
        typeof record.typeRating === 'string' ? record.typeRating : '',
      route: typeof record.route === 'string' ? record.route : '',
    };
  }
}
