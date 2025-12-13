/**
 * Configuration file
 * Centralized management of all sensitive info and settings
 */

export const CONFIG = {
  // Telegram Bot
  TELEGRAM_BOT_TOKEN: '8459014132:AAF0WBtQOaQ3aAI_-HHayfwKBv0Cd_r2PkU',
  TELEGRAM_CHAT_ID: '-1003607111369',
  
  // Traders to monitor
  TRADERS: [
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
  POSITION_POLL_INTERVAL: 30000,  // 30s - position monitoring
  COMMAND_POLL_INTERVAL: 2000,    // 2s - command checking
};
