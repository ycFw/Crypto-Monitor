/**
 * 市场匹配器
 * 匹配 Opinion 和 Polymarket 上的相同事件
 */

/**
 * 匹配两个平台的市场
 * @param {Array} opinionMarkets - Opinion 市场列表
 * @param {Array} polymarketMarkets - Polymarket 市场列表
 * @returns {Array} 匹配的市场对
 */
export function matchMarkets(opinionMarkets, polymarketMarkets) {
  const matchedPairs = [];
  
  for (const opMarket of opinionMarkets) {
    // 找到 Polymarket 中匹配的市场
    const candidates = findMatchingMarkets(opMarket, polymarketMarkets);
    
    for (const polyMarket of candidates) {
      matchedPairs.push({
        opinion: opMarket,
        polymarket: polyMarket,
        matchScore: calculateMatchScore(opMarket, polyMarket),
        matchReason: getMatchReason(opMarket, polyMarket)
      });
    }
  }
  
  // 按匹配分数排序，取最佳匹配
  matchedPairs.sort((a, b) => b.matchScore - a.matchScore);
  
  // 去重：每个市场只保留最佳匹配
  const seen = new Set();
  const uniquePairs = [];
  
  for (const pair of matchedPairs) {
    const key = `${pair.opinion.id}-${pair.polymarket.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePairs.push(pair);
    }
  }
  
  return uniquePairs;
}

/**
 * 查找匹配的市场
 */
function findMatchingMarkets(opMarket, polyMarkets) {
  const matches = [];
  
  for (const polyMarket of polyMarkets) {
    const score = calculateMatchScore(opMarket, polyMarket);
    
    // 匹配阈值：至少需要 5 个关键词匹配（更严格）
    // 并且必须匹配核心关键词（央行类型）
    if (score >= 5 && hasCoreMatch(opMarket, polyMarket)) {
      matches.push(polyMarket);
    }
  }
  
  return matches;
}

/**
 * 检查是否有核心关键词匹配（央行类型必须一致）
 */
function hasCoreMatch(opMarket, polyMarket) {
  const opKeywords = new Set(opMarket.keywords);
  const polyKeywords = new Set(polyMarket.keywords);
  
  // Fed 必须匹配 Fed
  const opIsFed = opKeywords.has('fed') || opKeywords.has('fomc');
  const polyIsFed = polyKeywords.has('fed') || polyKeywords.has('fomc');
  
  // ECB 必须匹配 ECB
  const opIsECB = opKeywords.has('ecb');
  const polyIsECB = polyKeywords.has('ecb');
  
  // BoJ 必须匹配 BoJ
  const opIsBoJ = opKeywords.has('boj');
  const polyIsBoJ = polyKeywords.has('boj');
  
  // 必须是同一类型央行
  let centralBankMatch = false;
  if (opIsFed && polyIsFed) centralBankMatch = true;
  if (opIsECB && polyIsECB) centralBankMatch = true;
  if (opIsBoJ && polyIsBoJ) centralBankMatch = true;
  
  // 如果两边都不是已知央行类型，允许通过
  if (!opIsFed && !opIsECB && !opIsBoJ && !polyIsFed && !polyIsECB && !polyIsBoJ) {
    centralBankMatch = true;
  }
  
  if (!centralBankMatch) return false;
  
  // 月份也必须匹配
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const opMonth = months.find(m => opKeywords.has(m));
  const polyMonth = months.find(m => polyKeywords.has(m));
  
  // 如果两边都有月份，必须匹配
  if (opMonth && polyMonth && opMonth !== polyMonth) {
    return false;
  }
  
  return true;
}

/**
 * 计算匹配分数
 * 基于关键词重叠度
 */
function calculateMatchScore(opMarket, polyMarket) {
  const opKeywords = new Set(opMarket.keywords);
  const polyKeywords = new Set(polyMarket.keywords);
  
  let score = 0;
  
  // 计算关键词重叠
  for (const kw of opKeywords) {
    if (polyKeywords.has(kw)) {
      score += 1;
      
      // 重要关键词加分
      if (['fed', 'ecb', 'boj'].includes(kw)) score += 2;
      if (kw.includes('bps')) score += 2;
      if (['decrease', 'increase', 'nochange'].includes(kw)) score += 1;
    }
  }
  
  // 标题相似度额外加分
  const opTitle = opMarket.title.toLowerCase();
  const polyTitle = polyMarket.title.toLowerCase();
  
  if (opTitle === polyTitle) {
    score += 5;
  } else if (opTitle.includes(polyTitle) || polyTitle.includes(opTitle)) {
    score += 2;
  }
  
  return score;
}

/**
 * 获取匹配原因（用于调试和日志）
 */
function getMatchReason(opMarket, polyMarket) {
  const opKeywords = new Set(opMarket.keywords);
  const polyKeywords = new Set(polyMarket.keywords);
  
  const common = [];
  for (const kw of opKeywords) {
    if (polyKeywords.has(kw)) {
      common.push(kw);
    }
  }
  
  return common.join(', ');
}

/**
 * 手动配置的市场映射
 * 用于已知的精确匹配
 */
export const MANUAL_MAPPINGS = [
  {
    // 美联储利率决议 - 1月
    opinion: { parentTitle: 'US FOMC Interest Rate', period: 'JAN' },
    polymarket: { eventSlug: 'fed-decision-in-january' }
  },
  {
    // 美联储利率决议 - 3月
    opinion: { parentTitle: 'US FOMC Interest Rate', period: 'MAR' },
    polymarket: { eventSlug: 'fed-decision-in-march' }
  },
  {
    // 欧洲央行利率决议 - 12月
    opinion: { parentTitle: 'ECB Rates Decision (DFR)', period: 'DEC' },
    polymarket: { eventSlug: 'ecb-rate-decision' }
  },
  {
    // 日本央行利率决议
    opinion: { parentTitle: 'BoJ Rate Decision', period: 'DEC' },
    polymarket: { eventSlug: 'boj-rate-decision' }
  }
];

/**
 * 使用手动映射匹配市场
 */
export function matchWithManualMappings(opinionMarkets, polymarketMarkets) {
  const matchedPairs = [];
  
  for (const mapping of MANUAL_MAPPINGS) {
    // 找到 Opinion 中匹配的市场
    const opMatches = opinionMarkets.filter(m => 
      m.parentTitle.includes(mapping.opinion.parentTitle) &&
      m.period === mapping.opinion.period
    );
    
    // 找到 Polymarket 中匹配的市场
    const polyMatches = polymarketMarkets.filter(m =>
      m.eventSlug === mapping.polymarket.eventSlug
    );
    
    // 对子选项进行匹配（如 "50+ bps decrease"）
    for (const opMarket of opMatches) {
      const polyMatch = findBestOptionMatch(opMarket, polyMatches);
      if (polyMatch) {
        matchedPairs.push({
          opinion: opMarket,
          polymarket: polyMatch,
          matchScore: 10, // 手动映射给高分
          matchReason: 'manual mapping'
        });
      }
    }
  }
  
  return matchedPairs;
}

/**
 * 查找最佳选项匹配
 * 匹配如 "50+ bps decrease" 这样的具体选项
 */
function findBestOptionMatch(opMarket, polyMarkets) {
  const opTitle = normalizeOptionTitle(opMarket.title);
  
  for (const polyMarket of polyMarkets) {
    const polyTitle = normalizeOptionTitle(polyMarket.title);
    
    if (opTitle === polyTitle) {
      return polyMarket;
    }
  }
  
  // 模糊匹配
  for (const polyMarket of polyMarkets) {
    if (isSimilarOption(opMarket.title, polyMarket.title)) {
      return polyMarket;
    }
  }
  
  return null;
}

/**
 * 标准化选项标题
 */
function normalizeOptionTitle(title) {
  return title
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/bps/gi, 'bps')
    .replace(/no\s*change/gi, 'nochange')
    .replace(/\+/g, 'plus')
    .trim();
}

/**
 * 判断两个选项是否相似
 */
function isSimilarOption(title1, title2) {
  const t1 = title1.toLowerCase();
  const t2 = title2.toLowerCase();
  
  // 提取关键信息
  const bps1 = t1.match(/(\d+)\+?\s*bps/i);
  const bps2 = t2.match(/(\d+)\+?\s*bps/i);
  
  const isDecrease1 = /decrease|cut/i.test(t1);
  const isDecrease2 = /decrease|cut/i.test(t2);
  
  const isIncrease1 = /increase|hike/i.test(t1);
  const isIncrease2 = /increase|hike/i.test(t2);
  
  const isNoChange1 = /no\s*change|unchanged/i.test(t1);
  const isNoChange2 = /no\s*change|unchanged/i.test(t2);
  
  // BPS 数量相同且方向相同
  if (bps1 && bps2 && bps1[1] === bps2[1]) {
    if (isDecrease1 === isDecrease2 && isIncrease1 === isIncrease2) {
      return true;
    }
  }
  
  // 都是 no change
  if (isNoChange1 && isNoChange2) {
    return true;
  }
  
  return false;
}

/**
 * 综合匹配：先用手动映射，再用自动匹配补充
 */
export function matchAllMarkets(opinionMarkets, polymarketMarkets) {
  // 1. 手动映射匹配
  const manualMatches = matchWithManualMappings(opinionMarkets, polymarketMarkets);
  
  // 2. 自动关键词匹配（排除已匹配的）
  const matchedOpIds = new Set(manualMatches.map(m => m.opinion.id));
  const matchedPolyIds = new Set(manualMatches.map(m => m.polymarket.id));
  
  const remainingOp = opinionMarkets.filter(m => !matchedOpIds.has(m.id));
  const remainingPoly = polymarketMarkets.filter(m => !matchedPolyIds.has(m.id));
  
  const autoMatches = matchMarkets(remainingOp, remainingPoly);
  
  return [...manualMatches, ...autoMatches];
}
