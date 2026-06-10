import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { FinanceService } from '../services/finance.js';
import { formatCurrency, formatPercentage } from '../utils/format.js';

export const WatchlistCommand = {
  data: new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('Melihat ringkasan harga (dashboard) beberapa aset sekaligus')
    .addStringOption(option =>
      option.setName('symbols')
        .setDescription('Simbol dipisah spasi atau koma (contoh: BTC-USD AAPL USDIDR=X)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const symbolsInput = interaction.options.getString('symbols');

    let symbols: string[] = [];
    if (symbolsInput) {
      // Split by comma or space and clean up
      symbols = symbolsInput
        .replace(/,/g, ' ')
        .split(/\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    } else {
      // Default dashboard assets
      symbols = ['BTC-USD', 'ETH-USD', 'AAPL', 'TSLA', 'USDIDR=X'];
    }

    if (symbols.length === 0) {
      await interaction.editReply({
        content: '❌ Silakan masukkan minimal satu simbol ticker yang valid.'
      });
      return;
    }

    // Cap at 15 items to prevent exceeding discord size limit and rate-limits
    const displaySymbols = symbols.slice(0, 15);

    try {
      // Fetch quotes in parallel
      const fetchPromises = displaySymbols.map(async (sym) => {
        try {
          const quote = await FinanceService.getQuote(sym);
          return { success: true, quote };
        } catch (err: any) {
          return { success: false, symbol: sym, error: err.message };
        }
      });

      const results = await Promise.all(fetchPromises);

      const embed = new EmbedBuilder()
        .setTitle('📊 Wise Trading Watchlist Dashboard')
        .setColor('#5865F2') // Blurple
        .setTimestamp()
        .setFooter({ text: 'Real-time quotes provided by Yahoo Finance' });

      let descriptionText = '';
      let errorText = '';

      for (const res of results) {
        if (res.success && res.quote) {
          const q = res.quote;
          const isUp = q.change >= 0;
          const statusEmoji = isUp ? '🟢' : '🔴';
          
          // Format line
          descriptionText += `${statusEmoji} **${q.symbol}** (${q.name})\n`;
          descriptionText += `   ↳ Price: **${formatCurrency(q.price, q.currency)}** | Change: **${formatPercentage(q.changePercent)}** (${formatCurrency(q.change, q.currency)})\n\n`;
        } else {
          errorText += `⚠️ **${res.symbol}**: Tidak dapat dimuat\n`;
        }
      }

      if (descriptionText.length > 0) {
        embed.setDescription(descriptionText);
      } else {
        embed.setDescription('*Tidak ada aset yang berhasil dimuat.*');
      }

      if (errorText.length > 0) {
        embed.addFields({ name: 'Error / Masalah', value: errorText });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ Terjadi kesalahan saat memproses watchlist: ${error.message}`
      });
    }
  }
};
