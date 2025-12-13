// 测试 Telegram Bot 发送消息
const BOT_TOKEN = '8459014132:AAF0WBtQOaQ3aAI_-HHayfwKBv0Cd_r2PkU';
const CHAT_ID = '-1003607111369';

async function testSend() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: '🤖 Bot 连接测试成功！\n\n监控服务即将启动...',
      parse_mode: 'HTML'
    })
  });
  
  const result = await response.json();
  console.log('Response:', JSON.stringify(result, null, 2));
}

testSend();
