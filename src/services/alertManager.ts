import * as fs from 'fs';
import * as path from 'path';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { FinanceService, normalizeSymbol } from './finance.js';
import { formatCurrency } from '../utils/format.js';

export interface PriceAlert {
  id: string;
  symbol: string;
  normalizedSymbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  userId: string;
  channelId: string;
  createdAt: string;
  active: boolean;
}

export class AlertManager {
  private static filePath = path.join(process.cwd(), 'alerts.json');
  private static alerts: PriceAlert[] = [];
  private static checkInterval: NodeJS.Timeout | null = null;

  /**
   * Initializes the manager by loading alerts from the JSON database file.
   */
  static init(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.alerts = JSON.parse(data);
        console.log(`Loaded ${this.alerts.length} alerts from database.`);
      } else {
        this.alerts = [];
        this.saveDatabase();
        console.log('Created new alert database file.');
      }
    } catch (error) {
      console.error('Failed to load alert database:', error);
      this.alerts = [];
    }
  }

  /**
   * Saves the current alerts array to the database file.
   */
  private static saveDatabase(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.alerts, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save alert database:', error);
    }
  }

  /**
   * Adds a new price alert.
   */
  static addAlert(
    symbol: string,
    targetPrice: number,
    condition: 'ABOVE' | 'BELOW',
    userId: string,
    channelId: string
  ): PriceAlert {
    const { normalized } = normalizeSymbol(symbol);
    
    const newAlert: PriceAlert = {
      id: Math.random().toString(36).substring(2, 9),
      symbol: symbol.toUpperCase(),
      normalizedSymbol: normalized,
      targetPrice,
      condition,
      userId,
      channelId,
      createdAt: new Date().toISOString(),
      active: true
    };

    this.alerts.push(newAlert);
    this.saveDatabase();
    return newAlert;
  }

  /**
   * Gets all active alerts for a specific user.
   */
  static getUserAlerts(userId: string): PriceAlert[] {
    return this.alerts.filter((a) => a.userId === userId && a.active);
  }

  /**
   * Deletes an alert by ID, verifying user ownership.
   */
  static removeAlert(alertId: string, userId: string): boolean {
    const index = this.alerts.findIndex((a) => a.id === alertId && a.userId === userId);
    if (index !== -1) {
      this.alerts.splice(index, 1);
      this.saveDatabase();
      return true;
    }
    return false;
  }

  /**
   * Resets all alerts back to default (clears the database).
   */
  static clearAll(): void {
    this.alerts = [];
    this.saveDatabase();
  }

  /**
   * Starts the polling check cycle.
   * Runs check every `intervalMs` (default: 1 minute).
   */
  static startMonitoring(client: Client, intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    console.log(`Starting alert price monitoring every ${intervalMs / 1000}s...`);
    this.checkInterval = setInterval(() => {
      this.checkActiveAlerts(client).catch((err) => {
        console.error('Error in alert check interval:', err);
      });
    }, intervalMs);
  }

  /**
   * Iterates through active alerts, fetches current prices, and triggers notices.
   */
  private static async checkActiveAlerts(client: Client): Promise<void> {
    const activeAlerts = this.alerts.filter((a) => a.active);
    if (activeAlerts.length === 0) return;

    // Get unique normalized symbols
    const uniqueSymbols = Array.from(new Set(activeAlerts.map((a) => a.normalizedSymbol)));

    // Fetch prices in parallel or batches
    // If there are many symbols, we can fetch them. Let's do it in one or small calls.
    const pricesMap: Record<string, { price: number; name: string; currency: string }> = {};
    
    for (const sym of uniqueSymbols) {
      try {
        const quote = await FinanceService.getQuote(sym);
        pricesMap[sym] = {
          price: quote.price,
          name: quote.name,
          currency: quote.currency
        };
      } catch (err: any) {
        console.error(`Alert check failed to get price for ${sym}:`, err.message);
      }
    }

    // Evaluate alerts
    let updated = false;
    for (const alert of activeAlerts) {
      const priceData = pricesMap[alert.normalizedSymbol];
      if (!priceData) continue;

      const currentPrice = priceData.price;
      let triggered = false;

      if (alert.condition === 'ABOVE' && currentPrice >= alert.targetPrice) {
        triggered = true;
      } else if (alert.condition === 'BELOW' && currentPrice <= alert.targetPrice) {
        triggered = true;
      }

      if (triggered) {
        alert.active = false; // Disable alert (one-shot trigger)
        updated = true;
        
        // Notify Discord
        this.triggerNotification(client, alert, currentPrice, priceData.name, priceData.currency);
      }
    }

    if (updated) {
      this.saveDatabase();
    }
  }

  /**
   * Sends alert trigger message to Discord.
   */
  private static async triggerNotification(
    client: Client,
    alert: PriceAlert,
    currentPrice: number,
    name: string,
    currency: string
  ): Promise<void> {
    try {
      const channel = await client.channels.fetch(alert.channelId);
      if (!channel || !(channel instanceof TextChannel)) return;

      const conditionEmoji = alert.condition === 'ABOVE' ? '📈' : '📉';
      const directionWord = alert.condition === 'ABOVE' ? 'naik di atas' : 'turun di bawah';

      const embed = new EmbedBuilder()
        .setTitle(`🚨 ALERT: Target Harga Tercapai!`)
        .setDescription(`<@${alert.userId}>, target harga untuk **${alert.symbol}** (${name}) telah terpicu!`)
        .setColor(alert.condition === 'ABOVE' ? '#10b981' : '#ef4444')
        .addFields(
          { name: 'Aset', value: `${alert.symbol} (${name})`, inline: true },
          { name: 'Kondisi Target', value: `${conditionEmoji} ${alert.condition} ${formatCurrency(alert.targetPrice, currency)}`, inline: true },
          { name: 'Harga Sekarang', value: `**${formatCurrency(currentPrice, currency)}**`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Wise Trading Alert System' });

      await channel.send({
        content: `<@${alert.userId}> 🚨`,
        embeds: [embed]
      });
    } catch (error) {
      console.error(`Failed to send alert notification for alert ${alert.id}:`, error);
    }
  }
}
