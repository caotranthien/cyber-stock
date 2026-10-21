// services/tradingEngine.js - 10,000,000 VND Paper Trading & Risk Management Engine
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const telegramBot = require('./telegramBot');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PORTFOLIO_FILE = path.join(DATA_DIR, 'portfolio.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const INITIAL_CAPITAL = 10000000; // 10,000,000 VND
const BROKER_FEE_RATE = 0.0015;   // 0.15%
const STOCK_TAX_RATE = 0.001;     // 0.1% bán chứng khoán
const STOP_LOSS_PERCENT = -7.0;   // Cắt lỗ kỷ luật -7%
const TAKE_PROFIT_PERCENT = 15.0; // Chốt lời mục tiêu +15%
const MAX_CAPITAL_PER_TRADE = 0.35; // Tối đa 35% vốn cho 1 mã (đa dạng hóa)

class TradingEngine {
  constructor() {
    this.ensureDataDir();
    this.portfolio = this.loadPortfolio();
  }

  getConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      }
    } catch (e) {}
    return { settlementMode: 'T2_5_STRICT' };
  }

  // Count business trading days between two dates (excluding Saturday & Sunday)
  getTradingDaysDiff(date1Str, date2Str) {
    if (!date1Str || !date2Str || date1Str === date2Str) return 0;
    const d1 = new Date(date1Str);
    const d2 = new Date(date2Str);
    if (d1 >= d2) return 0;

    let count = 0;
    const cur = new Date(d1);
    cur.setDate(cur.getDate() + 1);
    while (cur <= d2) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) { // Monday to Friday
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  getTodayString() {
    return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  }

  getDefaultPortfolio() {
    const today = this.getTodayString();
    return {
      initialCapital: INITIAL_CAPITAL,
      cash: INITIAL_CAPITAL,
      totalNav: INITIAL_CAPITAL,
      startOfDayNav: INITIAL_CAPITAL,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      realizedPnL: 0,
      dailyPnL: 0,
      dailyPnLPercent: 0,
      lastDate: today,
      holdings: {},
      trades: [],
      dailySnapshots: [
        {
          date: today,
          nav: INITIAL_CAPITAL,
          cash: INITIAL_CAPITAL,
          pnl: 0,
          changePercent: 0
        }
      ]
    };
  }

  loadPortfolio() {
    try {
      if (fs.existsSync(PORTFOLIO_FILE)) {
        const raw = fs.readFileSync(PORTFOLIO_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Date rollover check
        const today = this.getTodayString();
        if (parsed.lastDate !== today) {
          logger.info('PORTFOLIO', `Bắt đầu ngày giao dịch mới [${today}]. Cập nhật mốc tính trênh lệch ngày.`);
          parsed.startOfDayNav = parsed.totalNav || INITIAL_CAPITAL;
          parsed.dailyPnL = 0;
          parsed.dailyPnLPercent = 0;
          parsed.lastDate = today;
          // Add snapshot
          if (!parsed.dailySnapshots) parsed.dailySnapshots = [];
          parsed.dailySnapshots.push({
            date: today,
            nav: parsed.totalNav,
            cash: parsed.cash,
            pnl: 0,
            changePercent: 0
          });
        }
        return parsed;
      }
    } catch (err) {
      logger.error('PORTFOLIO', `Lỗi đọc file portfolio. Khởi tạo danh mục mới 10 triệu VND: ${err.message}`);
    }
    const def = this.getDefaultPortfolio();
    this.savePortfolio(def);
    return def;
  }

  savePortfolio(data = this.portfolio) {
    try {
      fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      logger.error('PORTFOLIO', `Lỗi lưu portfolio.json: ${err.message}`);
    }
  }

  // Update current valuation from live market quotes
  updateValuation(marketQuotes) {
    let holdingsMarketValue = 0;
    let holdingsCostValue = 0;

    const quoteMap = new Map();
    for (const q of marketQuotes) {
      quoteMap.set(q.symbol, q.price);
    }

    for (const [symbol, holding] of Object.entries(this.portfolio.holdings)) {
      if (holding.quantity <= 0) {
        delete this.portfolio.holdings[symbol];
        continue;
      }

      const currentPrice = quoteMap.get(symbol) || holding.avgPrice;
      holding.currentPrice = currentPrice;
      holding.highestPrice = Math.max(holding.highestPrice || currentPrice, currentPrice);
      holding.marketValue = holding.quantity * currentPrice;
      holding.costValue = holding.quantity * holding.avgPrice;
      holding.pnl = holding.marketValue - holding.costValue;
      holding.pnlPercent = holding.costValue > 0 ? Math.round((holding.pnl / holding.costValue) * 10000) / 100 : 0;

      // Settle T+2.5 lots according to settlementMode:
      // - T2_5_STRICT: Chuẩn VSD Việt Nam (phải qua >= 2 ngày làm việc và sau 13:00 ngày T+2)
      // - T2_5_SIMULATED: Mô phỏng rút gọn (chờ 180 giây để kiểm thử nhanh)
      // - T0_DAYTRADING: Day trading T+0 (khả dụng tức thì)
      const config = this.getConfig();
      const mode = config.settlementMode || 'T2_5_STRICT';
      const now = Date.now();
      const currentHour = new Date().getHours();
      const today = this.getTodayString();

      let availQty = 0;
      let pendQty = 0;

      if (mode === 'T0_DAYTRADING') {
        availQty = holding.quantity;
        pendQty = 0;
      } else if (mode === 'T2_5_SIMULATED') {
        if (Array.isArray(holding.lots)) {
          for (const lot of holding.lots) {
            if ((now - lot.timestamp >= 180000) || (lot.date !== today)) {
              availQty += lot.quantity;
            } else {
              pendQty += lot.quantity;
            }
          }
        } else {
          availQty = holding.quantity;
        }
      } else {
        // T2_5_STRICT (Chuẩn VSD Việt Nam)
        if (Array.isArray(holding.lots)) {
          for (const lot of holding.lots) {
            const diffDays = this.getTradingDaysDiff(lot.date, today);
            if (diffDays > 2 || (diffDays === 2 && currentHour >= 13)) {
              availQty += lot.quantity;
            } else {
              pendQty += lot.quantity;
            }
          }
        } else {
          availQty = holding.quantity;
        }
      }
      holding.availableQuantity = availQty;
      holding.pendingQuantity = pendQty;

      holdingsMarketValue += holding.marketValue;
      holdingsCostValue += holding.costValue;
    }

    this.portfolio.unrealizedPnL = holdingsMarketValue - holdingsCostValue;
    this.portfolio.unrealizedPnLPercent = holdingsCostValue > 0 ? Math.round((this.portfolio.unrealizedPnL / holdingsCostValue) * 10000) / 100 : 0;
    this.portfolio.totalNav = this.portfolio.cash + holdingsMarketValue;

    // Daily PnL vs Start of day NAV
    this.portfolio.dailyPnL = this.portfolio.totalNav - this.portfolio.startOfDayNav;
    this.portfolio.dailyPnLPercent = this.portfolio.startOfDayNav > 0
      ? Math.round((this.portfolio.dailyPnL / this.portfolio.startOfDayNav) * 10000) / 100
      : 0;

    // Update today's snapshot
    const today = this.getTodayString();
    if (!this.portfolio.dailySnapshots) this.portfolio.dailySnapshots = [];
    const todayIdx = this.portfolio.dailySnapshots.findIndex(s => s.date === today);
    const snapshotObj = {
      date: today,
      nav: this.portfolio.totalNav,
      cash: this.portfolio.cash,
      pnl: this.portfolio.dailyPnL,
      changePercent: this.portfolio.dailyPnLPercent
    };

    if (todayIdx >= 0) {
      this.portfolio.dailySnapshots[todayIdx] = snapshotObj;
    } else {
      this.portfolio.dailySnapshots.push(snapshotObj);
    }

    this.savePortfolio();
    return this.getSummary();
  }

  // Execute BUY order
  executeBuy(symbol, price, requestedShares, aiReason = 'Tín hiệu AI phân tích tự động') {
    if (price <= 0) return { success: false, message: 'Giá không hợp lệ' };

    // Capital limit: max 35% of total NAV per stock
    const maxAllocated = this.portfolio.totalNav * MAX_CAPITAL_PER_TRADE;
    const currentHoldingValue = (this.portfolio.holdings[symbol]?.marketValue) || 0;
    const availableForSymbol = Math.max(0, maxAllocated - currentHoldingValue);

    const maxCanAffordByCash = Math.floor((this.portfolio.cash * 0.99) / (price * (1 + BROKER_FEE_RATE)));
    const maxCanAffordByAlloc = Math.floor(availableForSymbol / (price * (1 + BROKER_FEE_RATE)));
    let allowedShares = Math.min(requestedShares, maxCanAffordByCash, maxCanAffordByAlloc);

    // Round to lot of 10 or 100 (for HOSE standard, or 10 for retail budget)
    if (allowedShares >= 10) {
      allowedShares = Math.floor(allowedShares / 10) * 10;
    }

    if (allowedShares <= 0) {
      logger.warn('RISK', `Không đủ tiền mặt hoặc đã chạm giới hạn tỷ trọng 35% cho [${symbol}]. Bỏ qua lệnh MUA.`);
      return { success: false, message: 'Không đủ tiền mặt hoặc quá tỷ trọng' };
    }

    const orderValue = allowedShares * price;
    const fee = Math.round(orderValue * BROKER_FEE_RATE);
    const totalDeducted = orderValue + fee;

    if (this.portfolio.cash < totalDeducted) {
      return { success: false, message: 'Số dư tiền mặt không đủ thanh toán' };
    }

    this.portfolio.cash -= totalDeducted;

    // Update holding with T+2.5 lot tracking
    const today = this.getTodayString();
    if (!this.portfolio.holdings[symbol]) {
      this.portfolio.holdings[symbol] = {
        symbol,
        quantity: allowedShares,
        availableQuantity: 0, // T+0 pending
        pendingQuantity: allowedShares,
        avgPrice: price,
        highestPrice: price, // For ATR trailing stop
        currentPrice: price,
        costValue: orderValue,
        marketValue: orderValue,
        pnl: 0,
        pnlPercent: 0,
        entryTime: new Date().toISOString(),
        lots: [
          { date: today, timestamp: Date.now(), quantity: allowedShares, price }
        ]
      };
    } else {
      const h = this.portfolio.holdings[symbol];
      const newQty = h.quantity + allowedShares;
      const newCost = (h.quantity * h.avgPrice) + orderValue;
      h.avgPrice = Math.round(newCost / newQty);
      h.quantity = newQty;
      h.pendingQuantity = (h.pendingQuantity || 0) + allowedShares;
      h.highestPrice = Math.max(h.highestPrice || price, price);
      h.costValue = newCost;
      h.marketValue = newQty * price;
      h.currentPrice = price;
      if (!h.lots) h.lots = [];
      h.lots.push({ date: today, timestamp: Date.now(), quantity: allowedShares, price });
    }

    const tradeRecord = {
      id: 'TRD_' + Date.now().toString(36).toUpperCase(),
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      symbol,
      side: 'BUY',
      quantity: allowedShares,
      price,
      orderValue,
      fee,
      tax: 0,
      total: totalDeducted,
      aiReason
    };

    this.portfolio.trades.unshift(tradeRecord);
    this.savePortfolio();

    logger.success('TRADE', `[KHỚP LỆNH MUA] ${symbol}: ${allowedShares} CP @ ${price.toLocaleString('vi-VN')} đ | Trị giá: ${orderValue.toLocaleString('vi-VN')} đ | Phí: ${fee.toLocaleString('vi-VN')} đ (Đang chờ về T+2.5)`, tradeRecord);
    telegramBot.sendTradeAlert(tradeRecord).catch(() => {});

    return { success: true, trade: tradeRecord };
  }

  // Execute SELL order
  executeSell(symbol, price, requestedShares, aiReason = 'Chốt lời / Cắt lỗ theo kỷ luật AI') {
    const holding = this.portfolio.holdings[symbol];
    if (!holding || holding.quantity <= 0) {
      return { success: false, message: `Không sở hữu mã ${symbol} để bán` };
    }

    const config = this.getConfig();
    const mode = config.settlementMode || 'T2_5_STRICT';

    let maxSellable = holding.quantity;
    if (mode === 'T2_5_STRICT' || mode === 'T2_5_SIMULATED') {
      maxSellable = holding.availableQuantity !== undefined ? holding.availableQuantity : 0;
      if (maxSellable <= 0) {
        const pending = holding.pendingQuantity || holding.quantity;
        const msg = `[CHẶN BÁN T+2.5] ${symbol}: Toàn bộ ${pending} CP đang chờ bù trừ thanh toán VSD (T+2.5), chưa thể bán!`;
        logger.warn('SETTLEMENT', msg);
        return { success: false, message: msg };
      }
    }

    const sellQty = Math.min(maxSellable, requestedShares);
    if (sellQty <= 0) {
      return { success: false, message: `Số lượng khả dụng không đủ để bán (${maxSellable} CP khả dụng)` };
    }

    const orderValue = sellQty * price;
    const fee = Math.round(orderValue * BROKER_FEE_RATE);
    const tax = Math.round(orderValue * STOCK_TAX_RATE);
    const netProceeds = orderValue - fee - tax;

    const costBasis = sellQty * holding.avgPrice;
    const tradePnL = netProceeds - costBasis;

    this.portfolio.cash += netProceeds;
    this.portfolio.realizedPnL = (this.portfolio.realizedPnL || 0) + tradePnL;

    holding.quantity -= sellQty;
    if (holding.availableQuantity !== undefined) {
      holding.availableQuantity = Math.max(0, holding.availableQuantity - sellQty);
    }

    // Deduct sold shares from oldest lots (FIFO)
    if (Array.isArray(holding.lots)) {
      let remainingDeduct = sellQty;
      for (let i = 0; i < holding.lots.length && remainingDeduct > 0; i++) {
        const lot = holding.lots[i];
        if (lot.quantity <= remainingDeduct) {
          remainingDeduct -= lot.quantity;
          lot.quantity = 0;
        } else {
          lot.quantity -= remainingDeduct;
          remainingDeduct = 0;
        }
      }
      holding.lots = holding.lots.filter(l => l.quantity > 0);
    }

    if (holding.quantity <= 0) {
      delete this.portfolio.holdings[symbol];
    } else {
      holding.costValue = holding.quantity * holding.avgPrice;
      holding.marketValue = holding.quantity * price;
    }

    const tradeRecord = {
      id: 'TRD_' + Date.now().toString(36).toUpperCase(),
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      symbol,
      side: 'SELL',
      quantity: sellQty,
      price,
      orderValue,
      fee,
      tax,
      netProceeds,
      pnl: tradePnL,
      aiReason
    };

    this.portfolio.trades.unshift(tradeRecord);
    this.savePortfolio();

    const pnlPrefix = tradePnL >= 0 ? '+' : '';
    logger.success('TRADE', `[KHỚP LỆNH BÁN] ${symbol}: ${sellQty} CP @ ${price.toLocaleString('vi-VN')} đ | Lãi/Lỗ: ${pnlPrefix}${tradePnL.toLocaleString('vi-VN')} đ | Rationale: ${aiReason}`, tradeRecord);
    telegramBot.sendTradeAlert(tradeRecord).catch(() => {});

    return { success: true, trade: tradeRecord };
  }

  // Risk Auto-Guardian: Stop-loss at -7% and Take-Profit at +15%
  checkRiskRules(marketQuotes) {
    const config = this.getConfig();
    const mode = config.settlementMode || 'T2_5_STRICT';
    const isStrict = mode !== 'T0_DAYTRADING';

    const quoteMap = new Map();
    for (const q of marketQuotes) quoteMap.set(q.symbol, q.price);

    for (const [symbol, holding] of Object.entries(this.portfolio.holdings)) {
      const curPrice = quoteMap.get(symbol);
      if (!curPrice) continue;

      const pnlPct = ((curPrice - holding.avgPrice) / holding.avgPrice) * 100;
      const peakPrice = holding.highestPrice || holding.avgPrice;
      const dropFromPeak = peakPrice > curPrice ? ((peakPrice - curPrice) / peakPrice) * 100 : 0;

      const sellableQty = isStrict ? (holding.availableQuantity || 0) : holding.quantity;

      // 1. Hard Floor Stop-loss (-7%)
      if (pnlPct <= STOP_LOSS_PERCENT) {
        if (sellableQty <= 0) {
          logger.alert('RISK', `[CẢNH BÁO T+2.5] ${symbol} chạm sàn cắt lỗ ${pnlPct.toFixed(2)}% (chạm sàn ${STOP_LOSS_PERCENT}%), nhưng toàn bộ ${holding.quantity} CP đang chờ về từ VSD. Bị kẹp hàng T+2.5, chưa thể bán!`);
          continue;
        }
        const reason = `[BẢO TOÀN VỐN GỐC] Cắt lỗ kỷ luật -${Math.abs(pnlPct).toFixed(2)}%`;
        logger.alert('RISK', `[KÍCH HOẠT CẮT LỖ KHẨN CẤP] ${symbol} giảm ${pnlPct.toFixed(2)}% (chạm sàn ${STOP_LOSS_PERCENT}%). Tự động bán ${sellableQty} CP để bảo toàn vốn 10M!`);
        this.executeSell(symbol, curPrice, sellableQty, reason);
        telegramBot.sendRiskAlert('STOP_LOSS', symbol, pnlPct, curPrice, reason).catch(() => {});
      }
      // 2. Trailing Stop Loss: Nếu đã có lãi trên +3% nhưng bị tụt dốc > 3.5% từ đỉnh
      else if (pnlPct >= 3.0 && dropFromPeak >= 3.5 && holding.quantity >= 10) {
        if (sellableQty <= 0) {
          logger.alert('RISK', `[CẢNH BÁO T+2.5] ${symbol} đạt đỉnh ${peakPrice.toLocaleString('vi-VN')} đ nhưng đã tụt -${dropFromPeak.toFixed(1)}% từ đỉnh, tuy nhiên cổ phiếu đang chờ về (T+2.5). Chưa thể bán trailing stop!`);
          continue;
        }
        const reason = `[TRAILING STOP] Khóa lợi nhuận sau khi quay đầu giảm ${dropFromPeak.toFixed(1)}% từ đỉnh`;
        logger.alert('RISK', `[TRAILING STOP-LOSS] ${symbol} đạt đỉnh ${peakPrice.toLocaleString('vi-VN')} đ nhưng đã tụt -${dropFromPeak.toFixed(1)}% từ đỉnh. Kích hoạt chốt lãi ${sellableQty} CP bảo vệ thành quả!`);
        this.executeSell(symbol, curPrice, sellableQty, reason);
        telegramBot.sendRiskAlert('TRAILING_STOP', symbol, pnlPct, curPrice, reason).catch(() => {});
      }
      // 3. Take-profit (+15%)
      else if (pnlPct >= TAKE_PROFIT_PERCENT) {
        if (sellableQty <= 0) {
          logger.alert('RISK', `[CẢNH BÁO T+2.5] ${symbol} đạt mục tiêu chốt lời +${pnlPct.toFixed(2)}% nhưng cổ phiếu đang chờ về (T+2.5). Chưa thể bán!`);
          continue;
        }
        const halfQty = Math.max(10, Math.floor(sellableQty / 20) * 10);
        const actualSell = Math.min(sellableQty, halfQty);
        const reason = `[CHỐT LỜI MỤC TIÊU] Hiện thực hóa lợi nhuận +${pnlPct.toFixed(2)}%`;
        logger.alert('RISK', `[KÍCH HOẠT CHỐT LỜI TỰ ĐỘNG] ${symbol} tăng ${pnlPct.toFixed(2)}% (vượt mục tiêu ${TAKE_PROFIT_PERCENT}%). Tự động chốt lời ${actualSell} CP!`);
        this.executeSell(symbol, curPrice, actualSell, reason);
        telegramBot.sendRiskAlert('TAKE_PROFIT', symbol, pnlPct, curPrice, reason).catch(() => {});
      }
    }
  }

  resetPortfolio() {
    this.portfolio = this.getDefaultPortfolio();
    this.savePortfolio();
    logger.alert('PORTFOLIO', 'ĐÃ RESET DANH MỤC! Khởi tạo lại số vốn ban đầu: 10,000,000 VND.');
    return this.getSummary();
  }

  getSummary() {
    const totalTrades = this.portfolio.trades.length;
    const closedTrades = this.portfolio.trades.filter(t => t.side === 'SELL');
    const winningTrades = closedTrades.filter(t => t.pnl > 0).length;
    const winRate = closedTrades.length > 0 ? Math.round((winningTrades / closedTrades.length) * 100) : 0;

    // Advanced Quant Analytics
    let totalGains = 0;
    let totalLosses = 0;
    for (const t of closedTrades) {
      if ((t.pnl || 0) > 0) totalGains += t.pnl;
      else totalLosses += Math.abs(t.pnl || 0);
    }
    const profitFactor = totalLosses > 0 ? Math.round((totalGains / totalLosses) * 100) / 100 : (totalGains > 0 ? 99.9 : 1.0);

    // Max Drawdown (MDD)
    let maxDrawdown = 0;
    let peakNav = this.portfolio.initialCapital;
    const snapshots = this.portfolio.dailySnapshots || [];
    for (const snap of snapshots) {
      if (snap.nav > peakNav) peakNav = snap.nav;
      const dd = peakNav > 0 ? ((peakNav - snap.nav) / peakNav) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = Math.round(dd * 100) / 100;
    }
    // Check current NAV drawdown
    if (this.portfolio.totalNav > peakNav) peakNav = this.portfolio.totalNav;
    const currentDD = peakNav > 0 ? ((peakNav - this.portfolio.totalNav) / peakNav) * 100 : 0;
    if (currentDD > maxDrawdown) maxDrawdown = Math.round(currentDD * 100) / 100;

    return {
      initialCapital: this.portfolio.initialCapital,
      cash: Math.round(this.portfolio.cash),
      totalNav: Math.round(this.portfolio.totalNav),
      startOfDayNav: Math.round(this.portfolio.startOfDayNav),
      unrealizedPnL: Math.round(this.portfolio.unrealizedPnL),
      unrealizedPnLPercent: this.portfolio.unrealizedPnLPercent,
      realizedPnL: Math.round(this.portfolio.realizedPnL || 0),
      dailyPnL: Math.round(this.portfolio.dailyPnL),
      dailyPnLPercent: this.portfolio.dailyPnLPercent,
      holdings: this.portfolio.holdings,
      trades: this.portfolio.trades.slice(0, 50),
      dailySnapshots: this.portfolio.dailySnapshots || [],
      stats: {
        totalTrades,
        closedTrades: closedTrades.length,
        winningTrades,
        winRate,
        profitFactor,
        maxDrawdown,
        holdingsCount: Object.keys(this.portfolio.holdings).length
      }
    };
  }
}

const tradingEngine = new TradingEngine();
module.exports = tradingEngine;
