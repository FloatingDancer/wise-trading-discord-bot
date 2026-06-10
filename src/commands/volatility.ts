import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { FinanceService } from '../services/finance.js';
import { VolatilityManager } from '../services/volatilityManager.js';
import { formatCurrency } from '../utils/format.js';

export const VolatilityCommand = {
  data: new SlashCommandBuilder()
    .setName('volatility')
    .setDescription('Mengelola alarm persentase perubahan harga (volatilitas)')
    .addSubcommand(subcommand =>
      subcommand.setName('add')
        .setDescription('Menambahkan alarm persentase pergerakan harga baru')
        .addStringOption(option =>
          option.setName('symbol')
            .setDescription('Simbol ticker aset (contoh: BTC-USD, AAPL)')
            .setRequired(true)
        )
        .addNumberOption(option =>
          option.setName('percentage')
            .setDescription('Persentase perubahan pemicu (contoh: 3 untuk ±3%)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('list')
        .setDescription('Menampilkan alarm persentase aktif Anda')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('remove')
        .setDescription('Menghapus alarm persentase berdasarkan ID')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID alarm persentase yang ingin dihapus')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const userId = interaction.user.id;
    const alerts = VolatilityManager.getUserAlerts(userId);

    const choices = alerts
      .filter(a =>
        a.id.toLowerCase().includes(focusedValue) ||
        a.symbol.toLowerCase().includes(focusedValue)
      )
      .map(a => ({
        name: `${a.symbol} (±${a.percentage}%) - ID: ${a.id}`,
        value: a.id
      }))
      .slice(0, 25);

    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    if (subcommand === 'add') {
      const symbol = interaction.options.getString('symbol', true);
      const percentage = interaction.options.getNumber('percentage', true);

      if (percentage <= 0) {
        await interaction.editReply({
          content: '❌ Persentase harus bernilai lebih dari 0%.'
        });
        return;
      }

      try {
        const alert = await VolatilityManager.addAlert(symbol, percentage, userId, channelId);
        
        // Fetch quote for info
        const quote = await FinanceService.getQuote(symbol);

        const embed = new EmbedBuilder()
          .setTitle('✅ Alarm Volatilitas Berhasil Diaktifkan!')
          .setColor('#eab308') // Yellow
          .setDescription(`Bot akan memantau fluktuasi harga **${quote.symbol}** (${quote.name}).`)
          .addFields(
            { name: 'ID Alarm', value: `\`${alert.id}\``, inline: true },
            { name: 'Ambang Batas', value: `**±${alert.percentage}%**`, inline: true },
            { name: 'Harga Acuan (Baseline)', value: `**${formatCurrency(alert.lastCheckedPrice, quote.currency)}**`, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Alarm akan terus aktif dan meng-update harga acuan setiap kali terpicu.' });

        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply({
          content: `❌ Gagal menambahkan alarm volatilitas: ${error.message}`
        });
      }
    } else if (subcommand === 'list') {
      const alerts = VolatilityManager.getUserAlerts(userId);

      if (alerts.length === 0) {
        await interaction.editReply({
          content: 'ℹ️ Anda tidak memiliki alarm persentase (volatilitas) yang aktif saat ini.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('⚡ Alarm Persentase (Volatilitas) Aktif Anda')
        .setColor('#eab308')
        .setDescription('Berikut daftar alarm persentase pergerakan harga Anda:')
        .setTimestamp();

      alerts.forEach(a => {
        embed.addFields({
          name: `${a.symbol} (ID: \`${a.id}\`)`,
          value: `Sensitivitas: **±${a.percentage}%**\nHarga Acuan Saat Ini: **${a.lastCheckedPrice.toLocaleString()}**\nDibuat: <t:${Math.floor(new Date(a.createdAt).getTime() / 1000)}:R>`,
          inline: false
        });
      });

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'remove') {
      const id = interaction.options.getString('id', true);
      const success = VolatilityManager.removeAlert(id, userId);

      if (success) {
        await interaction.editReply({
          content: `✅ Alarm volatilitas dengan ID \`${id}\` berhasil dihapus.`
        });
      } else {
        await interaction.editReply({
          content: `❌ Alarm volatilitas dengan ID \`${id}\` tidak ditemukan atau Anda bukan pemilik alarm ini.`
        });
      }
    }
  }
};
