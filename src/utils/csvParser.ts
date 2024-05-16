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

export async function parseCSV(
  inputStream: stream.Readable,
): Promise<OrganizationRecord[]> {
  const records: OrganizationRecord[] = [];
  const parser = inputStream.pipe(
    parse({ columns: true, trim: true, skip_empty_lines: true }),
  );

  for await (const record of parser) {
    records.push({
      name: String(record['Organisation Name']).trim(),
      townCity:
        typeof record['Town/City'] === 'string'
          ? record['Town/City'].trim()
          : '',
      county:
        typeof record['County'] === 'string' ? record['County'].trim() : '',
      typeRating:
        typeof record['Type & Rating'] === 'string'
          ? record['Type & Rating'].trim()
          : '',
      route: typeof record['Route'] === 'string' ? record['Route'].trim() : '',
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
