import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';

export const HelpCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Menampilkan panduan penggunaan dan daftar perintah bot'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true }); // Make it private so it doesn't clutter chat

    const embed = new EmbedBuilder()
      .setTitle('📚 Panduan Penggunaan Wise Trading Bot')
      .setColor('#3b82f6') // Blue
      .setDescription('Berikut adalah daftar lengkap perintah slash (/) yang tersedia pada bot beserta fungsi dan contoh penggunaannya:')
      .addFields(
        {
          name: '🔍 1. Informasi Harga Real-time',
          value: '• `/price symbol:<simbol>`\nMelihat harga aset saat ini.\n*Contoh*: `/price symbol:BTC-USD` atau `/price symbol:USDIDR=X` atau `/price symbol:BBCA.JK`',
          inline: false
        },
        {
          name: '📊 2. Grafik Historis',
          value: '• `/chart symbol:<simbol> [range:<waktu>]`\nMenampilkan grafik harga historis.\n*Contoh*: `/chart symbol:AAPL range:1 Bulan (Default)`',
          inline: false
        },
        {
          name: '🚨 3. Alarm Harga Target',
          value: '• `/alert set symbol:<simbol> condition:<kondisi> target:<harga>`\nMengatur alarm harga target.\n• `/alert list` - Melihat alarm aktif Anda.\n• `/alert remove id:<id>` - Menghapus alarm.\n*Contoh*: `/alert set symbol:BTC-USD condition:Naik di atas (ABOVE) target:65000`',
          inline: false
        },
        {
          name: '⚡ 4. Alarm Persentase (Volatilitas)',
          value: '• `/volatility add symbol:<simbol> percentage:<persen>`\nMengatur alarm pergerakan persentase (±%).\n• `/volatility list` - Melihat alarm aktif Anda.\n• `/volatility remove id:<id>` - Menghapus alarm.\n*Contoh*: `/volatility add symbol:ETH-USD percentage:3`',
          inline: false
        },
        {
          name: '🔔 5. Update Berkala (Otomatis)',
          value: '• `/periodic add symbol:<simbol> interval:<pilihan>`\nMengirim update harga & grafik otomatis ke channel.\n• `/periodic list` - Melihat jadwal aktif di channel.\n• `/periodic remove id:<id>` - Menghapus jadwal.\n*Contoh*: `/periodic add symbol:USDIDR=X interval:Setiap 1 Jam`',
          inline: false
        },
        {
          name: '📋 6. Watchlist Dashboard',
          value: '• `/watchlist [symbols:<simbol_dipisah_spasi>]`\nMelihat ringkasan beberapa aset sekaligus.\n*Contoh*: `/watchlist` (Default) atau `/watchlist symbols:BTC-USD TSLA AAPL`',
          inline: false
        },
        {
          name: '🔄 7. Reset Pengaturan (Khusus Admin)',
          value: '• `/reset target:<pilihan>`\nMereset database ke default.\n*Pilihan*: `Semua`, `Hanya Alarm Harga`, `Hanya Update Berkala`, atau `Hanya Alarm Volatilitas`',
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Wise Trading Help System' });

    await interaction.editReply({ embeds: [embed] });
  }
};
