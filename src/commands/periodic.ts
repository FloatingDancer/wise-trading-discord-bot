import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, ChannelType, AutocompleteInteraction } from 'discord.js';
import { FinanceService } from '../services/finance.js';
import { PeriodicManager } from '../services/periodicManager.js';
import { formatCurrency } from '../utils/format.js';

export const PeriodicCommand = {
  data: new SlashCommandBuilder()
    .setName('periodic')
    .setDescription('Mengelola update harga & grafik secara berkala (otomatis)')
    .addSubcommand(subcommand =>
      subcommand.setName('add')
        .setDescription('Menambahkan jadwal update berkala baru')
        .addStringOption(option =>
          option.setName('symbol')
            .setDescription('Simbol ticker aset (contoh: BTC-USD, USDIDR=X)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('interval')
            .setDescription('Interval pengiriman update')
            .setRequired(true)
            .addChoices(
              { name: 'Setiap 1 Menit', value: '1m' },
              { name: 'Setiap 5 Menit', value: '5m' },
              { name: 'Setiap 10 Menit', value: '10m' },
              { name: 'Setiap 30 Menit', value: '30m' },
              { name: 'Setiap 1 Jam', value: '1h' },
              { name: 'Setiap 4 Jam', value: '4h' },
              { name: 'Setiap 12 Jam', value: '12h' },
              { name: 'Setiap 24 Jam (Harian)', value: '24h' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('list')
        .setDescription('Menampilkan semua jadwal update berkala di server ini')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('remove')
        .setDescription('Menghapus jadwal update berkala berdasarkan ID')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID update berkala yang ingin dihapus')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const channelId = interaction.channelId;
    const subs = PeriodicManager.getSubscriptions().filter(s => s.channelId === channelId);

    const choices = subs
      .filter(s =>
        s.id.toLowerCase().includes(focusedValue) ||
        s.symbol.toLowerCase().includes(focusedValue)
      )
      .map(s => {
        const intervalLabel = s.interval === '24h' ? '24 Jam' :
          s.interval.endsWith('h') ? `${s.interval.replace('h', '')} Jam` :
          `${s.interval.replace('m', '')} Menit`;
        return {
          name: `${s.symbol} (Setiap ${intervalLabel}) - ID: ${s.id}`,
          value: s.id
        };
      })
      .slice(0, 25);

    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();
    const channelId = interaction.channelId;

    if (subcommand === 'add') {
      const symbol = interaction.options.getString('symbol', true);
      const interval = interaction.options.getString('interval', true) as '1m' | '5m' | '10m' | '30m' | '1h' | '4h' | '12h' | '24h';

      try {
        // Validate symbol
        const quote = await FinanceService.getQuote(symbol);

        const sub = PeriodicManager.addSubscription(symbol, interval, channelId);

        const embed = new EmbedBuilder()
          .setTitle('✅ Jadwal Update Berkala Berhasil Dibuat!')
          .setColor('#3b82f6')
          .setDescription(`Bot akan mengirimkan update harga & grafik untuk **${quote.symbol}** (${quote.name}) ke channel ini secara berkala.`)
          .addFields(
            { name: 'ID Jadwal', value: `\`${sub.id}\``, inline: true },
            { name: 'Aset', value: `${quote.symbol} (${quote.name})`, inline: true },
            { name: 'Interval', value: `Setiap ${
              interval === '24h' ? '24 Jam' : 
              interval.endsWith('h') ? `${interval.replace('h', '')} Jam` : 
              `${interval.replace('m', '')} Menit`
            }`, inline: true },
            { name: 'Harga Saat Ini', value: formatCurrency(quote.price, quote.currency), inline: true }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply({
          content: `❌ Gagal menambahkan jadwal: ${error.message}`
        });
      }
    } else if (subcommand === 'list') {
      const subs = PeriodicManager.getSubscriptions().filter(s => s.channelId === channelId);

      if (subs.length === 0) {
        await interaction.editReply({
          content: 'ℹ️ Tidak ada jadwal update berkala di channel ini.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🔔 Jadwal Update Berkala Aktif di Channel Ini')
        .setColor('#3b82f6')
        .setDescription('Berikut daftar jadwal update harga otomatis di channel ini:')
        .setTimestamp();

      subs.forEach(s => {
        embed.addFields({
          name: `${s.symbol} (ID: \`${s.id}\`)`,
          value: `Interval: **Setiap ${
            s.interval === '24h' ? '24 Jam' : 
            s.interval.endsWith('h') ? `${s.interval.replace('h', '')} Jam` : 
            `${s.interval.replace('m', '')} Menit`
          }**\nTerakhir dikirim: ${s.lastSent === new Date(0).toISOString() ? 'Belum pernah (Akan segera dikirim)' : `<t:${Math.floor(new Date(s.lastSent).getTime() / 1000)}:R>`}`,
          inline: false
        });
      });

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'remove') {
      const id = interaction.options.getString('id', true);
      const success = PeriodicManager.removeSubscription(id);

      if (success) {
        await interaction.editReply({
          content: `✅ Jadwal update berkala dengan ID \`${id}\` berhasil dihapus.`
        });
      } else {
        await interaction.editReply({
          content: `❌ Jadwal update berkala dengan ID \`${id}\` tidak ditemukan.`
        });
      }
    }
  }
};
