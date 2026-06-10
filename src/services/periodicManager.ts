import * as fs from 'fs';
import * as path from 'path';
import { Client, TextChannel, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { FinanceService } from './finance.js';
import { ChartGenerator } from './chartGenerator.js';
import { formatCurrency, formatPercentage } from '../utils/format.js';

export interface PeriodicSubscription {
  id: string;
  symbol: string;
  normalizedSymbol: string;
  interval: '1h' | '4h' | '12h' | '24h';
  channelId: string;
  lastSent: string;
  createdAt: string;
}

export class PeriodicManager {
  private static filePath = path.join(process.cwd(), 'subscriptions.json');
  private static subscriptions: PeriodicSubscription[] = [];
  private static checkInterval: NodeJS.Timeout | null = null;

  /**
   * Initializes the manager by loading subscriptions from JSON database file.
   */
  static init(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.subscriptions = JSON.parse(data);
        console.log(`Loaded ${this.subscriptions.length} periodic subscriptions.`);
      } else {
        this.subscriptions = [];
        this.saveDatabase();
        console.log('Created new subscriptions database file.');
      }
    } catch (error) {
      console.error('Failed to load subscriptions database:', error);
      this.subscriptions = [];
    }
  }

  /**
   * Saves subscriptions array to the database file.
   */
  private static saveDatabase(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.subscriptions, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save subscriptions database:', error);
    }
  }

  /**
   * Adds a new periodic subscription.
   */
  static addSubscription(
    symbol: string,
    interval: '1h' | '4h' | '12h' | '24h',
    channelId: string
  ): PeriodicSubscription {
    const cleanSymbol = symbol.trim().toUpperCase();

    // Generate subscription
    const newSub: PeriodicSubscription = {
      id: Math.random().toString(36).substring(2, 9),
      symbol: cleanSymbol,
      normalizedSymbol: cleanSymbol,
      interval,
      channelId,
      lastSent: new Date(0).toISOString(), // Set lastSent to Epoch so it triggers immediately on startup
      createdAt: new Date().toISOString()
    };

    this.subscriptions.push(newSub);
    this.saveDatabase();
    return newSub;
  }

  /**
   * Gets all active subscriptions.
   */
  static getSubscriptions(): PeriodicSubscription[] {
    return this.subscriptions;
  }

  /**
   * Removes a subscription by ID.
   */
  static removeSubscription(id: string): boolean {
    const index = this.subscriptions.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.subscriptions.splice(index, 1);
      this.saveDatabase();
      return true;
    }
    return false;
  }

  /**
   * Resets all subscriptions back to default (clears the database).
   */
  static clearAll(): void {
    this.subscriptions = [];
    this.saveDatabase();
  }

  /**
   * Starts the checking schedule loop.
   * Runs check every `intervalMs` (default: 5 minutes = 300,000 ms).
   */
  static startScheduler(client: Client, intervalMs: number = 300000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    console.log(`Starting periodic updates scheduler every ${intervalMs / 1000}s...`);
    
    // Check immediately on startup
    this.checkPendingUpdates(client).catch(err => {
      console.error('Error in initial periodic updates check:', err);
    });

    this.checkInterval = setInterval(() => {
      this.checkPendingUpdates(client).catch((err) => {
        console.error('Error in periodic updates check interval:', err);
      });
    }, intervalMs);
  }

  /**
   * Checks all subscriptions and sends updates if the duration elapsed.
   */
  private static async checkPendingUpdates(client: Client): Promise<void> {
    if (this.subscriptions.length === 0) return;

    const now = new Date();
    let updated = false;

    for (const sub of this.subscriptions) {
      const lastSentTime = new Date(sub.lastSent);
      const diffMs = now.getTime() - lastSentTime.getTime();
      
      // Determine threshold based on interval
      let thresholdMs = 3600000; // default 1 hour
      if (sub.interval === '4h') thresholdMs = 4 * 3600000;
      else if (sub.interval === '12h') thresholdMs = 12 * 3600000;
      else if (sub.interval === '24h') thresholdMs = 24 * 3600000;

      // Add a small 1-minute grace period to prevent strict boundary timing failures
      if (diffMs >= (thresholdMs - 60000)) {
        console.log(`Sending periodic update for ${sub.symbol} to channel ${sub.channelId}...`);
        
        try {
          await this.sendUpdateMessage(client, sub);
          sub.lastSent = now.toISOString();
          updated = true;
        } catch (err: any) {
          console.error(`Failed to send periodic update for ${sub.symbol}:`, err.message);
        }
      }
    }

    if (updated) {
      this.saveDatabase();
    }
  }

  /**
   * Fetches latest quote/chart and posts to channel.
   */
  private static async sendUpdateMessage(client: Client, sub: PeriodicSubscription): Promise<void> {
    const channel = await client.channels.fetch(sub.channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(`Channel ${sub.channelId} not found or is not a text channel.`);
    }

    // 1. Fetch Quote
    const quote = await FinanceService.getQuote(sub.symbol);

    // 2. Fetch Historical and Render Chart
    // Choose appropriate range for chart based on update interval
    // 1h update -> 1d chart
    // 4h or 12h update -> 5d chart
    // 24h update -> 1m chart
    let range = '1m';
    if (sub.interval === '1h') range = '1d';
    else if (sub.interval === '4h' || sub.interval === '12h') range = '5d';

    const { quotes } = await FinanceService.getHistoricalData(sub.symbol, range);
    const chartBuffer = await ChartGenerator.generatePriceChart(quote.symbol, quotes, range);
    const attachment = new AttachmentBuilder(chartBuffer, { name: `${quote.symbol}-periodic.png` });

    const isPositive = quote.change >= 0;
    const color = isPositive ? '#10b981' : '#ef4444';
    const changeEmoji = isPositive ? '📈' : '📉';

    const embed = new EmbedBuilder()
      .setTitle(`🔔 UPDATE BERKALA: ${quote.symbol} (${sub.interval})`)
      .setDescription(`Berikut adalah harga berkala untuk **${quote.name}**`)
      .setColor(color)
      .addFields(
        { name: 'Harga Sekarang', value: `**${formatCurrency(quote.price, quote.currency)}**`, inline: true },
        { name: 'Perubahan Harian', value: `${formatCurrency(quote.change, quote.currency)} (${formatPercentage(quote.changePercent)})`, inline: true },
        { name: 'Tipe Aset', value: `\`${quote.assetType}\``, inline: true }
      )
      .setImage(`attachment://${quote.symbol}-periodic.png`)
      .setTimestamp()
      .setFooter({ text: 'Wise Trading Automated Update System' });

    await channel.send({ embeds: [embed], files: [attachment] });
  }
}
