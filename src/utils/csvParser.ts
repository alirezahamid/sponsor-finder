import { parse } from 'csv-parse';
import * as fs from 'fs';

import { OrganizationRecord } from 'src/scraper/interfaces/organization.interface';

export async function parseCSV(
  filePath: string,
): Promise<OrganizationRecord[]> {
  const records: OrganizationRecord[] = [];

  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: (header) => header.map((column) => column.trim()), // This line ensures headers are trimmed of any excess whitespace
      trim: true,
      skip_empty_lines: true,
      cast: true,
      cast_date: true,
    }),
  );

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
