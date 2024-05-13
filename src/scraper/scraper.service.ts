import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import { parse } from 'csv-parse';
import * as fs from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';
import * as stream from 'stream';
import { promisify } from 'util';
import * as cheerio from 'cheerio';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly pipeline = promisify(stream.pipeline);

  constructor(private prisma: PrismaService) {}

  // async onModuleInit() {
  //   await this.downloadAndProcessCSV();
  // }

  async scrapeForCSVLink(): Promise<string> {
    const url =
      'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers';
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const linkElement = $(
      'h3.gem-c-attachment__title > a.govuk-link.gem-c-attachment__link',
    );

    if (linkElement.length === 0) {
      this.logger.error('No CSV link found');
      throw new Error('No CSV link found');
    }

    const href = linkElement.attr('href');
    console.log(href);
    return href;
  }

  async downloadAndProcessCSV() {
    const csvUrl = await this.scrapeForCSVLink();
    const response = await axios({
      method: 'GET',
      url: csvUrl,
      responseType: 'stream',
    });

    const path = './tmp/csv-download.csv';
    const writer = fs.createWriteStream(path);

    await this.pipeline(response.data, writer);

    const records = [];
    fs.createReadStream(path)
      .pipe(parse({ columns: true, trim: true }))
      .on('data', (data) => records.push(data))
      .on('end', async () => {
        await this.insertRecords(records);
      });
  }

  async insertRecords(records: any[]) {
    // console.log(res);
    for (const record of records) {
      const data = {
        name: record['Organisation Name'],
        townCity: record['Town/City'],
        county: record['County'],
        typeRating: record['Type & Rating'],
        route: record['Route'],
      };
      await this.prisma.organization.upsert({
        where: { name: record['Organisation Name'] },
        update: data,
        create: data,
      });
    }
    this.logger.log(`Imported ${records.length} records into the database.`);
  }
}
