/**
 * Polymarket API 模块
 * 获取 Polymarket 平台的市场数据
 */

// Polymarket 使用 Next.js，数据通过 _next/data 端点获取
// 我们需要先获取市场列表，然后获取每个市场的详情

const POLYMARKET_BASE = 'https://polymarket.com';
const GAMMA_API = 'https://gamma-api.polymarket.com';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json'
};

/**
 * 从 Gamma API 获取活跃市场列表
 * 这是 Polymarket 的公开 API
 */
export async function fetchActiveMarkets(limit = 100) {
  // 使用 CLOB API 获取市场
  const url = `https://clob.polymarket.com/markets?limit=${limit}&active=true`;
  
  try {
    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    
    if (!response.ok) {
      console.error('[Polymarket] API response not ok:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('[Polymarket] Fetch error:', error.message);
    return [];
  }
}

/**
 * 从 Gamma API 获取事件列表（包含更多细节）
 */
export async function fetchEvents(limit = 100, offset = 0) {
  const url = `${GAMMA_API}/events?limit=${limit}&active=true&closed=false&offset=${offset}`;
  
  try {
    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    
    if (!response.ok) {
      console.error('[Polymarket] Gamma API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('[Polymarket] Gamma fetch error:', error.message);
    return [];
  }
}

/**
 * 解析 Polymarket 市场数据为统一格式
 * @param {Array} events - 原始事件数据
 * @returns {Array} 标准化的市场数据
 */
export function parsePolymarketMarkets(events) {
  const markets = [];
  
  for (const event of events) {
    const eventTitle = event.title;  // e.g., "Fed decision in January?"
    const eventSlug = event.slug;
    
    // 每个事件可能有多个子市场
    const subMarkets = event.markets || [];
    
    for (const market of subMarkets) {
      // 跳过已关闭或非活跃市场
      if (market.closed || !market.active) continue;
      
      // outcomePrices: ["0.78", "0.22"] 对应 [YES, NO]
      const outcomePrices = market.outcomePrices || [];
      const yesPrice = parseFloat(outcomePrices[0]) || 0;
      const noPrice = parseFloat(outcomePrices[1]) || 0;
      
      // groupItemTitle 是具体选项，如 "No change", "25 bps decrease"
      const optionTitle = market.groupItemTitle || market.question;
      
      markets.push({
        platform: 'polymarket',
        id: market.id,
        title: optionTitle,
        parentTitle: eventTitle,
        fullTitle: `${eventTitle} - ${optionTitle}`,
        slug: market.slug,
        eventSlug: eventSlug,
        yesPrice: yesPrice,
        noPrice: noPrice,
        volume: market.volumeNum || parseFloat(market.volume) || 0,
        liquidity: market.liquidityNum || 0,
        // 用于匹配的关键词
        keywords: extractKeywords(eventTitle, optionTitle)
      });
    }
  }
  
  return markets;
}

/**
 * 提取用于匹配的关键词
 */
function extractKeywords(eventTitle, optionTitle) {
  const keywords = [];
  const combined = `${eventTitle} ${optionTitle}`.toLowerCase();
  
  // 央行/利率相关
  if (/ecb|european central/i.test(combined)) {
    keywords.push('ecb', 'european', 'euro');
  }
  if (/fed|fomc|federal/i.test(combined)) {
    keywords.push('fed', 'fomc', 'federal', 'us');
  }
  if (/boj|bank of japan|japan/i.test(combined)) {
    keywords.push('boj', 'japan', 'japanese');
  }
  
  // 利率变动类型
  if (/decrease|cut/i.test(optionTitle)) {
    keywords.push('decrease', 'cut');
  }
  if (/increase|hike/i.test(optionTitle)) {
    keywords.push('increase', 'hike');
  }
  if (/no change|unchanged/i.test(optionTitle)) {
    keywords.push('nochange', 'unchanged');
  }
  
  // bps 数量
  const bpsMatch = optionTitle.match(/(\d+)\+?\s*bps/i);
  if (bpsMatch) {
    keywords.push(`${bpsMatch[1]}bps`);
  }
  
  // 月份
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                  'july', 'august', 'september', 'october', 'november', 'december',
                  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  for (const month of months) {
    if (combined.includes(month)) {
      // 标准化月份
      const shortMonth = month.slice(0, 3);
      keywords.push(shortMonth);
    }
  }
  
  return keywords;
}

/**
 * 获取所有 Polymarket 市场（已解析）
 */
export async function getAllPolymarketMarkets() {
  console.log('[Polymarket] Fetching markets...');
  
  // 获取事件列表
  const events = await fetchEvents(200, 0);
  
  if (events.length === 0) {
    console.log('[Polymarket] No events found');
    return [];
  }
  
  console.log(`[Polymarket] Found ${events.length} events`);
  
  // 解析为统一格式
  const markets = parsePolymarketMarkets(events);
  console.log(`[Polymarket] Parsed ${markets.length} markets`);
  
  return markets;
}

/**
 * 搜索特定关键词的市场
 */
export async function searchMarkets(query) {
  const url = `${GAMMA_API}/events?limit=50&active=true&closed=false&title=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return parsePolymarketMarkets(data || []);
  } catch (error) {
    console.error('[Polymarket] Search error:', error.message);
    return [];
  }
}
