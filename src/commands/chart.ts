import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ChatInputCommandInteraction } from 'discord.js';
import { FinanceService } from '../services/finance.js';
import { ChartGenerator } from '../services/chartGenerator.js';
import { formatCurrency, formatPercentage } from '../utils/format.js';

export const ChartCommand = {
  data: new SlashCommandBuilder()
    .setName('chart')
    .setDescription('Melihat grafik harga historis saham, crypto, atau forex')
    .addStringOption(option =>
      option.setName('symbol')
        .setDescription('Simbol ticker aset (contoh: BTC-USD, AAPL, USDIDR=X)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('range')
        .setDescription('Rentang waktu grafik')
        .setRequired(false)
        .addChoices(
          { name: '1 Hari (Intraday)', value: '1d' },
          { name: '5 Hari', value: '5d' },
          { name: '1 Minggu', value: '1w' },
          { name: '1 Bulan (Default)', value: '1m' },
          { name: '3 Bulan', value: '3m' },
          { name: '6 Bulan', value: '6m' },
          { name: '1 Tahun', value: '1y' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    
    const symbolInput = interaction.options.getString('symbol', true);
    const range = interaction.options.getString('range') || '1m';

    try {
      // 1. Fetch historical data
      const { quotes, meta } = await FinanceService.getHistoricalData(symbolInput, range);
      
      // Get current price info to display alongside the chart
      const quote = await FinanceService.getQuote(symbolInput);

      // 2. Generate chart buffer
      const chartBuffer = await ChartGenerator.generatePriceChart(quote.symbol, quotes, range);
      
      // 3. Create attachment
      const attachment = new AttachmentBuilder(chartBuffer, { name: `${quote.symbol}-chart.png` });

      // 4. Calculate change over chart period
      const startPrice = quotes[0].close;
      const endPrice = quotes[quotes.length - 1].close;
      const periodChange = endPrice - startPrice;
      const periodChangePercent = (periodChange / startPrice) * 100;
      
      const isPositive = periodChange >= 0;
      const color = isPositive ? '#10b981' : '#ef4444';
      const changeEmoji = isPositive ? '📈' : '📉';

      // 5. Build Embed
      const embed = new EmbedBuilder()
        .setTitle(`${changeEmoji} Grafik ${quote.symbol} (${range.toUpperCase()})`)
        .setDescription(`**${quote.name}**`)
        .setColor(color)
        .addFields(
          { 
            name: 'Harga Saat Ini', 
            value: `**${formatCurrency(quote.price, quote.currency)}**`, 
            inline: true 
          },
          { 
            name: `Perubahan Periode (${range.toUpperCase()})`, 
            value: `${formatCurrency(periodChange, quote.currency)} (${formatPercentage(periodChangePercent)})`, 
            inline: true 
          }
        )
        .setImage(`attachment://${quote.symbol}-chart.png`)
        .setTimestamp()
        .setFooter({ text: 'Wise Trading Chart Generator' });

      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (error: any) {
      console.error(error);
      await interaction.editReply({
        content: `❌ Gagal memuat grafik untuk **${symbolInput}**. Pastikan simbol dan jangka waktu valid. (Error: ${error.message})`
      });
    }
  }
};
