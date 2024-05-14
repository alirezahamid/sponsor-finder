import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as TelegramBot from 'node-telegram-bot-api';
import { OrganizationService } from 'src/organization/organization.service';

@Injectable()
export class TelegramService {
  private readonly bot: TelegramBot;
  private commandHandlers: Map<string, (chatId: number, text?: string) => void>;

  constructor(
    private organization: OrganizationService,
    private configService: ConfigService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set in .env file');
    }
    this.bot = new TelegramBot(token, { polling: true });

    this.initializeCommandHandlers();
    this.initializeMessageHandling();
  }

  private initializeCommandHandlers() {
    this.commandHandlers = new Map([
      ['/start', this.handleStart.bind(this)],
      ['/search', this.handleSearch.bind(this)],
    ]);
  }

  private handleStart(chatId: number) {
    this.bot.sendMessage(chatId, 'Welcome to UK Sponsor Finder :)');
  }

  private handleSearch(chatId: number) {
    this.bot.sendMessage(
      chatId,
      'Enter Search term (Name of company or City).',
    );
    this.commandHandlers.set(
      chatId.toString(),
      this.searchOrganizations.bind(this),
    );
  }

  private initializeMessageHandling() {
    this.bot.on('message', (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      if (this.commandHandlers.has(text)) {
        this.commandHandlers.get(text)(chatId);
      } else {
        // If no command matches, check if there is an active command waiting for more input
        const handler = this.commandHandlers.get(chatId.toString());
        if (handler) {
          handler(chatId, text);
          this.commandHandlers.delete(chatId.toString()); // Reset the handler after use
        }
      }
    });
  }

  private async searchOrganizations(
    chatId: number,
    search: string,
    page: number = 1,
    limit: number = 16,
  ) {
    try {
      const response = await this.organization.getOrganizations(
        page,
        limit,
        search,
      );
      if (response.totalRecords > 0) {
        let message = `🔍 Found ${response.totalRecords} organizations matching your search! Here are the details: 🌟\n\n`;
        response.data.forEach((org) => {
          message += `🏢 Name: ${org.name}\n📍 City: ${org.townCity}${org.county ? ', ' + org.county : ''}\n📈 Type & Rating: ${org.typeRating}\n🛤️ Route: ${org.route}\n---\n`;
        });
        this.bot.sendMessage(chatId, message);
      } else {
        this.bot.sendMessage(
          chatId,
          `🤷‍♂️ Oops! No organizations found matching "${search}". Try a different keyword maybe? 🧐`,
        );
      }
    } catch (error) {
      this.bot.sendMessage(
        chatId,
        `😱 Oh no! Something went wrong while trying to fetch the organizations. Please try again later! 🛠️`,
      );
      console.error('Failed to fetch organizations:', error);
    }
  }
}
