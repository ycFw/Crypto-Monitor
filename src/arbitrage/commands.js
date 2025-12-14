/**
 * 套利监控命令处理
 */

import { ARBITRAGE_CONFIG } from './config.js';
import { sendTelegramMessage } from './notifier.js';

let lastUpdateId = 0;
let stats = null; // 将由主程序设置

/**
 * 设置统计数据引用
 */
export function setStats(statsRef) {
  stats = statsRef;
}

/**
 * 获取 Telegram 更新
 */
async function getUpdates() {
  const url = `https://api.telegram.org/bot${ARBITRAGE_CONFIG.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=1`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.ok || !data.result.length) {
      return [];
    }
    
    lastUpdateId = data.result[data.result.length - 1].update_id;
    return data.result;
  } catch (error) {
    console.error('[Commands] Failed to get updates:', error.message);
    return [];
  }
}

/**
 * 初始化 - 跳过旧消息
 */
export async function initCommands() {
  try {
    const url = `https://api.telegram.org/bot${ARBITRAGE_CONFIG.TELEGRAM_BOT_TOKEN}/getUpdates`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.ok && data.result.length > 0) {
      lastUpdateId = data.result[data.result.length - 1].update_id;
      await fetch(`${url}?offset=${lastUpdateId + 1}`);
      console.log('[Commands] Cleared old messages');
    }
  } catch (error) {
    console.error('[Commands] Init error:', error.message);
  }
}

/**
 * 检查并处理命令
 */
export async function checkCommands() {
  const updates = await getUpdates();
  
  for (const update of updates) {
    const message = update.message;
    if (!message || !message.text) continue;
    
    const chatId = message.chat.id.toString();
    
    // 只处理来自配置的 chat 的消息
    if (chatId !== ARBITRAGE_CONFIG.TELEGRAM_CHAT_ID) continue;
    
    const text = message.text.trim();
    
    // 处理命令
    if (text.startsWith('/arb_help') || text.startsWith('/arb')) {
      await handleHelp();
    } else if (text.startsWith('/arb_status')) {
      await handleStatus();
    } else if (text.startsWith('/arb_markets')) {
      await handleMarkets();
    } else if (text.startsWith('/arb_threshold')) {
      await handleThreshold(text);
    }
  }
}

/**
 * /arb_help - 显示帮助
 */
async function handleHelp() {
  const message = `
🎰 <b>套利监控 Bot</b>

可用命令：
/arb_help - 显示帮助
/arb_status - 查看监控状态
/arb_markets - 查看已匹配的市场数
/arb_threshold - 查看当前阈值设置

自动通知：
• 发现套利机会时推送（≤${ARBITRAGE_CONFIG.THRESHOLD * 100}¢）
• 利润率 3%-50% 之间

监控平台：
• Opinion.trade
• Polymarket
`.trim();
  
  await sendTelegramMessage(message);
}

/**
 * /arb_status - 显示状态
 */
async function handleStatus() {
  if (!stats) {
    await sendTelegramMessage('⚠️ 统计数据未初始化');
    return;
  }
  
  const uptime = getUptime(stats.startTime);
  
  const message = `
📊 <b>套利监控状态</b>

✅ 运行状态: 正常
⏱️ 运行时长: ${uptime}
🔍 扫描次数: ${stats.scanCount}
💰 发现机会: ${stats.totalOpportunities}
📨 发送通知: ${stats.notificationsSent}

⚙️ 配置:
├ 套利阈值: ≤${ARBITRAGE_CONFIG.THRESHOLD * 100}¢
├ 扫描间隔: ${ARBITRAGE_CONFIG.POLL_INTERVAL / 1000}秒
└ 手续费率: ${ARBITRAGE_CONFIG.FEE_RATE * 100}%

📈 最近机会: ${stats.lastOpportunity || '暂无'}
⏰ 上次扫描: ${stats.lastScanTime || '未开始'}
`.trim();
  
  await sendTelegramMessage(message);
}

/**
 * /arb_markets - 显示市场信息
 */
async function handleMarkets() {
  if (!stats) {
    await sendTelegramMessage('⚠️ 统计数据未初始化');
    return;
  }
  
  const message = `
📊 <b>市场匹配信息</b>

Opinion 市场: ${stats.opinionMarkets || 0}
Polymarket 市场: ${stats.polymarketMarkets || 0}
已匹配市场对: ${stats.matchedPairs || 0}

主要匹配类型:
• 美联储 (Fed/FOMC) 利率决议
• 欧洲央行 (ECB) 利率决议
• 日本央行 (BoJ) 利率决议
`.trim();
  
  await sendTelegramMessage(message);
}

/**
 * /arb_threshold - 显示阈值设置
 */
async function handleThreshold(text) {
  const message = `
⚙️ <b>套利阈值设置</b>

当前阈值: ≤<b>${ARBITRAGE_CONFIG.THRESHOLD * 100}¢</b>

说明:
• YES价格 + NO价格 ≤ ${ARBITRAGE_CONFIG.THRESHOLD * 100}¢ 时触发通知
• 预留 ${((1 - ARBITRAGE_CONFIG.THRESHOLD) * 100).toFixed(0)}% 利润空间
• 需覆盖约 ${ARBITRAGE_CONFIG.FEE_RATE * 100}% 手续费

修改阈值请设置环境变量:
<code>ARBITRAGE_THRESHOLD=0.95</code>
`.trim();
  
  await sendTelegramMessage(message);
}

/**
 * 计算运行时长
 */
function getUptime(startTime) {
  const ms = Date.now() - startTime;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}
