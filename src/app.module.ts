import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ScraperService } from './scraper/scraper.service';
import { PrismaService } from './prisma/prisma.service';
import { ScraperModule } from './scraper/scraper.module';
import { ScheduleModule } from '@nestjs/schedule';
import { OrganizationModule } from './organization/organization.module';
import { TelegramService } from './telegram/telegram.service';
import { OrganizationService } from './organization/organization.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      expandVariables: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    ScraperModule,
    OrganizationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ScraperService,
    PrismaService,
    OrganizationService,
    TelegramService,
  ],
})
export class AppModule {}
