/**
 * 套利监控配置
 */

// 验证必需的环境变量
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

export const ARBITRAGE_CONFIG = {
  // Telegram 配置（复用现有配置）
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  
  // 套利阈值：YES + NO 总价格 <= 此值时视为套利机会
  // 0.97 = 97¢，预留 3% 利润空间
  THRESHOLD: parseFloat(process.env.ARBITRAGE_THRESHOLD) || 0.97,
  
  // 手续费率（用于计算净利润）
  // Polymarket ~2%, Opinion ~1%
  FEE_RATE: parseFloat(process.env.FEE_RATE) || 0.02,
  
  // 轮询间隔（毫秒）
  POLL_INTERVAL: parseInt(process.env.ARBITRAGE_POLL_INTERVAL) || 30000,
  
  // 通知冷却时间（同一机会多久后才能再次通知）
  NOTIFICATION_COOLDOWN: parseInt(process.env.NOTIFICATION_COOLDOWN) || 5 * 60 * 1000, // 5分钟
  
  // 每轮最多发送几条详细通知
  MAX_NOTIFICATIONS_PER_CYCLE: parseInt(process.env.MAX_NOTIFICATIONS) || 3,
  
  // 最低流动性要求（美元）
  MIN_LIQUIDITY: parseInt(process.env.MIN_LIQUIDITY) || 1000,
  
  // 最低利润率要求（扣除手续费后）
  MIN_PROFIT_PERCENT: parseFloat(process.env.MIN_PROFIT_PERCENT) || 1.0,
};

// 打印配置
export function printConfig() {
  console.log('='.repeat(50));
  console.log('🎰 Arbitrage Monitor Configuration');
  console.log('='.repeat(50));
  console.log(`💰 Threshold: ${ARBITRAGE_CONFIG.THRESHOLD * 100}¢`);
  console.log(`📊 Fee Rate: ${ARBITRAGE_CONFIG.FEE_RATE * 100}%`);
  console.log(`⏱️  Poll Interval: ${ARBITRAGE_CONFIG.POLL_INTERVAL / 1000}s`);
  console.log(`🔕 Notification Cooldown: ${ARBITRAGE_CONFIG.NOTIFICATION_COOLDOWN / 1000}s`);
  console.log(`📝 Max Notifications/Cycle: ${ARBITRAGE_CONFIG.MAX_NOTIFICATIONS_PER_CYCLE}`);
  console.log('='.repeat(50));
}
