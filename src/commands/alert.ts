import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { FinanceService } from '../services/finance.js';
import { AlertManager } from '../services/alertManager.js';
import { formatCurrency } from '../utils/format.js';

export const AlertCommand = {
  data: new SlashCommandBuilder()
    .setName('alert')
    .setDescription('Mengelola alarm harga (price alerts) untuk memantau pasar')
    .addSubcommand(subcommand =>
      subcommand.setName('set')
        .setDescription('Mengatur alarm harga baru untuk suatu aset')
        .addStringOption(option =>
          option.setName('symbol')
            .setDescription('Simbol ticker aset (contoh: BTC-USD, AAPL)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('condition')
            .setDescription('Kondisi pemicu alarm')
            .setRequired(true)
            .addChoices(
              { name: 'Naik di atas (ABOVE)', value: 'ABOVE' },
              { name: 'Turun di bawah (BELOW)', value: 'BELOW' }
            )
        )
        .addNumberOption(option =>
          option.setName('target')
            .setDescription('Target harga pemicu alarm')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('list')
        .setDescription('Menampilkan semua alarm aktif Anda')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('remove')
        .setDescription('Menghapus alarm berdasarkan ID alarm')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID Alarm yang ingin dihapus')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const userId = interaction.user.id;
    const alerts = AlertManager.getUserAlerts(userId);

    const choices = alerts
      .filter(a =>
        a.id.toLowerCase().includes(focusedValue) ||
        a.symbol.toLowerCase().includes(focusedValue)
      )
      .map(a => {
        const direction = a.condition === 'ABOVE' ? '📈 >=' : '📉 <=';
        return {
          name: `${a.symbol} (${direction} ${a.targetPrice.toLocaleString()}) - ID: ${a.id}`,
          value: a.id
        };
      })
      .slice(0, 25);

    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true }); // Make config commands ephemeral so they don't clutter the chat
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'set') {
      const symbol = interaction.options.getString('symbol', true);
      const condition = interaction.options.getString('condition', true) as 'ABOVE' | 'BELOW';
      const target = interaction.options.getNumber('target', true);
      const channelId = interaction.channelId;

      try {
        // Verify symbol exists first
        const quote = await FinanceService.getQuote(symbol);

        // Sanity checks
        if (condition === 'ABOVE' && quote.price >= target) {
          await interaction.editReply({
            content: `⚠️ Harga **${quote.symbol}** sekarang adalah **${formatCurrency(quote.price, quote.currency)}**, yang mana sudah berada di atas target Anda **${formatCurrency(target, quote.currency)}**.`
          });
          return;
        }

        if (condition === 'BELOW' && quote.price <= target) {
          await interaction.editReply({
            content: `⚠️ Harga **${quote.symbol}** sekarang adalah **${formatCurrency(quote.price, quote.currency)}**, yang mana sudah berada di bawah target Anda **${formatCurrency(target, quote.currency)}**.`
          });
          return;
        }

        const alert = AlertManager.addAlert(symbol, target, condition, userId, channelId);

        const embed = new EmbedBuilder()
          .setTitle('✅ Alarm Berhasil Diatur!')
          .setColor('#10b981')
          .setDescription(`Bot akan memantau harga **${quote.symbol}** (${quote.name}) dan memberi tahu Anda di channel ini jika harganya tercapai.`)
          .addFields(
            { name: 'ID Alarm', value: `\`${alert.id}\``, inline: true },
            { name: 'Kondisi Pemicu', value: `${condition === 'ABOVE' ? '📈 Di Atas' : '📉 Di Bawah'}`, inline: true },
            { name: 'Target Harga', value: `**${formatCurrency(target, quote.currency)}**`, inline: true },
            { name: 'Harga Saat Ini', value: `${formatCurrency(quote.price, quote.currency)}`, inline: true }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply({
          content: `❌ Gagal mengatur alarm untuk **${symbol}**. Simbol tidak ditemukan atau terjadi masalah: ${error.message}`
        });
      }
    } else if (subcommand === 'list') {
      const alerts = AlertManager.getUserAlerts(userId);

      if (alerts.length === 0) {
        await interaction.editReply({
          content: 'ℹ️ Anda tidak memiliki alarm harga aktif saat ini.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🚨 Alarm Harga Aktif Anda')
        .setColor('#3b82f6')
        .setDescription('Berikut daftar alarm harga Anda yang sedang aktif dipantau:')
        .setTimestamp();

      alerts.forEach((alert) => {
        const condEmoji = alert.condition === 'ABOVE' ? '📈 >= ' : '📉 <= ';
        embed.addFields({
          name: `${alert.symbol} (ID: \`${alert.id}\`)`,
          value: `Picu jika: **${condEmoji}${alert.targetPrice.toLocaleString()}**\nDiatur pada: <t:${Math.floor(new Date(alert.createdAt).getTime() / 1000)}:R>`,
          inline: false
        });
      });

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'remove') {
      const id = interaction.options.getString('id', true);
      const success = AlertManager.removeAlert(id, userId);

      if (success) {
        await interaction.editReply({
          content: `✅ Alarm dengan ID \`${id}\` berhasil dihapus.`
        });
      } else {
        await interaction.editReply({
          content: `❌ Alarm dengan ID \`${id}\` tidak ditemukan atau Anda bukan pemilik alarm tersebut.`
        });
      }
    }
  }
};
