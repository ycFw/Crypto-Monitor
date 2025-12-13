/**
 * 命令处理器
 * 处理 Telegram Bot 命令
 */

import { CONFIG } from './config.js';
import { sendMessage, getUpdates, parseCommand } from './telegram.js';
import { formatPositionMessage } from './okx.js';
import { getTraderPosition, getAllPositions } from './monitor.js';

/**
 * 处理命令
 */
async function handleCommand(cmd, chatId) {
  const { command, args } = cmd;
  
  switch (command) {
    case '/start':
    case '/help':
      await sendMessage(`
🤖 <b>OKX 交易员监控 Bot</b>

<b>可用命令：</b>
/pos - 查看所有交易员持仓
/pos1 - 查看 ${CONFIG.TRADERS[0]?.name || '交易员1'}
/pos2 - 查看 ${CONFIG.TRADERS[1]?.name || '交易员2'}
/status - 查看监控状态
/help - 显示帮助

<b>自动通知：</b>
• 开仓/平仓
• 加仓/减仓 (>1%)
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
📊 <b>监控状态</b>

✅ 服务运行中
⏱️ 检查间隔: ${CONFIG.POSITION_POLL_INTERVAL / 1000}秒

<b>监控交易员：</b>
${traderList}
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
