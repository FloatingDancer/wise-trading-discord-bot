import { Client, GatewayIntentBits, Interaction } from 'discord.js';
import * as dotenv from 'dotenv';
import { PriceCommand } from './commands/price.js';
import { ChartCommand } from './commands/chart.js';
import { AlertCommand } from './commands/alert.js';
import { WatchlistCommand } from './commands/watchlist.js';
import { PeriodicCommand } from './commands/periodic.js';
import { VolatilityCommand } from './commands/volatility.js';
import { ResetCommand } from './commands/reset.js';
import { HelpCommand } from './commands/help.js';
import { AlertManager } from './services/alertManager.js';
import { PeriodicManager } from './services/periodicManager.js';
import { VolatilityManager } from './services/volatilityManager.js';

// Load environment variables
dotenv.config();

const token = process.env.DISCORD_TOKEN;

if (!token || token === 'your_bot_token_here') {
  console.warn('⚠️ Warning: DISCORD_TOKEN belum diisi atau masih menggunakan placeholder di .env.');
  console.warn('⚠️ Bot tidak akan bisa login sampai token Discord yang valid ditambahkan.');
}

// Initialize Databases
AlertManager.init();
PeriodicManager.init();
VolatilityManager.init();

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds // Required for slash commands and interactions
  ]
});

// When the client is ready, run this code (only once)
client.once('ready', (c) => {
  console.log(`🚀 Bot siap! Login sebagai ${c.user.tag}`);
  
  // Set bot activity status
  c.user.setActivity({
    name: 'memantau saham/crypto/forex',
    type: 3 // Watching
  });

  // Start alert monitoring cycle (every 60 seconds)
  AlertManager.startMonitoring(c, 60000);

  // Start volatility checking cycle (every 60 seconds)
  setInterval(() => {
    VolatilityManager.checkVolatilityAlerts(c).catch((err) => {
      console.error('Error in volatility check interval:', err);
    });
  }, 60000);

  // Start periodic updates scheduler (every 5 minutes)
  PeriodicManager.startScheduler(c, 300000);
});

// Handle Slash Command interactions
client.on('interactionCreate', async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'price':
        await PriceCommand.execute(interaction);
        break;
      case 'chart':
        await ChartCommand.execute(interaction);
        break;
      case 'alert':
        await AlertCommand.execute(interaction);
        break;
      case 'watchlist':
        await WatchlistCommand.execute(interaction);
        break;
      case 'periodic':
        await PeriodicCommand.execute(interaction);
        break;
      case 'volatility':
        await VolatilityCommand.execute(interaction);
        break;
      case 'reset':
        await ResetCommand.execute(interaction);
        break;
      case 'help':
        await HelpCommand.execute(interaction);
        break;
      default:
        await interaction.reply({ content: 'Command tidak dikenali.', ephemeral: true });
    }
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
    
    // Ensure we send an error message even if command deferred or crashed
    const errorMessage = '❌ Terjadi kesalahan internal saat memproses command ini.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
    }
  }
});

// Graceful Shutdown
const handleShutdown = () => {
  console.log('⏳ Mematikan bot secara aman...');
  client.destroy();
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// Login to Discord with your client's token
if (token && token !== 'your_bot_token_here') {
  client.login(token).catch((err) => {
    console.error('❌ Gagal login ke Discord. Periksa apakah Token Anda valid:', err.message);
  });
}
