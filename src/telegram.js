/**
 * Telegram Bot 服务
 * 处理消息发送和命令接收
 */

import { CONFIG } from './config.js';

let lastUpdateId = 0;
let initialized = false;

/**
 * 初始化 - 跳过所有旧消息
 */
export async function initTelegram() {
  if (initialized) return;
  
  try {
    // 获取所有待处理的消息
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/getUpdates`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.ok && data.result.length > 0) {
      lastUpdateId = data.result[data.result.length - 1].update_id;
      
      // 确认消费掉所有旧消息
      await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`);
      
      console.log(`[Telegram] Cleared ${data.result.length} old messages, offset: ${lastUpdateId}`);
    }
    initialized = true;
  } catch (error) {
    console.error('Failed to init Telegram:', error);
  }
}

/**
 * 发送消息到 Telegram
 */
export async function sendMessage(text, chatId = CONFIG.TELEGRAM_CHAT_ID) {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram API error:', result);
    }
    return result;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return null;
  }
}

/**
 * 获取新消息/命令
 */
export async function getUpdates() {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=1`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.ok || !data.result.length) {
      return [];
    }
    
    // 详细日志
    console.log(`[getUpdates] Got ${data.result.length} updates, IDs: ${data.result.map(u => u.update_id).join(', ')}`);
    
    // 更新 offset
    lastUpdateId = data.result[data.result.length - 1].update_id;
    
    return data.result;
  } catch (error) {
    console.error('Failed to get updates:', error);
    return [];
  }
}

/**
 * 解析命令
 */
export function parseCommand(text) {
  if (!text || !text.startsWith('/')) return null;
  
  const parts = text.split(/\s+/);
  const command = parts[0].toLowerCase().split('@')[0]; // 移除 @botname
  const args = parts.slice(1);
  
  return { command, args };
}
