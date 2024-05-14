import axios from 'axios';
import { parse } from 'csv-parse';
import * as fs from 'fs';
import * as cheerio from 'cheerio';
import { OrganizationRecord } from 'src/scraper/interfaces/organization.interface';
import { Logger } from '@nestjs/common';
import { promisify } from 'util';
import * as stream from 'stream';

const logger = new Logger('CsvParser');
const pipeline = promisify(stream.pipeline);
export async function parseCSV(response: any): Promise<OrganizationRecord[]> {
  const records: OrganizationRecord[] = [];
  const path = './tmp/csv-download.csv';
  const writer = fs.createWriteStream(path);

  await pipeline(response.data, writer);
  const parser = fs
    .createReadStream(path)
    .pipe(
      parse({
        columns: (header) => header.map((column) => column.trim()), // This line ensures headers are trimmed of any excess whitespace
        trim: true,
        skip_empty_lines: true,
        cast: true,
        cast_date: true,
        relax_quotes: true,
      }),
    )
    .on('error', (err) => {
      logger.error(`Error parsing CSV: ${err.message}`);
    });

  for await (const record of parser) {
    records.push({
      name: record['Organisation Name'],
      townCity: record['Town/City'],
      county: record['County'],
      typeRating: record['Type & Rating'],
      route: record['Route'],
    });
  }

  return records;
}

export async function scrapeForCSVLink(): Promise<string> {
  const url =
    'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers';
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  const linkElement = $(
    'h3.gem-c-attachment__title > a.govuk-link.gem-c-attachment__link',
  );

  if (linkElement.length === 0) {
    logger.error('No CSV link found');
    throw new Error('No CSV link found');
  }
  const href = linkElement.attr('href');
  logger.log(href);
  return href;
}
