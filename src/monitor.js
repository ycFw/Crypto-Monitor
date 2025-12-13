/**
 * 持仓监控服务
 * 检测持仓变化并发送通知
 */

import { CONFIG } from './config.js';
import { sendMessage } from './telegram.js';
import { fetchTraderPositions, formatNumber, formatPositionMessage, formatPnL, isCoinMargined } from './okx.js';

// 持仓缓存
const positionCache = new Map();

/**
 * 检测持仓变化
 */
function detectChanges(trader, newPositions, oldPositions) {
  const changes = [];
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  
  // 使用 instId + posSide 作为唯一标识
  const getKey = (p) => `${p.instId}_${p.posSide}`;
  
  const oldMap = new Map(oldPositions.map(p => [getKey(p), p]));
  const newMap = new Map(newPositions.map(p => [getKey(p), p]));
  
  // 检测新开仓
  for (const [key, pos] of newMap) {
    if (!oldMap.has(key)) {
      const direction = pos.posSide === 'short' ? '🔴 开空' : '🟢 开多';
      const marginType = isCoinMargined(pos.instId) ? ' 📦币本位' : '';
      
      changes.push({
        type: 'OPEN',
        message: `
<b>${direction}</b> | ${trader.emoji} ${trader.name}

📊 <b>${pos.instId}</b>${marginType}
💰 开仓均价: $${parseFloat(pos.avgPx).toFixed(2)}
📈 杠杆: ${pos.lever}x
💵 仓位价值: $${formatNumber(pos.notionalUsd)}
🕐 ${now}
        `.trim()
      });
    }
  }
  
  // 检测平仓
  for (const [key, pos] of oldMap) {
    if (!newMap.has(key)) {
      const direction = pos.posSide === 'short' ? '🔴 平空' : '🟢 平多';
      const pnlStr = formatPnL(pos.upl, pos.instId);
      
      changes.push({
        type: 'CLOSE',
        message: `
<b>${direction}</b> | ${trader.emoji} ${trader.name}

📊 <b>${pos.instId}</b>
💰 开仓均价: $${parseFloat(pos.avgPx).toFixed(2)}
💵 盈亏: ${pnlStr}
🕐 ${now}
        `.trim()
      });
    }
  }
  
  // 检测加仓/减仓 (变化超过 10%)
  for (const [key, newPos] of newMap) {
    const oldPos = oldMap.get(key);
    if (oldPos) {
      const oldSize = Math.abs(parseFloat(oldPos.pos));
      const newSize = Math.abs(parseFloat(newPos.pos));
      
      if (oldSize > 0 && Math.abs(newSize - oldSize) / oldSize > 0.10) {
        const action = newSize > oldSize ? '➕ 加仓' : '➖ 减仓';
        const diffPercent = ((newSize - oldSize) / oldSize * 100).toFixed(2);
        const pnlStr = formatPnL(newPos.upl, newPos.instId);
        
        changes.push({
          type: 'ADJUST',
          message: `
<b>${action}</b> | ${trader.emoji} ${trader.name}

📊 <b>${newPos.instId}</b>
📦 数量变化: ${oldPos.pos} → ${newPos.pos} (${newSize > oldSize ? '+' : ''}${diffPercent}%)
💵 仓位价值: $${formatNumber(newPos.notionalUsd)}
💰 未实现盈亏: ${pnlStr}
🕐 ${now}
          `.trim()
        });
      }
    }
  }
  
  return changes;
}

/**
 * 监控单个交易员
 */
async function monitorTrader(trader, isFirstRun = false) {
  const positions = await fetchTraderPositions(trader.uniqueName);
  
  if (positions === null) {
    console.log(`[${trader.name}] Failed to fetch positions`);
    return;
  }
  
  const cachedPositions = positionCache.get(trader.uniqueName) || [];
  
  // 首次运行，缓存并发送当前持仓
  if (!positionCache.has(trader.uniqueName)) {
    positionCache.set(trader.uniqueName, positions);
    console.log(`[${trader.name}] Initial cache: ${positions.length} positions`);
    
    if (isFirstRun) {
      await sendMessage(formatPositionMessage(trader, positions));
    }
    return;
  }
  
  // 检测变化
  const changes = detectChanges(trader, positions, cachedPositions);
  
  // 发送通知
  for (const change of changes) {
    console.log(`[${trader.name}] ${change.type}`);
    await sendMessage(change.message);
    await sleep(500);
  }
  
  // 更新缓存
  positionCache.set(trader.uniqueName, positions);
}

/**
 * 运行监控周期
 */
export async function runMonitorCycle(isFirstRun = false) {
  console.log(`[${new Date().toLocaleTimeString()}] Checking positions...`);
  
  for (const trader of CONFIG.TRADERS) {
    await monitorTrader(trader, isFirstRun);
    await sleep(1000);
  }
}

/**
 * 获取指定交易员的当前持仓
 */
export async function getTraderPosition(traderId) {
  const trader = CONFIG.TRADERS.find(t => t.id === traderId || t.uniqueName === traderId);
  if (!trader) return null;
  
  const positions = await fetchTraderPositions(trader.uniqueName);
  return { trader, positions };
}

/**
 * 获取所有交易员的当前持仓
 */
export async function getAllPositions() {
  const results = [];
  for (const trader of CONFIG.TRADERS) {
    const positions = await fetchTraderPositions(trader.uniqueName);
    results.push({ trader, positions });
    await sleep(500);
  }
  return results;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
