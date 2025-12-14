/**
 * Opinion API 模块
 * 获取 Opinion.trade 平台的市场数据
 */

const OPINION_API_BASE = 'https://proxy.opinion.trade:8443/api/bsc/api/v2';

const DEFAULT_HEADERS = {
  'x-device-kind': 'web',
  'Referer': 'https://app.opinion.trade/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json'
};

/**
 * 获取所有指标市场
 * @param {number} limit - 每页数量
 * @param {number} page - 页码
 * @returns {Promise<Array>} 市场列表
 */
export async function fetchIndicators(limit = 50, page = 1) {
  const url = `${OPINION_API_BASE}/indicator?sortDirection=0&limit=${limit}&page=${page}&chainId=56`;
  
  try {
    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    const data = await response.json();
    
    if (data.errno !== 0) {
      console.error('[Opinion] API error:', data.errmsg);
      return [];
    }
    
    return data.result?.list || [];
  } catch (error) {
    console.error('[Opinion] Fetch error:', error.message);
    return [];
  }
}

/**
 * 解析 Opinion 市场数据为统一格式
 * @param {Array} indicators - 原始指标数据
 * @returns {Array} 标准化的市场数据
 */
export function parseOpinionMarkets(indicators) {
  const markets = [];
  
  for (const indicator of indicators) {
    const baseTitle = indicator.title; // e.g., "ECB Rates Decision (DFR)"
    const period = indicator.period;   // e.g., "DEC"
    const countryCode = indicator.countryCode; // e.g., "EU", "US", "JP"
    
    // 获取子市场（具体选项）
    const childList = indicator.topic?.childList || [];
    
    for (const child of childList) {
      // 只处理活跃的市场 (status === 2)
      if (child.status !== 2) continue;
      
      const yesPrice = parseFloat(child.yesMarketPrice) || 0;
      const noPrice = parseFloat(child.noMarketPrice) || 0;
      
      markets.push({
        platform: 'opinion',
        id: child.topicId,
        title: child.title,           // e.g., "50+ bps decrease"
        parentTitle: baseTitle,       // e.g., "ECB Rates Decision (DFR)"
        fullTitle: `${baseTitle} ${period} - ${child.title}`,
        period: period,
        countryCode: countryCode,
        yesPrice: yesPrice,
        noPrice: noPrice,
        volume: parseFloat(child.volume) || 0,
        // 用于匹配的关键词
        keywords: extractKeywords(baseTitle, child.title, period, countryCode)
      });
    }
  }
  
  return markets;
}

/**
 * 提取用于匹配的关键词
 */
function extractKeywords(parentTitle, childTitle, period, countryCode) {
  const keywords = [];
  
  // 央行/利率相关
  if (/ECB|European Central Bank/i.test(parentTitle)) {
    keywords.push('ecb', 'european', 'euro');
  }
  if (/Fed|FOMC|Federal/i.test(parentTitle)) {
    keywords.push('fed', 'fomc', 'federal', 'us');
  }
  if (/BoJ|Bank of Japan/i.test(parentTitle)) {
    keywords.push('boj', 'japan', 'japanese');
  }
  
  // 利率变动类型
  if (/decrease|cut/i.test(childTitle)) {
    keywords.push('decrease', 'cut');
  }
  if (/increase|hike/i.test(childTitle)) {
    keywords.push('increase', 'hike');
  }
  if (/no change|unchanged/i.test(childTitle)) {
    keywords.push('nochange', 'unchanged');
  }
  
  // bps 数量
  const bpsMatch = childTitle.match(/(\d+)\+?\s*bps/i);
  if (bpsMatch) {
    keywords.push(`${bpsMatch[1]}bps`);
  }
  
  // 时间/月份
  if (period) {
    keywords.push(period.toLowerCase());
  }
  
  // 国家代码
  if (countryCode) {
    keywords.push(countryCode.toLowerCase());
  }
  
  return keywords;
}

/**
 * 获取所有 Opinion 市场（已解析）
 */
export async function getAllOpinionMarkets() {
  console.log('[Opinion] Fetching markets...');
  
  // 获取所有指标
  const indicators = await fetchIndicators(100, 1);
  
  if (indicators.length === 0) {
    console.log('[Opinion] No indicators found');
    return [];
  }
  
  console.log(`[Opinion] Found ${indicators.length} indicators`);
  
  // 解析为统一格式
  const markets = parseOpinionMarkets(indicators);
  console.log(`[Opinion] Parsed ${markets.length} markets`);
  
  return markets;
}
