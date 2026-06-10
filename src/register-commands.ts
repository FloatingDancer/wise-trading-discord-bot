import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { PriceCommand } from './commands/price.js';
import { ChartCommand } from './commands/chart.js';
import { AlertCommand } from './commands/alert.js';
import { WatchlistCommand } from './commands/watchlist.js';
import { PeriodicCommand } from './commands/periodic.js';
import { VolatilityCommand } from './commands/volatility.js';
import { ResetCommand } from './commands/reset.js';
import { HelpCommand } from './commands/help.js';

// Load env variables
dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error('❌ Error: DISCORD_TOKEN dan DISCORD_CLIENT_ID harus didefinisikan di file .env!');
  process.exit(1);
}

// Assemble commands list
const commands = [
  PriceCommand.data.toJSON(),
  ChartCommand.data.toJSON(),
  AlertCommand.data.toJSON(),
  WatchlistCommand.data.toJSON(),
  PeriodicCommand.data.toJSON(),
  VolatilityCommand.data.toJSON(),
  ResetCommand.data.toJSON(),
  HelpCommand.data.toJSON()
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`⏳ Memulai pembaruan ${commands.length} application (/) commands...`);

    if (guildId && guildId !== 'your_development_guild_id_here' && guildId.trim() !== '') {
      // Register to a specific guild (instant)
      console.log(`🌐 Mendaftarkan command secara lokal ke Guild ID: ${guildId}`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log('✅ Berhasil mendaftarkan command secara lokal (Guild)!');
    } else {
      // Register globally (takes up to 1 hour to propagate)
      console.log('🌍 Mendaftarkan command secara global (bisa memakan waktu hingga 1 jam untuk muncul)...');
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log('✅ Berhasil mendaftarkan command secara global!');
    }
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat mendaftarkan command:', error);
  }
})();
