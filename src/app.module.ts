import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ScraperService } from './scraper/scraper.service';
import { PrismaService } from './prisma/prisma.service';
import { ScraperModule } from './scraper/scraper.module';
import { ScheduleModule } from '@nestjs/schedule';
import { OrganizationModule } from './organization/organization.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    ScraperModule,
    OrganizationModule,
  ],
  controllers: [AppController],
  providers: [AppService, ScraperService, PrismaService],
})
export class AppModule {}
