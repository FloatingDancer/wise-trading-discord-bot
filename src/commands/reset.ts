import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { AlertManager } from '../services/alertManager.js';
import { PeriodicManager } from '../services/periodicManager.js';
import { VolatilityManager } from '../services/volatilityManager.js';

export const ResetCommand = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Mereset pengaturan pemantauan kembali ke default')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Restricted to server administrators
    .addStringOption(option =>
      option.setName('target')
        .setDescription('Bagian pemantauan yang ingin direset')
        .setRequired(true)
        .addChoices(
          { name: 'Semua (Reset All)', value: 'all' },
          { name: 'Hanya Alarm Harga (Price Alerts Only)', value: 'alerts' },
          { name: 'Hanya Update Berkala (Periodic Updates Only)', value: 'periodic' },
          { name: 'Hanya Alarm Volatilitas (Volatility Alerts Only)', value: 'volatility' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getString('target', true);

    try {
      let resetLabel = '';

      switch (target) {
        case 'all':
          AlertManager.clearAll();
          PeriodicManager.clearAll();
          VolatilityManager.clearAll();
          resetLabel = 'Semua data (Alarm Harga, Update Berkala, dan Alarm Volatilitas)';
          break;
        case 'alerts':
          AlertManager.clearAll();
          resetLabel = 'Hanya data Alarm Harga';
          break;
        case 'periodic':
          PeriodicManager.clearAll();
          resetLabel = 'Hanya data Jadwal Update Berkala';
          break;
        case 'volatility':
          VolatilityManager.clearAll();
          resetLabel = 'Hanya data Alarm Volatilitas';
          break;
      }

      const embed = new EmbedBuilder()
        .setTitle('🔄 Reset Berhasil!')
        .setColor('#ef4444') // Red
        .setDescription(`Pengaturan untuk **${resetLabel}** telah dihapus dan dikembalikan ke default.`)
        .setTimestamp()
        .setFooter({ text: 'Wise Trading Reset System' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ Gagal melakukan reset: ${error.message}`
      });
    }
  }
};
