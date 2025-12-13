/**
 * OKX 交易员监控服务
 * 主入口文件
 */

import { CONFIG } from './config.js';
import { sendMessage, initTelegram } from './telegram.js';
import { runMonitorCycle } from './monitor.js';
import { checkCommands } from './commands.js';

// ============ 启动 ============
async function main() {
  console.log('='.repeat(50));
  console.log('🚀 OKX Trader Monitor Started');
  console.log(`📡 Monitoring ${CONFIG.TRADERS.length} trader(s):`);
  CONFIG.TRADERS.forEach(t => console.log(`   ${t.emoji} ${t.name}`));
  console.log(`⏱️  Position check: ${CONFIG.POSITION_POLL_INTERVAL / 1000}s`);
  console.log(`⏱️  Command check: ${CONFIG.COMMAND_POLL_INTERVAL / 1000}s`);
  console.log('='.repeat(50));
  
  // 初始化 Telegram - 跳过旧消息
  await initTelegram();
  
  // 发送启动通知
  const traderList = CONFIG.TRADERS.map(t => `${t.emoji} ${t.name}`).join('\n');
  await sendMessage(`
🚀 <b>监控服务已启动</b>

📡 监控交易员:
${traderList}

⏱️ 检查间隔: ${CONFIG.POSITION_POLL_INTERVAL / 1000}秒

发送 /help 查看可用命令
  `.trim());
  
  // 首次运行 - 获取当前持仓
  await runMonitorCycle(true);
  
  // 定时监控持仓变化
  setInterval(() => {
    runMonitorCycle(false);
  }, CONFIG.POSITION_POLL_INTERVAL);
  
  // 定时检查命令
  setInterval(() => {
    checkCommands();
  }, CONFIG.COMMAND_POLL_INTERVAL);
  
  console.log('\n✅ Monitor is running. Press Ctrl+C to stop.\n');
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
  console.log('\n\n🛑 Shutting down...');
  await sendMessage('🛑 监控服务已停止');
  process.exit(0);
});

main().catch(console.error);
