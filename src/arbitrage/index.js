/**
 * 套利监控主程序
 * 独立于 OKX 交易员监控
 */

import 'dotenv/config';

import { ARBITRAGE_CONFIG, printConfig } from './config.js';
import { getAllOpinionMarkets } from './opinion.js';
import { getAllPolymarketMarkets } from './polymarket.js';
import { matchAllMarkets } from './matcher.js';
import { detectArbitrage, filterNewOpportunities, getFullAnalysis } from './detector.js';
import { notifyStartup, notifyMultipleOpportunities, notifyError, notifyStatus } from './notifier.js';
import { initCommands, checkCommands, setStats } from './commands.js';

// 统计数据
const stats = {
  startTime: Date.now(),
  scanCount: 0,
  totalOpportunities: 0,
  notificationsSent: 0,
  lastOpportunity: null,
  lastScanTime: null,
  errors: 0,
  opinionMarkets: 0,
  polymarketMarkets: 0,
  matchedPairs: 0
};

/**
 * 执行一次扫描
 */
async function runScanCycle() {
  console.log(`\n[${new Date().toISOString()}] Starting scan cycle #${stats.scanCount + 1}...`);
  
  try {
    // 1. 获取两个平台的市场数据
    console.log('📡 Fetching market data...');
    const [opinionMarkets, polymarketMarkets] = await Promise.all([
      getAllOpinionMarkets(),
      getAllPolymarketMarkets()
    ]);
    
    if (opinionMarkets.length === 0 || polymarketMarkets.length === 0) {
      console.log('⚠️ No markets found, skipping this cycle');
      return;
    }
    
    console.log(`📊 Opinion: ${opinionMarkets.length} markets, Polymarket: ${polymarketMarkets.length} markets`);
    
    // 更新统计
    stats.opinionMarkets = opinionMarkets.length;
    stats.polymarketMarkets = polymarketMarkets.length;
    
    // 2. 匹配相同的市场
    console.log('🔗 Matching markets...');
    const matchedPairs = matchAllMarkets(opinionMarkets, polymarketMarkets);
    console.log(`✅ Found ${matchedPairs.length} matched pairs`);
    
    // 更新统计
    stats.matchedPairs = matchedPairs.length;
    
    if (matchedPairs.length === 0) {
      console.log('⚠️ No matched markets, skipping this cycle');
      stats.scanCount++;
      stats.lastScanTime = new Date().toISOString();
      return;
    }
    
    // 打印匹配的市场（调试用）
    if (stats.scanCount === 0) {
      console.log('\n📋 Matched Markets:');
      matchedPairs.slice(0, 10).forEach((pair, i) => {
        console.log(`  ${i + 1}. ${pair.opinion.fullTitle}`);
        console.log(`     ↔ ${pair.polymarket.fullTitle}`);
        console.log(`     Score: ${pair.matchScore}, Reason: ${pair.matchReason}`);
      });
    }
    
    // 3. 检测套利机会
    console.log('🔍 Detecting arbitrage opportunities...');
    const allOpportunities = detectArbitrage(matchedPairs);
    console.log(`💰 Found ${allOpportunities.length} potential opportunities`);
    
    // 4. 过滤新机会（避免重复通知）
    const newOpportunities = filterNewOpportunities(allOpportunities);
    console.log(`🆕 ${newOpportunities.length} new opportunities to notify`);
    
    // 5. 分析并发送通知
    if (newOpportunities.length > 0) {
      // 添加完整分析
      const analyzedOpps = newOpportunities.map(opp => getFullAnalysis(opp));
      
      // 过滤掉不值得的机会
      const worthyOpps = analyzedOpps.filter(opp => 
        opp.returns.isProfitable && 
        parseFloat(opp.returns.netProfitPercent) >= ARBITRAGE_CONFIG.MIN_PROFIT_PERCENT
      );
      
      if (worthyOpps.length > 0) {
        console.log('📨 Sending notifications...');
        await notifyMultipleOpportunities(worthyOpps);
        stats.notificationsSent += worthyOpps.length;
        stats.lastOpportunity = worthyOpps[0].pair.opinion.title;
      }
    }
    
    // 更新统计
    stats.scanCount++;
    stats.totalOpportunities += allOpportunities.length;
    stats.lastScanTime = new Date().toISOString();
    
    console.log(`✅ Scan cycle completed`);
    
  } catch (error) {
    console.error('❌ Scan cycle error:', error);
    stats.errors++;
    
    // 每10个错误通知一次
    if (stats.errors % 10 === 1) {
      await notifyError(error);
    }
  }
}

/**
 * 获取运行时长字符串
 */
function getUptime() {
  const ms = Date.now() - stats.startTime;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

/**
 * 主函数
 */
async function main() {
  printConfig();
  
  console.log('\n� Arbitrage Monitor is DISABLED\n');
  
  // 初始化命令处理
  // await initCommands();
  // setStats(stats);
  
  // 套利监控已完全停用
  console.log('\n⚠️  Arbitrage Monitor is DISABLED.\n');
  console.log('套利监控功能已停用，如需启用请取消注释相关代码。\n');
  
  // 发送启动通知
  // await notifyStartup();
  
  // 立即执行一次扫描
  // await runScanCycle();
  
  // 定时扫描
  // setInterval(runScanCycle, ARBITRAGE_CONFIG.POLL_INTERVAL);
  
  // 定时检查命令（每2秒）
  // setInterval(checkCommands, 2000);
  
  // 定时报告状态（每小时）- 已禁用
  // setInterval(async () => {
  //   await notifyStatus({
  //     uptime: getUptime(),
  //     scanCount: stats.scanCount,
  //     totalOpportunities: stats.totalOpportunities,
  //     notificationsSent: stats.notificationsSent,
  //     lastOpportunity: stats.lastOpportunity,
  //     lastScanTime: stats.lastScanTime
  //   });
  // }, 60 * 60 * 1000);
  
  // console.log('\n✅ Arbitrage Monitor is running. Press Ctrl+C to stop.\n');
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

// 优雅退出
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down Arbitrage Monitor...');
  console.log(`📊 Final Stats: ${stats.scanCount} scans, ${stats.totalOpportunities} opportunities found`);
  process.exit(0);
});

main().catch(console.error);
