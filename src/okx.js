/**
 * OKX API 服务
 * 获取交易员持仓数据
 */

/**
 * 获取交易员当前持仓
 */
export async function fetchTraderPositions(uniqueName) {
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

/**
 * 格式化数字
 */
export function formatNumber(num, decimals = 2) {
  const n = parseFloat(num);
  if (isNaN(n)) return '0';
  
  if (Math.abs(n) >= 1000000) {
    return (n / 1000000).toFixed(2) + 'M';
  }
  if (Math.abs(n) >= 1000) {
    return (n / 1000).toFixed(2) + 'K';
  }
  return n.toFixed(decimals);
}

/**
 * 判断是否为币本位合约
 * 币本位: BTC-USD-SWAP, ETH-USD-SWAP
 * U本位: BTC-USDT-SWAP, ETH-USDT-SWAP
 */
export function isCoinMargined(instId) {
  // 币本位合约格式: XXX-USD-SWAP (不包含 USDT/USDC)
  return instId && instId.includes('-USD-') && !instId.includes('USDT') && !instId.includes('USDC');
}

/**
 * 从合约ID中提取币种
 * BTC-USD-SWAP -> BTC
 * ETH-USDT-SWAP -> ETH
 */
export function getCoinFromInstId(instId) {
  if (!instId) return '';
  return instId.split('-')[0];
}

/**
 * 格式化盈亏显示
 * 币本位合约显示币种，U本位显示 $
 */
export function formatPnL(upl, instId) {
  const pnl = parseFloat(upl);
  const sign = pnl >= 0 ? '+' : '';
  
  if (isCoinMargined(instId)) {
    // 币本位合约，显示币种
    const coin = getCoinFromInstId(instId);
    return `${sign}${formatNumber(pnl, 4)} ${coin}`;
  } else {
    // U本位合约，显示 $
    return `${sign}$${formatNumber(pnl)}`;
  }
}

/**
 * 格式化持仓信息为文本
 */
export function formatPositionMessage(trader, positions) {
  if (!positions || positions.length === 0) {
    return `📋 <b>${trader.emoji} ${trader.name}</b>\n\n当前无持仓`;
  }
  
  let msg = `📋 <b>${trader.emoji} ${trader.name}</b> 当前持仓\n\n`;
  
  for (const pos of positions) {
    const direction = pos.posSide === 'short' ? '🔴空' : '🟢多';
    const avgPx = parseFloat(pos.avgPx).toFixed(2);
    const pnlStr = formatPnL(pos.upl, pos.instId);
    const isCoin = isCoinMargined(pos.instId);
    
    msg += `${direction} <b>${pos.instId}</b>${isCoin ? ' 📦币本位' : ''}\n`;
    msg += `   💰 $${avgPx} | ${pos.lever}x\n`;
    msg += `   💵 $${formatNumber(pos.notionalUsd)} | 盈亏: ${pnlStr}\n\n`;
  }
  
  return msg.trim();
}
