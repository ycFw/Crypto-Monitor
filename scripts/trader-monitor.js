/**
 * OKX 交易员持仓监控服务
 * 监控指定交易员的持仓变化，并通过 Telegram 发送通知
 */

// ============ 配置 ============
const CONFIG = {
  // Telegram Bot
  TELEGRAM_BOT_TOKEN: '8459014132:AAF0WBtQOaQ3aAI_-HHayfwKBv0Cd_r2PkU',
  TELEGRAM_CHAT_ID: '-1003607111369',
  
  // 监控的交易员列表
  TRADERS: [
    {
      uniqueName: 'BAE096C1DD31D029',
      name: '比特神教-八星斗皇'
    },
    {
      uniqueName: 'E3565047AD593661',
      name: '茂茂大魔王'
    }
  ],
  
  // 轮询间隔 (毫秒)
  POLL_INTERVAL: 30000,  // 30秒
};

// ============ 状态存储 ============
const positionCache = new Map();  // traderId -> positions

// ============ Telegram 通知 ============
async function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram API error:', result);
    }
    return result;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
  }
}

// ============ OKX API ============
async function fetchTraderPositions(uniqueName) {
  const timestamp = Date.now();
  const url = `https://www.okx.com/priapi/v5/ecotrade/public/community/user/position-current?uniqueName=${uniqueName}&t=${timestamp}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.okx.com/'
      }
    });
    
    const data = await response.json();
    
    if (data.code !== '0') {
      console.error('OKX API error:', data);
      return null;
    }
    
    // 提取持仓数据
    const posData = data.data?.[0]?.posData || [];
    return posData;
  } catch (error) {
    console.error('Failed to fetch positions:', error);
    return null;
  }
}

// ============ 持仓变化检测 ============
function detectChanges(traderId, traderName, newPositions, oldPositions) {
  const changes = [];
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  
  // 使用 instId + posSide 作为唯一标识
  const getKey = (p) => `${p.instId}_${p.posSide}`;
  
  const oldMap = new Map(oldPositions.map(p => [getKey(p), p]));
  const newMap = new Map(newPositions.map(p => [getKey(p), p]));
  
  // 检测新开仓
  for (const [key, pos] of newMap) {
    if (!oldMap.has(key)) {
      const direction = pos.posSide === 'long' || (pos.posSide === 'net' && parseFloat(pos.pos) > 0) 
        ? '🟢 开多' : '🔴 开空';
      
      changes.push({
        type: 'OPEN',
        message: `
<b>${direction}</b> | ${traderName}

📊 <b>${pos.instId}</b>
💰 开仓均价: $${parseFloat(pos.avgPx).toFixed(2)}
📈 杠杆: ${pos.lever}x
💵 仓位价值: $${formatNumber(pos.notionalUsd)}
📦 数量: ${pos.pos}
🕐 ${now}
        `.trim()
      });
    }
  }
  
  // 检测平仓
  for (const [key, pos] of oldMap) {
    if (!newMap.has(key)) {
      const direction = pos.posSide === 'long' || (pos.posSide === 'net' && parseFloat(pos.pos) > 0)
        ? '🟢 平多' : '🔴 平空';
      
      changes.push({
        type: 'CLOSE',
        message: `
<b>${direction}</b> | ${traderName}

📊 <b>${pos.instId}</b>
💰 开仓均价: $${parseFloat(pos.avgPx).toFixed(2)}
📦 数量: ${pos.pos}
🕐 ${now}
        `.trim()
      });
    }
  }
  
  // 检测加仓/减仓
  for (const [key, newPos] of newMap) {
    const oldPos = oldMap.get(key);
    if (oldPos) {
      const oldSize = Math.abs(parseFloat(oldPos.pos));
      const newSize = Math.abs(parseFloat(newPos.pos));
      
      // 只有数量变化超过 1% 才通知
      if (oldSize > 0 && Math.abs(newSize - oldSize) / oldSize > 0.01) {
        const action = newSize > oldSize ? '➕ 加仓' : '➖ 减仓';
        const diffPercent = ((newSize - oldSize) / oldSize * 100).toFixed(2);
        
        changes.push({
          type: 'ADJUST',
          message: `
<b>${action}</b> | ${traderName}

📊 <b>${newPos.instId}</b>
📦 数量变化: ${oldPos.pos} → ${newPos.pos} (${newSize > oldSize ? '+' : ''}${diffPercent}%)
💵 仓位价值: $${formatNumber(newPos.notionalUsd)}
💰 未实现盈亏: $${formatNumber(newPos.upl)}
🕐 ${now}
          `.trim()
        });
      }
    }
  }
  
  return changes;
}

// 格式化数字
function formatNumber(num) {
  const n = parseFloat(num);
  if (Math.abs(n) >= 1000000) {
    return (n / 1000000).toFixed(2) + 'M';
  }
  if (Math.abs(n) >= 1000) {
    return (n / 1000).toFixed(2) + 'K';
  }
  return n.toFixed(2);
}

// ============ 主监控逻辑 ============
async function monitorTrader(trader) {
  const { uniqueName, name } = trader;
  
  const positions = await fetchTraderPositions(uniqueName);
  
  if (positions === null) {
    console.log(`[${name}] Failed to fetch positions`);
    return;
  }
  
  const cacheKey = uniqueName;
  const cachedPositions = positionCache.get(cacheKey) || [];
  
  // 首次运行，只缓存不通知
  if (!positionCache.has(cacheKey)) {
    positionCache.set(cacheKey, positions);
    console.log(`[${name}] Initial cache: ${positions.length} positions`);
    
    // 发送当前持仓汇总
    if (positions.length > 0) {
      let summary = `📋 <b>${name}</b> 当前持仓\n\n`;
      for (const pos of positions) {
        const direction = pos.posSide === 'long' || pos.posSide === 'net' ? '🟢多' : '🔴空';
        const upl = parseFloat(pos.upl);
        summary += `${direction} <b>${pos.instId}</b>\n`;
        summary += `   💰 $${parseFloat(pos.avgPx).toFixed(2)} | ${pos.lever}x\n`;
        summary += `   💵 $${formatNumber(pos.notionalUsd)} | 盈亏: ${upl >= 0 ? '+' : ''}$${formatNumber(upl)}\n\n`;
      }
      await sendTelegramMessage(summary.trim());
    } else {
      await sendTelegramMessage(`📋 <b>${name}</b> 当前无持仓`);
    }
    return;
  }
  
  // 检测变化
  const changes = detectChanges(uniqueName, name, positions, cachedPositions);
  
  // 发送通知
  for (const change of changes) {
    console.log(`[${name}] ${change.type}:`, change.message.replace(/<[^>]*>/g, ''));
    await sendTelegramMessage(change.message);
    // 避免发送过快
    await new Promise(r => setTimeout(r, 500));
  }
  
  // 更新缓存
  positionCache.set(cacheKey, positions);
}

async function runMonitor() {
  console.log('Starting monitor cycle...');
  
  for (const trader of CONFIG.TRADERS) {
    await monitorTrader(trader);
    // 交易员之间间隔
    await new Promise(r => setTimeout(r, 1000));
  }
}

// ============ 启动 ============
async function main() {
  console.log('='.repeat(50));
  console.log('🚀 OKX Trader Monitor Started');
  console.log(`📡 Monitoring ${CONFIG.TRADERS.length} trader(s)`);
  console.log(`⏱️  Poll interval: ${CONFIG.POLL_INTERVAL / 1000}s`);
  console.log('='.repeat(50));
  
  // 发送启动通知
  await sendTelegramMessage(`
🚀 <b>监控服务已启动</b>

📡 监控交易员: ${CONFIG.TRADERS.map(t => t.name).join(', ')}
⏱️ 轮询间隔: ${CONFIG.POLL_INTERVAL / 1000}秒

开始监控持仓变化...
  `.trim());
  
  // 首次运行
  await runMonitor();
  
  // 定时轮询
  setInterval(runMonitor, CONFIG.POLL_INTERVAL);
}

main().catch(console.error);
