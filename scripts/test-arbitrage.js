/**
 * 测试套利监控核心模块
 * 在本地运行测试 API 和匹配逻辑
 */

import 'dotenv/config';

// 由于我们无法直接访问 Opinion API（地区限制），这里用本地 JSON 文件模拟
import { readFileSync } from 'fs';
import { parseOpinionMarkets } from '../src/arbitrage/opinion.js';
import { parsePolymarketMarkets } from '../src/arbitrage/polymarket.js';
import { matchAllMarkets } from '../src/arbitrage/matcher.js';
import { detectArbitrage, getFullAnalysis } from '../src/arbitrage/detector.js';

async function testWithLocalData() {
  console.log('🧪 Testing with local JSON data...\n');
  
  try {
    // 读取本地测试数据
    let opinionRaw, polymarketRaw;
    
    try {
      opinionRaw = JSON.parse(readFileSync('./scripts/opinion.json', 'utf-8'));
      console.log('✅ Opinion JSON loaded');
    } catch (e) {
      console.log('❌ Failed to load opinion.json:', e.message);
      return;
    }
    
    try {
      const polyContent = readFileSync('./scripts/polymarket.json', 'utf-8');
      if (!polyContent || polyContent.trim() === '') {
        console.log('⚠️ polymarket.json is empty, skipping Polymarket parsing');
        polymarketRaw = null;
      } else {
        polymarketRaw = JSON.parse(polyContent);
        console.log('✅ Polymarket JSON loaded');
      }
    } catch (e) {
      console.log('⚠️ Failed to load polymarket.json:', e.message);
      polymarketRaw = null;
    }
    
    // 解析 Opinion 数据
    console.log('📊 Parsing Opinion data...');
    const opinionIndicators = opinionRaw.result?.list || [];
    const opinionMarkets = parseOpinionMarkets(opinionIndicators);
    console.log(`   Found ${opinionMarkets.length} Opinion markets`);
    
    // 打印前几个 Opinion 市场
    console.log('\n   Sample Opinion markets:');
    opinionMarkets.slice(0, 3).forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.fullTitle}`);
      console.log(`      YES: ${m.yesPrice}, NO: ${m.noPrice}`);
      console.log(`      Keywords: ${m.keywords.join(', ')}`);
    });
    
    // 解析 Polymarket 数据
    console.log('\n📊 Parsing Polymarket data...');
    
    let polymarketMarkets = [];
    
    if (polymarketRaw) {
      // Polymarket 数据在 pageProps.dehydratedState.queries 中
      const queries = polymarketRaw.pageProps?.dehydratedState?.queries || [];
      let polymarketEvents = [];
      
      for (const query of queries) {
        const data = query.state?.data;
        if (data && typeof data === 'object' && !Array.isArray(data) && data.markets) {
          polymarketEvents.push(data);
        }
      }
      
      // 如果没有找到，尝试其他结构
      if (polymarketEvents.length === 0) {
        // 直接查找包含 markets 数组的对象
        for (const query of queries) {
          const data = query.state?.data;
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item.markets && Array.isArray(item.markets)) {
                polymarketEvents.push(item);
              }
            }
          }
        }
      }
      
      console.log(`   Found ${polymarketEvents.length} Polymarket events`);
      
      polymarketMarkets = parsePolymarketMarkets(polymarketEvents);
      console.log(`   Parsed ${polymarketMarkets.length} Polymarket markets`);
      
      // 打印前几个 Polymarket 市场
      console.log('\n   Sample Polymarket markets:');
      polymarketMarkets.slice(0, 3).forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.fullTitle}`);
        console.log(`      YES: ${m.yesPrice}, NO: ${m.noPrice}`);
        console.log(`      Keywords: ${m.keywords.join(', ')}`);
      });
    } else {
      console.log('   Skipping Polymarket (no data)');
    }
    
    // 匹配市场
    console.log('\n🔗 Matching markets...');
    const matchedPairs = matchAllMarkets(opinionMarkets, polymarketMarkets);
    console.log(`   Found ${matchedPairs.length} matched pairs`);
    
    // 打印匹配的市场
    if (matchedPairs.length > 0) {
      console.log('\n   Matched pairs:');
      matchedPairs.forEach((pair, i) => {
        console.log(`   ${i + 1}. ${pair.opinion.title} (Opinion) ↔ ${pair.polymarket.title} (Poly)`);
        console.log(`      Opinion: YES=${pair.opinion.yesPrice.toFixed(3)}, NO=${pair.opinion.noPrice.toFixed(3)}`);
        console.log(`      Poly: YES=${pair.polymarket.yesPrice.toFixed(3)}, NO=${pair.polymarket.noPrice.toFixed(3)}`);
        console.log(`      Score: ${pair.matchScore}, Reason: ${pair.matchReason}`);
      });
    }
    
    // 检测套利机会
    console.log('\n💰 Detecting arbitrage opportunities...');
    const opportunities = detectArbitrage(matchedPairs);
    console.log(`   Found ${opportunities.length} opportunities`);
    
    if (opportunities.length > 0) {
      console.log('\n   🔥 Arbitrage Opportunities:');
      opportunities.forEach((opp, i) => {
        const analysis = getFullAnalysis(opp);
        console.log(`\n   ${i + 1}. ${opp.pair.opinion.fullTitle}`);
        console.log(`      Strategy: ${opp.description}`);
        console.log(`      Total Cost: $${opp.totalCost.toFixed(4)}`);
        console.log(`      Gross Profit: ${opp.profitPercent}%`);
        console.log(`      Net Profit (after fees): ${analysis.returns.netProfitPercent}%`);
        console.log(`      Recommendation: ${analysis.recommendation}`);
      });
    } else {
      console.log('   No arbitrage opportunities found with current threshold.');
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testWithLocalData();
