/**
 * 命令处理器
 * 处理 Telegram Bot 命令（包括 OKX 监控 + 套利监控）
 */

import { CONFIG } from './config.js';
import { sendMessage, getUpdates, parseCommand } from './telegram.js';
import { formatPositionMessage } from './okx.js';
import { getTraderPosition, getAllPositions } from './monitor.js';

// 套利监控配置（从环境变量读取，与套利服务保持一致）
const ARB_CONFIG = {
  THRESHOLD: parseFloat(process.env.ARBITRAGE_THRESHOLD) || 0.97,
  FEE_RATE: parseFloat(process.env.FEE_RATE) || 0.02,
  POLL_INTERVAL: parseInt(process.env.ARBITRAGE_POLL_INTERVAL) || 30000,
};

/**
 * 处理命令
 */
async function handleCommand(cmd, chatId) {
  const { command, args } = cmd;
  
  switch (command) {
    case '/start':
    case '/help':
      await sendMessage(`
🤖 <b>监控 Bot 帮助</b>

<b>📈 OKX 交易员监控：</b>
/pos - 查看所有交易员持仓
/pos1 - 查看 ${CONFIG.TRADERS[0]?.name || '交易员1'}
/pos2 - 查看 ${CONFIG.TRADERS[1]?.name || '交易员2'}
/status - 查看 OKX 监控状态

<b>🎰 套利监控：</b>
/arb - 套利监控帮助
/arb_status - 查看套利监控配置
/arb_markets - 查看监控平台
/arb_threshold - 查看阈值设置

<b>自动通知：</b>
• OKX: 开仓/平仓/加减仓
• 套利: 发现机会时推送
      `.trim(), chatId);
      break;
      
    case '/pos':
    case '/positions':
      const allResults = await getAllPositions();
      for (const { trader, positions } of allResults) {
        await sendMessage(formatPositionMessage(trader, positions), chatId);
        await sleep(300);
      }
      break;
      
    case '/pos1':
      if (CONFIG.TRADERS[0]) {
        const result1 = await getTraderPosition(CONFIG.TRADERS[0].uniqueName);
        if (result1) {
          await sendMessage(formatPositionMessage(result1.trader, result1.positions), chatId);
        }
      }
      break;
      
    case '/pos2':
      if (CONFIG.TRADERS[1]) {
        const result2 = await getTraderPosition(CONFIG.TRADERS[1].uniqueName);
        if (result2) {
          await sendMessage(formatPositionMessage(result2.trader, result2.positions), chatId);
        }
      }
      break;
      
    case '/status':
      const traderList = CONFIG.TRADERS.map(t => `${t.emoji} ${t.name}`).join('\n');
      await sendMessage(`
📊 <b>OKX 监控状态</b>

✅ 服务运行中
⏱️ 检查间隔: ${CONFIG.POSITION_POLL_INTERVAL / 1000}秒

<b>监控交易员：</b>
${traderList}
      `.trim(), chatId);
      break;
    
    // ===== 套利监控命令 =====
    case '/arb':
    case '/arb_help':
      await sendMessage(`
🎰 <b>套利监控 Bot</b>

<b>可用命令：</b>
/arb_help - 显示本帮助
/arb_status - 查看监控配置
/arb_markets - 查看监控平台
/arb_threshold - 查看阈值设置

<b>自动通知：</b>
• 发现套利机会时推送（≤${ARB_CONFIG.THRESHOLD * 100}¢）
• 利润率 3%-50% 之间

<b>套利原理：</b>
在 A 平台买 YES + B 平台买 NO
如果总成本 < $1，最终必有一方获利
      `.trim(), chatId);
      break;
    
    case '/arb_status':
      await sendMessage(`
📊 <b>套利监控配置</b>

⚙️ <b>当前配置：</b>
├ 套利阈值: ≤${ARB_CONFIG.THRESHOLD * 100}¢
├ 扫描间隔: ${ARB_CONFIG.POLL_INTERVAL / 1000}秒
└ 手续费率: ${ARB_CONFIG.FEE_RATE * 100}%

ℹ️ 套利监控作为独立服务运行
实时状态请查看 Railway 日志

<b>Railway 控制台：</b>
https://railway.app/dashboard
      `.trim(), chatId);
      break;
    
    case '/arb_markets':
      await sendMessage(`
📊 <b>监控平台</b>

<b>Opinion.trade</b>
• 链: BSC (BNB Chain)
• 类型: 宏观经济预测
• API: 需要非美国/中国 IP

<b>Polymarket</b>
• 链: Polygon
• 类型: 综合预测市场
• API: 公开访问

<b>监控市场类型：</b>
• 美联储 (Fed/FOMC) 利率决议
• 欧洲央行 (ECB) 利率决议
• 日本央行 (BoJ) 利率决议
• 其他宏观经济事件
      `.trim(), chatId);
      break;
    
    case '/arb_threshold':
      await sendMessage(`
⚙️ <b>套利阈值设置</b>

当前阈值: ≤<b>${ARB_CONFIG.THRESHOLD * 100}¢</b>

<b>说明：</b>
• YES + NO ≤ ${ARB_CONFIG.THRESHOLD * 100}¢ 时触发通知
• 预留 ${((1 - ARB_CONFIG.THRESHOLD) * 100).toFixed(0)}% 利润空间
• 需覆盖约 ${ARB_CONFIG.FEE_RATE * 100}% 手续费

<b>修改阈值：</b>
在 Railway 设置环境变量
<code>ARBITRAGE_THRESHOLD=0.95</code>
      `.trim(), chatId);
      break;
      
    default:
      // 忽略未知命令
      break;
  }
}

/**
 * 检查并处理新命令
 */
let isProcessing = false;
const processedMessageIds = new Set();

export async function checkCommands() {
  // 防止并发处理
  if (isProcessing) return;
  isProcessing = true;
  
  try {
    const updates = await getUpdates();
    
    for (const update of updates) {
      console.log(`[DEBUG] update_id=${update.update_id}, has message=${!!update.message}, has channel_post=${!!update.channel_post}`);
      
      // 只处理 channel_post（频道消息）
      const message = update.channel_post;
      if (!message || !message.text) continue;
      
      // 用 message_id 去重（这是最可靠的方式）
      const msgId = `${message.chat.id}_${message.message_id}`;
      console.log(`[DEBUG] msgId=${msgId}, already processed=${processedMessageIds.has(msgId)}`);
      
      if (processedMessageIds.has(msgId)) {
        continue;
      }
      processedMessageIds.add(msgId);
      
      // 清理旧记录
      if (processedMessageIds.size > 500) {
        const arr = Array.from(processedMessageIds);
        arr.slice(0, 250).forEach(id => processedMessageIds.delete(id));
      }
      
      const cmd = parseCommand(message.text);
      if (!cmd) continue;
      
      const chatId = message.chat.id;
      console.log(`[Command] ${cmd.command} (msg:${message.message_id}) - EXECUTING`);
      
      await handleCommand(cmd, chatId);
    }
  } finally {
    isProcessing = false;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
