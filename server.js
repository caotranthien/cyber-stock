// server.js - Real-time Cyberpunk Gemini Stock Trading Platform
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const logger = require('./services/logger');
const marketData = require('./services/marketData');
const newsScraper = require('./services/newsScraper');
const tradingEngine = require('./services/tradingEngine');
const geminiBrain = require('./services/geminiBrain');
const botScheduler = require('./services/botScheduler');
const backtester = require('./services/backtester');
const telegramBot = require('./services/telegramBot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check for 24/7 keep-alive services (e.g. Cron-job.org, UptimeRobot)
app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    bot: botScheduler.getStatus()
  });
});

// SSE Real-time Stream
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);

  const unsubscribe = logger.subscribe((data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // client disconnected
    }
  });

  req.on('close', () => {
    unsubscribe();
  });
});

// Portfolio API
app.get('/api/portfolio', (req, res) => {
  res.json(tradingEngine.getSummary());
});

// Market Data API
app.get('/api/market', async (req, res) => {
  try {
    const quotes = await marketData.getMarketSnapshot();
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Historical Chart API
app.get('/api/chart/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const history = await marketData.fetchHistory(symbol);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// News API
app.get('/api/news', async (req, res) => {
  try {
    const news = await newsScraper.fetchNews();
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Analysis API
app.get('/api/ai-analysis', (req, res) => {
  res.json(geminiBrain.lastAnalysis || { message: 'Đang chuẩn bị phân tích...' });
});

// Logs API
app.get('/api/logs', (req, res) => {
  res.json(logger.getRecentLogs(100));
});

// Trigger Manual Scan
app.post('/api/bot/scan-now', async (req, res) => {
  logger.info('SYS', '[YÊU CẦU THỦ CÔNG] Người dùng kích hoạt quét AI và thị trường ngay lập tức.');
  botScheduler.executeCycle(true);
  res.json({ success: true, message: 'Đã kích hoạt chu kỳ quét' });
});

// Toggle Bot Run/Pause
app.post('/api/bot/toggle', (req, res) => {
  if (botScheduler.isRunning) {
    botScheduler.stop();
  } else {
    botScheduler.start();
  }
  res.json({ success: true, isRunning: botScheduler.isRunning });
});

// Update Bot & Gemini Config
app.post('/api/bot/config', (req, res) => {
  const { 
    geminiApiKey, riskTolerance, scanIntervalSeconds, autoTradeEnabled,
    telegramBotToken, telegramChatId, telegramAlertsEnabled 
  } = req.body;
  const updates = {};
  if (geminiApiKey !== undefined) updates.geminiApiKey = geminiApiKey.trim();
  if (riskTolerance !== undefined) updates.riskTolerance = riskTolerance;
  if (autoTradeEnabled !== undefined) updates.autoTradeEnabled = !!autoTradeEnabled;
  if (telegramBotToken !== undefined) updates.telegramBotToken = telegramBotToken.trim();
  if (telegramChatId !== undefined) updates.telegramChatId = telegramChatId.trim();
  if (telegramAlertsEnabled !== undefined) updates.telegramAlertsEnabled = !!telegramAlertsEnabled;
  if (scanIntervalSeconds !== undefined) {
    updates.scanIntervalSeconds = parseInt(scanIntervalSeconds, 10);
    botScheduler.setIntervalSeconds(updates.scanIntervalSeconds);
  }

  geminiBrain.saveConfig(updates);
  res.json({ success: true, config: geminiBrain.config });
});

app.get('/api/bot/config', (req, res) => {
  const cfg = { ...geminiBrain.config };
  if (cfg.geminiApiKey) {
    cfg.geminiApiKeyMasked = cfg.geminiApiKey.substring(0, 6) + '...' + cfg.geminiApiKey.substring(cfg.geminiApiKey.length - 4);
    cfg.hasApiKey = true;
  } else {
    cfg.hasApiKey = false;
  }
  if (cfg.telegramBotToken) {
    cfg.telegramBotTokenMasked = cfg.telegramBotToken.substring(0, 6) + '...' + cfg.telegramBotToken.substring(cfg.telegramBotToken.length - 4);
    cfg.hasTelegram = true;
  } else {
    cfg.hasTelegram = false;
  }
  delete cfg.geminiApiKey;
  delete cfg.telegramBotToken;
  res.json(cfg);
});

// Test Telegram Connection
app.post('/api/telegram/test', async (req, res) => {
  const token = req.body.botToken || geminiBrain.config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = req.body.chatId || geminiBrain.config.telegramChatId || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return res.status(400).json({ success: false, error: 'Thiếu Telegram Bot Token hoặc Chat ID' });
  }

  const result = await telegramBot.testConnection(token, chatId);
  res.json(result);
});

// AI Co-Pilot Terminal Chat Endpoint
app.post('/api/gemini/chat', async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Nội dung câu hỏi không hợp lệ' });
  }

  try {
    const quotes = await marketData.getMarketSnapshot();
    const portfolio = tradingEngine.getSummary();
    const news = await newsScraper.fetchNews();
    const reply = await geminiBrain.askCopilot(query, quotes, portfolio, news);
    res.json(reply);
  } catch (err) {
    res.status(500).json({ error: err.message, reply: `Lỗi hệ thống: ${err.message}` });
  }
});

// Strategy Backtester Endpoint
app.post('/api/backtest', async (req, res) => {
  const { symbols, days, initialCapital } = req.body;
  try {
    const result = await backtester.runBacktest({
      symbols: Array.isArray(symbols) && symbols.length > 0 ? symbols : undefined,
      days: parseInt(days, 10) || 90,
      initialCapital: parseInt(initialCapital, 10) || 10000000
    });
    res.json(result);
  } catch (err) {
    logger.error('BACKTEST', `Lỗi backtest: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Sector Heatmap Endpoint
app.get('/api/sectors', (req, res) => {
  res.json(marketData.getSectorHeatmap());
});

// Manual Trade Override
app.post('/api/trade/manual', async (req, res) => {
  const { symbol, side, quantity, price } = req.body;
  if (!symbol || !side || !quantity) {
    return res.status(400).json({ error: 'Thiếu thông tin lệnh' });
  }

  const quote = await marketData.getQuote(symbol.toUpperCase());
  const execPrice = price || quote.price;

  let result;
  if (side.toUpperCase() === 'BUY') {
    result = tradingEngine.executeBuy(symbol.toUpperCase(), execPrice, parseInt(quantity, 10), '[LỆNH THỦ CÔNG] Đặt bởi người dùng');
  } else {
    result = tradingEngine.executeSell(symbol.toUpperCase(), execPrice, parseInt(quantity, 10), '[LỆNH THỦ CÔNG] Bán bởi người dùng');
  }

  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Reset Portfolio to 10M VND
app.post('/api/portfolio/reset', (req, res) => {
  const summary = tradingEngine.resetPortfolio();
  res.json({ success: true, summary });
});

// Start Express and launch Bot Background Scheduler
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 CYBERPUNK GEMINI TRADING BOT IS RUNNING ON PORT ${PORT}`);
  console.log(`🌐 Local UI: http://localhost:${PORT}`);
  console.log(`📡 Health Check for 24/7 Hosting: http://localhost:${PORT}/health`);
  console.log(`💰 Initial Capital: 10,000,000 VND`);
  console.log(`======================================================\n`);

  logger.success('SYS', `Hệ thống khởi động thành công trên cổng ${PORT}. Sẵn sàng giao dịch vốn 10.000.000 VNĐ.`);
  // Start autonomous trading scheduler
  botScheduler.start();
});
