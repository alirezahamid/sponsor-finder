import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [ScraperService, PrismaService],
  exports: [ScraperService],
})
export class ScraperModule {}
