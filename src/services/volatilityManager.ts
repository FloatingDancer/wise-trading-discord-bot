import * as fs from 'fs';
import * as path from 'path';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { FinanceService, normalizeSymbol } from './finance.js';
import { formatCurrency, formatPercentage } from '../utils/format.js';

export interface VolatilityAlert {
  id: string;
  symbol: string;
  normalizedSymbol: string;
  percentage: number;
  userId: string;
  channelId: string;
  lastCheckedPrice: number;
  createdAt: string;
}

export class VolatilityManager {
  private static filePath = path.join(process.cwd(), 'volatility.json');
  private static alerts: VolatilityAlert[] = [];

  /**
   * Initializes the manager by loading alerts from the JSON database file.
   */
  static init(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.alerts = JSON.parse(data);
        console.log(`Loaded ${this.alerts.length} volatility alerts.`);
      } else {
        this.alerts = [];
        this.saveDatabase();
        console.log('Created new volatility database file.');
      }
    } catch (error) {
      console.error('Failed to load volatility database:', error);
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
      console.error('Failed to save volatility database:', error);
    }
  }

  /**
   * Adds a new volatility alert.
   */
  static async addAlert(
    symbol: string,
    percentage: number,
    userId: string,
    channelId: string
  ): Promise<VolatilityAlert> {
    const { normalized } = normalizeSymbol(symbol);
    
    // Fetch current price to establish baseline
    const quote = await FinanceService.getQuote(symbol);

    const newAlert: VolatilityAlert = {
      id: Math.random().toString(36).substring(2, 9),
      symbol: quote.symbol,
      normalizedSymbol: normalized,
      percentage: Math.abs(percentage),
      userId,
      channelId,
      lastCheckedPrice: quote.price,
      createdAt: new Date().toISOString()
    };

    this.alerts.push(newAlert);
    this.saveDatabase();
    return newAlert;
  }

  /**
   * Gets active alerts for a user.
   */
  static getUserAlerts(userId: string): VolatilityAlert[] {
    return this.alerts.filter((a) => a.userId === userId);
  }

  /**
   * Removes an alert.
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
   * Performs a check on all active volatility alerts and notifies if triggered.
   * Can be invoked from the main index.ts loop.
   */
  static async checkVolatilityAlerts(client: Client): Promise<void> {
    if (this.alerts.length === 0) return;

    // Get unique normalized symbols
    const uniqueSymbols = Array.from(new Set(this.alerts.map((a) => a.normalizedSymbol)));
    
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
        console.error(`Volatility check failed to get price for ${sym}:`, err.message);
      }
    }

    let updated = false;
    for (const alert of this.alerts) {
      const priceData = pricesMap[alert.normalizedSymbol];
      if (!priceData) continue;

      const currentPrice = priceData.price;
      const basePrice = alert.lastCheckedPrice;
      
      // Calculate change percent
      const changePercent = ((currentPrice - basePrice) / basePrice) * 100;
      const absoluteChangePercent = Math.abs(changePercent);

      // If change percent meets or exceeds threshold
      if (absoluteChangePercent >= alert.percentage) {
        // Reset the baseline price to current price (so it triggers again for the next X% movement)
        alert.lastCheckedPrice = currentPrice;
        updated = true;

        // Notify Discord
        this.triggerNotification(client, alert, basePrice, currentPrice, changePercent, priceData.name, priceData.currency);
      }
    }

    if (updated) {
      this.saveDatabase();
    }
  }

  /**
   * Sends volatility notification to Discord.
   */
  private static async triggerNotification(
    client: Client,
    alert: VolatilityAlert,
    basePrice: number,
    currentPrice: number,
    changePercent: number,
    name: string,
    currency: string
  ): Promise<void> {
    try {
      const channel = await client.channels.fetch(alert.channelId);
      if (!channel || !(channel instanceof TextChannel)) return;

      const isUp = changePercent >= 0;
      const emoji = isUp ? '🚀' : '⚠️';
      const directionWord = isUp ? 'NAIK' : 'TURUN';
      const color = isUp ? '#10b981' : '#ef4444';

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ALARM VOLATILITAS: Pergerakan Terdeteksi!`)
        .setDescription(`<@${alert.userId}>, terdeteksi pergerakan harga signifikan pada **${alert.symbol}** (${name})!`)
        .setColor(color)
        .addFields(
          { name: 'Aset', value: `${alert.symbol} (${name})`, inline: true },
          { name: 'Batas Alarm', value: `±${alert.percentage}%`, inline: true },
          { name: 'Pergerakan', value: `**${directionWord} (${formatPercentage(changePercent)})**`, inline: true },
          { name: 'Harga Sebelumnya (Baseline)', value: formatCurrency(basePrice, currency), inline: true },
          { name: 'Harga Sekarang', value: `**${formatCurrency(currentPrice, currency)}**`, inline: true },
          { name: 'Status', value: `🟢 **Harga Acuan Ter-update**: Baseline otomatis diperbarui ke **${formatCurrency(currentPrice, currency)}** untuk memantau pergerakan berikutnya.`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Wise Trading Volatility Alert System • Ter-update secara otomatis' });

      await channel.send({
        content: `<@${alert.userId}> 🚨`,
        embeds: [embed]
      });
    } catch (error) {
      console.error(`Failed to send volatility notification for alert ${alert.id}:`, error);
    }
  }
}
