import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { FinanceService } from '../services/finance.js';
import { formatCurrency, formatPercentage, formatDate } from '../utils/format.js';

export const PriceCommand = {
  data: new SlashCommandBuilder()
    .setName('price')
    .setDescription('Melihat harga real-time saham, crypto, atau forex')
    .addStringOption(option =>
      option.setName('symbol')
        .setDescription('Simbol ticker aset (contoh: BTC-USD, AAPL, USDIDR=X)')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const symbolInput = interaction.options.getString('symbol', true);

    try {
      const quote = await FinanceService.getQuote(symbolInput);
      
      const isPositive = quote.change >= 0;
      const color = isPositive ? '#10b981' : '#ef4444'; // Neon Green vs Neon Red
      const changeEmoji = isPositive ? '📈' : '📉';

      const embed = new EmbedBuilder()
        .setTitle(`${changeEmoji} ${quote.symbol} - ${quote.name}`)
        .setColor(color)
        .addFields(
          { 
            name: 'Harga Sekarang', 
            value: `**${formatCurrency(quote.price, quote.currency)}**`, 
            inline: false 
          },
          { 
            name: 'Perubahan (24j)', 
            value: `${formatCurrency(quote.change, quote.currency)} (${formatPercentage(quote.changePercent)})`, 
            inline: true 
          },
          { 
            name: 'Status Pasar', 
            value: `\`${quote.marketState}\``, 
            inline: true 
          },
          { 
            name: 'Tipe Aset', 
            value: `\`${quote.assetType}\``, 
            inline: true 
          },
          { 
            name: 'Open', 
            value: formatCurrency(quote.open, quote.currency), 
            inline: true 
          },
          { 
            name: 'Harian Terendah', 
            value: formatCurrency(quote.low, quote.currency), 
            inline: true 
          },
          { 
            name: 'Harian Tertinggi', 
            value: formatCurrency(quote.high, quote.currency), 
            inline: true 
          }
        )
        .setTimestamp(quote.timestamp)
        .setFooter({ text: `Terakhir diperbarui • ${formatDate(quote.timestamp)}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ Gagal mengambil harga untuk **${symbolInput}**. Silakan periksa kembali simbolnya. (Error: ${error.message})`
      });
    }
  }
};
