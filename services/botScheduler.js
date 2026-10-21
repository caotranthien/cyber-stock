// services/botScheduler.js - 24/7 Autonomous Background Bot Engine
const marketData = require('./marketData');
const newsScraper = require('./newsScraper');
const tradingEngine = require('./tradingEngine');
const geminiBrain = require('./geminiBrain');
const telegramBot = require('./telegramBot');
const logger = require('./logger');

class BotScheduler {
  constructor() {
    this.timer = null;
    this.isRunning = false;
    this.cycleCount = 0;
    this.intervalMs = 90000; // 90 seconds
    this.lastRunTime = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.success('SYS', '>>> KHỞI ĐỘNG ROBOT GIAO DỊCH CHỨNG KHOÁN TỰ ĐỘNG 24/7 <<<');
    logger.info('SYS', `Chế độ: Tự hành nền (Autonomous Background Worker). Chu kỳ quét AI: ${this.intervalMs / 1000}s`);

    // Immediate initial execution
    this.executeCycle();

    this.timer = setInterval(() => {
      this.executeCycle();
    }, this.intervalMs);

    // Fast Real-time Price Ticker Stream (Every 3.5 seconds)
    this.tickTimer = setInterval(() => {
      try {
        const liveQuotes = marketData.getFastQuotes();
        logger.broadcast({
          type: 'live_ticks',
          quotes: liveQuotes.slice(0, 12),
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        // ignore
      }
    }, 3500);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.isRunning = false;
    logger.warn('SYS', 'Robot đã tạm dừng chế độ tự động.');
  }

  setIntervalSeconds(seconds) {
    this.intervalMs = Math.max(30, seconds) * 1000;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
    logger.info('SYS', `Đã điều chỉnh tần suất quét sang ${this.intervalMs / 1000} giây.`);
  }

  async executeCycle(force = false) {
    this.cycleCount++;
    this.lastRunTime = new Date().toISOString();
    logger.info('SYS', `--- [CHU KỲ QUÉT #${this.cycleCount}] Đang cập nhật dữ liệu thị trường & danh mục vốn 10M ---`);

    try {
      // 1. Fetch live quotes & technical indicators
      const quotes = await marketData.fetchLiveQuotes();
      logger.info('MARKET', `Đã cập nhật bảng giá realtime cho ${quotes.length} mã VN30.`);

      // 2. Re-value portfolio
      const portfolioSummary = tradingEngine.updateValuation(quotes);

      // 3. Check automatic risk stop-loss/take-profit
      tradingEngine.checkRiskRules(quotes);

      // 4. Fetch latest news from CafeF
      const news = await newsScraper.fetchNews();

      // 5. Run AI Analysis
      const config = geminiBrain.config;
      let aiResult = null;

      if (config.autoTradeEnabled || force) {
        aiResult = await geminiBrain.analyze(quotes, news, portfolioSummary);

        // 6. Execute autonomous trades based on AI recommendations
        if (config.autoTradeEnabled && aiResult && Array.isArray(aiResult.recommendations)) {
          for (const rec of aiResult.recommendations) {
            const sym = rec.symbol;
            const quote = quotes.find(q => q.symbol === sym);
            if (!quote) continue;

            // Autonomous BUY
            if (rec.action === 'BUY' && rec.confidence >= 70 && rec.shares > 0) {
              const currentHolding = portfolioSummary.holdings[sym];
              // Only buy if not already over-allocated
              if (!currentHolding || currentHolding.quantity < 200) {
                tradingEngine.executeBuy(sym, quote.price, rec.shares, `[AI GEMINI: ${rec.confidence}%] ${rec.reason}`);
              }
            }
            // Autonomous SELL
            else if (rec.action === 'SELL' && portfolioSummary.holdings[sym]) {
              const holding = portfolioSummary.holdings[sym];
              const mode = config.settlementMode || 'T2_5_STRICT';
              const isStrict = mode !== 'T0_DAYTRADING';
              const sellable = isStrict ? (holding.availableQuantity || 0) : holding.quantity;

              if (sellable > 0) {
                const sellShares = (rec.shares > 0 && rec.shares <= sellable) ? rec.shares : sellable;
                tradingEngine.executeSell(sym, quote.price, sellShares, `[AI GEMINI: ${rec.confidence}%] ${rec.reason}`);
              } else {
                logger.warn('SCHEDULER', `[BỎ QUA LỆNH BÁN AI] ${sym}: AI khuyến nghị BÁN (${rec.confidence}%) nhưng toàn bộ ${holding.quantity} CP đang chờ về (T+2.5). Không thể bán!`);
              }
            }
          }
        }
      }

      // Re-update final valuation after trades
      const finalSummary = tradingEngine.updateValuation(quotes);

      // Broadcast update to real-time clients (all 25 VN30 quotes)
      logger.broadcast({
        type: 'state_update',
        portfolio: finalSummary,
        quotes: quotes,
        news: news.slice(0, 10),
        aiResult: aiResult || geminiBrain.lastAnalysis,
        botStatus: {
          isRunning: this.isRunning,
          cycleCount: this.cycleCount,
          lastRunTime: this.lastRunTime,
          autoTradeEnabled: config.autoTradeEnabled
        }
      });

      // Send Telegram Daily Close Summary if after 15:00
      const now = new Date();
      if (now.getHours() >= 15) {
        telegramBot.sendDailySummary(finalSummary).catch(() => {});
      }

    } catch (err) {
      logger.error('SYS', `Lỗi trong chu kỳ quét robot: ${err.message}`);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      cycleCount: this.cycleCount,
      intervalSeconds: this.intervalMs / 1000,
      lastRunTime: this.lastRunTime,
      autoTradeEnabled: geminiBrain.config.autoTradeEnabled
    };
  }
}

const botScheduler = new BotScheduler();
module.exports = botScheduler;
