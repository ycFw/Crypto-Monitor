/**
 * 套利通知模块
 * 通过 Telegram 发送套利机会通知
 */

import { ARBITRAGE_CONFIG } from './config.js';

/**
 * 发送 Telegram 消息
 */
export async function sendTelegramMessage(text, chatId = ARBITRAGE_CONFIG.TELEGRAM_CHAT_ID) {
  const url = `https://api.telegram.org/bot${ARBITRAGE_CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('[Telegram] API error:', result);
    }
    return result;
  } catch (error) {
    console.error('[Telegram] Send error:', error);
    return null;
  }
}

/**
 * 格式化套利机会消息
 */
export function formatOpportunityMessage(opportunity) {
  const { pair, opinionSide, polymarketSide, opinionPrice, polymarketPrice, totalCost, profit, profitPercent } = opportunity;
  
  const profitEmoji = parseFloat(profitPercent) >= 3 ? '🔥' : '💰';
  
  return `
${profitEmoji} <b>套利机会发现!</b>

📊 <b>市场:</b> ${pair.opinion.parentTitle}
🎯 <b>选项:</b> ${pair.opinion.title}

<b>操作策略:</b>
├ Opinion: 买 <b>${opinionSide}</b> @ <code>${opinionPrice.toFixed(4)}</code>
└ Polymarket: 买 <b>${polymarketSide}</b> @ <code>${polymarketPrice.toFixed(4)}</code>

💵 <b>总成本:</b> <code>$${totalCost.toFixed(4)}</code>
📈 <b>利润:</b> <code>$${profit.toFixed(4)}</code> (<b>${profitPercent}%</b>)

🔗 <a href="https://app.opinion.trade/topic/${pair.opinion.id}">Opinion</a> | <a href="https://polymarket.com/event/${pair.polymarket.eventSlug}">Polymarket</a>

⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo' })}
`.trim();
}

/**
 * 格式化多个套利机会的摘要
 */
export function formatSummaryMessage(opportunities) {
  if (opportunities.length === 0) {
    return null;
  }
  
  const header = `🎰 <b>发现 ${opportunities.length} 个套利机会!</b>\n`;
  
  const items = opportunities.slice(0, 5).map((opp, i) => {
    const { pair, profitPercent, totalCost } = opp;
    return `${i + 1}. ${pair.opinion.title}\n   成本: $${totalCost.toFixed(3)} | 利润: ${profitPercent}%`;
  }).join('\n\n');
  
  const footer = opportunities.length > 5 
    ? `\n\n... 还有 ${opportunities.length - 5} 个机会` 
    : '';
  
  return header + '\n' + items + footer;
}

/**
 * 发送套利机会通知
 */
export async function notifyArbitrageOpportunity(opportunity) {
  const message = formatOpportunityMessage(opportunity);
  return await sendTelegramMessage(message);
}

/**
 * 发送多个套利机会通知
 */
export async function notifyMultipleOpportunities(opportunities) {
  // 发送摘要
  const summary = formatSummaryMessage(opportunities);
  if (summary) {
    await sendTelegramMessage(summary);
  }
  
  // 逐个发送详情（限制数量）
  const maxDetails = ARBITRAGE_CONFIG.MAX_NOTIFICATIONS_PER_CYCLE;
  for (let i = 0; i < Math.min(opportunities.length, maxDetails); i++) {
    await notifyArbitrageOpportunity(opportunities[i]);
    // 间隔发送避免频率限制
    await sleep(500);
  }
}

/**
 * 发送启动通知
 */
export async function notifyStartup() {
  const message = `
🚀 <b>套利监控已启动</b>

📡 监控平台: Opinion ↔ Polymarket
💰 套利阈值: ≤${ARBITRAGE_CONFIG.THRESHOLD * 100}¢
⏱️ 检查间隔: ${ARBITRAGE_CONFIG.POLL_INTERVAL / 1000}秒

发送 /arb_status 查看状态
`.trim();
  
  return await sendTelegramMessage(message);
}

/**
 * 发送状态通知
 */
export async function notifyStatus(stats) {
  const message = `
📊 <b>套利监控状态</b>

✅ 运行时长: ${stats.uptime}
🔍 扫描次数: ${stats.scanCount}
💰 发现机会: ${stats.totalOpportunities}
📨 发送通知: ${stats.notificationsSent}

📈 最近机会: ${stats.lastOpportunity || '暂无'}
⏰ 上次扫描: ${stats.lastScanTime || '未开始'}
`.trim();
  
  return await sendTelegramMessage(message);
}

/**
 * 发送错误通知
 */
export async function notifyError(error) {
  const message = `
⚠️ <b>套利监控错误</b>

${error.message || error}

⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo' })}
`.trim();
  
  return await sendTelegramMessage(message);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
