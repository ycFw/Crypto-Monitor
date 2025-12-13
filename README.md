# Crypto Monitor

OKX 交易员持仓监控服务，通过 Telegram 实时推送通知。

## 功能

- 🔔 **实时监控** - 检测交易员开仓/平仓/加仓/减仓
- 📱 **Telegram 通知** - 第一时间推送到频道
- 🤖 **Bot 命令** - 随时查询当前持仓

## 命令列表

| 命令 | 说明 |
|------|------|
| `/pos` | 查看所有交易员持仓 |
| `/pos1` | 查看交易员 1 持仓 |
| `/pos2` | 查看交易员 2 持仓 |
| `/status` | 查看监控状态 |
| `/help` | 显示帮助 |

## 本地运行

```bash
# 安装依赖 (无外部依赖)
npm install

# 运行
npm start

# 开发模式 (自动重启)
npm run dev
```

## 配置

编辑 `src/config.js` 修改：
- Telegram Bot Token
- Telegram Chat ID
- 监控的交易员列表

## 部署

### 方案 1: 云服务器

```bash
# 使用 PM2 运行
npm install -g pm2
pm2 start src/index.js --name crypto-monitor
pm2 save
```

### 方案 2: Docker

```bash
docker build -t crypto-monitor .
docker run -d --name monitor crypto-monitor
```

## 项目结构

```
src/
├── index.js      # 主入口
├── config.js     # 配置文件
├── telegram.js   # Telegram API
├── okx.js        # OKX API
├── monitor.js    # 持仓监控
└── commands.js   # 命令处理
```
