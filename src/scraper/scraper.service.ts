import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseCSV, scrapeForCSVLink } from 'src/utils/csvParser';
import { OrganizationRecord } from './interfaces/organization.interface';

@Injectable()
export class ScraperService implements OnModuleInit {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private prisma: PrismaService) {}

  // @Cron('0 0 */2 * *') // Cron expression for every 2 days at midnight
  async handleCron() {
    this.logger.debug('Running scheduled CSV download and processing');
    await this.downloadAndProcessCSV();
  }

  async onModuleInit() {
    // await this.downloadAndProcessCSV();
  }

  async downloadAndProcessCSV() {
    const csvUrl = await scrapeForCSVLink();
    const response = await axios({
      method: 'GET',
      url: csvUrl,
      responseType: 'stream',
    });

    const records = await parseCSV(response);
    await this.insertRecords(records);
  }

  async insertRecords(records: OrganizationRecord[]) {
    // console.log(res);
    for (const record of records) {
      // console.log(typeof record.county);
      const data = {
        name: String(record.name),
        townCity: typeof record.townCity === 'string' ? record.townCity : '',
        county: typeof record.county === 'string' ? record.county : '',
        typeRating:
          typeof record.typeRating === 'string' ? record.typeRating : '',
        route: typeof record.route === 'string' ? record.route : '',
      };
      // console.log(data);
      await this.prisma.organization.upsert({
        where: { name: String(record.name) },
        update: data,
        create: data,
      });
    }
    this.logger.log(`Imported ${records.length} records into the database.`);
  }
}
