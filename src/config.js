/**
 * Configuration file
 * All sensitive info loaded from environment variables
 */

// Validate required environment variables
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    console.error('Please set it in Railway dashboard or .env file');
    process.exit(1);
  }
}

export const CONFIG = {
  // Telegram Bot (required)
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  
  // Traders to monitor (can be customized via env or use defaults)
  TRADERS: process.env.TRADERS ? JSON.parse(process.env.TRADERS) : [
    {
      id: 'trader1',
      uniqueName: 'BAE096C1DD31D029',
      name: '比特神教-八星斗皇',
      emoji: '🔱'
    },
    {
      id: 'trader2',
      uniqueName: 'E3565047AD593661',
      name: '茂茂大魔王',
      emoji: '👹'
    }
  ],
  
  // Polling intervals (milliseconds)
  POSITION_POLL_INTERVAL: parseInt(process.env.POSITION_POLL_INTERVAL) || 30000,
  COMMAND_POLL_INTERVAL: parseInt(process.env.COMMAND_POLL_INTERVAL) || 2000,
};
