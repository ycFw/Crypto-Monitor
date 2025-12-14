/**
 * 套利检测引擎
 * 检测跨平台套利机会
 */

import { ARBITRAGE_CONFIG } from './config.js';

/**
 * 检测套利机会
 * @param {Array} matchedPairs - 匹配的市场对
 * @returns {Array} 套利机会列表
 */
export function detectArbitrage(matchedPairs) {
  const opportunities = [];
  
  for (const pair of matchedPairs) {
    const { opinion, polymarket } = pair;
    
    // 跳过价格异常的市场（价格为 0 或接近 0）
    if (opinion.yesPrice < 0.001 || opinion.noPrice < 0.001) continue;
    if (polymarket.yesPrice < 0.001 || polymarket.noPrice < 0.001) continue;
    
    // 策略1: 买 Opinion YES + 买 Polymarket NO
    const combo1 = opinion.yesPrice + polymarket.noPrice;
    const profit1Pct = (1 - combo1) / combo1 * 100;
    
    // 只接受合理的套利（总成本在 0.5-0.97 之间，利润在 3%-50% 之间）
    if (combo1 <= ARBITRAGE_CONFIG.THRESHOLD && combo1 >= 0.5 && profit1Pct <= 50 && profit1Pct >= 3) {
      opportunities.push({
        type: 'opinion_yes_poly_no',
        pair: pair,
        opinionSide: 'YES',
        polymarketSide: 'NO',
        opinionPrice: opinion.yesPrice,
        polymarketPrice: polymarket.noPrice,
        totalCost: combo1,
        profit: 1 - combo1,
        profitPercent: profit1Pct.toFixed(2),
        description: `买 Opinion YES @${opinion.yesPrice.toFixed(3)} + 买 Polymarket NO @${polymarket.noPrice.toFixed(3)}`
      });
    }
    
    // 策略2: 买 Opinion NO + 买 Polymarket YES
    const combo2 = opinion.noPrice + polymarket.yesPrice;
    const profit2Pct = (1 - combo2) / combo2 * 100;
    
    if (combo2 <= ARBITRAGE_CONFIG.THRESHOLD && combo2 >= 0.5 && profit2Pct <= 50 && profit2Pct >= 3) {
      opportunities.push({
        type: 'opinion_no_poly_yes',
        pair: pair,
        opinionSide: 'NO',
        polymarketSide: 'YES',
        opinionPrice: opinion.noPrice,
        polymarketPrice: polymarket.yesPrice,
        totalCost: combo2,
        profit: 1 - combo2,
        profitPercent: profit2Pct.toFixed(2),
        description: `买 Opinion NO @${opinion.noPrice.toFixed(3)} + 买 Polymarket YES @${polymarket.yesPrice.toFixed(3)}`
      });
    }
  }
  
  // 按利润率排序（高到低）
  opportunities.sort((a, b) => b.profit - a.profit);
  
  return opportunities;
}

/**
 * 过滤已通知的机会（防止重复通知）
 */
const notifiedOpportunities = new Map(); // key -> timestamp

export function filterNewOpportunities(opportunities) {
  const now = Date.now();
  const newOpps = [];
  
  for (const opp of opportunities) {
    const key = generateOpportunityKey(opp);
    const lastNotified = notifiedOpportunities.get(key);
    
    // 如果从未通知过，或者距离上次通知超过冷却时间
    if (!lastNotified || (now - lastNotified) > ARBITRAGE_CONFIG.NOTIFICATION_COOLDOWN) {
      newOpps.push(opp);
      notifiedOpportunities.set(key, now);
    }
  }
  
  // 清理过期记录
  cleanupOldNotifications();
  
  return newOpps;
}

/**
 * 生成机会的唯一标识
 */
function generateOpportunityKey(opp) {
  const { pair, type } = opp;
  return `${pair.opinion.id}-${pair.polymarket.id}-${type}`;
}

/**
 * 清理过期的通知记录
 */
function cleanupOldNotifications() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24小时
  
  for (const [key, timestamp] of notifiedOpportunities) {
    if (now - timestamp > maxAge) {
      notifiedOpportunities.delete(key);
    }
  }
}

/**
 * 计算预期收益
 * @param {Object} opportunity - 套利机会
 * @param {number} investment - 投资金额（美元）
 * @returns {Object} 收益详情
 */
export function calculateExpectedReturn(opportunity, investment = 100) {
  const { totalCost, profit, opinionPrice, polymarketPrice } = opportunity;
  
  // 每份成本
  const costPerShare = totalCost;
  
  // 可购买份数
  const shares = investment / costPerShare;
  
  // 预期收益
  const expectedProfit = shares * profit;
  
  // 考虑手续费后的收益（假设各平台 2% 手续费）
  const feeRate = ARBITRAGE_CONFIG.FEE_RATE;
  const opinionFee = investment * (opinionPrice / totalCost) * feeRate;
  const polymarketFee = investment * (polymarketPrice / totalCost) * feeRate;
  const totalFees = opinionFee + polymarketFee;
  
  const netProfit = expectedProfit - totalFees;
  const netProfitPercent = (netProfit / investment * 100).toFixed(2);
  
  return {
    investment,
    shares: shares.toFixed(2),
    grossProfit: expectedProfit.toFixed(2),
    fees: totalFees.toFixed(2),
    netProfit: netProfit.toFixed(2),
    netProfitPercent,
    isProfitable: netProfit > 0
  };
}

/**
 * 分析市场流动性
 */
export function analyzeLiquidity(opportunity) {
  const { pair } = opportunity;
  
  const opinionVolume = pair.opinion.volume || 0;
  const polymarketVolume = pair.polymarket.volume || 0;
  const polymarketLiquidity = pair.polymarket.liquidity || 0;
  
  // 流动性评级
  let rating = 'LOW';
  if (opinionVolume > 100000 && polymarketVolume > 100000) {
    rating = 'HIGH';
  } else if (opinionVolume > 10000 && polymarketVolume > 10000) {
    rating = 'MEDIUM';
  }
  
  return {
    opinionVolume,
    polymarketVolume,
    polymarketLiquidity,
    rating
  };
}

/**
 * 获取完整的套利分析
 */
export function getFullAnalysis(opportunity, investment = 100) {
  const returns = calculateExpectedReturn(opportunity, investment);
  const liquidity = analyzeLiquidity(opportunity);
  
  return {
    ...opportunity,
    returns,
    liquidity,
    recommendation: generateRecommendation(opportunity, returns, liquidity)
  };
}

/**
 * 生成操作建议
 */
function generateRecommendation(opportunity, returns, liquidity) {
  if (!returns.isProfitable) {
    return '⚠️ 扣除手续费后无利润';
  }
  
  if (liquidity.rating === 'LOW') {
    return '⚠️ 流动性较低，谨慎操作';
  }
  
  if (parseFloat(returns.netProfitPercent) > 3) {
    return '✅ 推荐套利';
  }
  
  return '🔍 可考虑，利润空间较小';
}
