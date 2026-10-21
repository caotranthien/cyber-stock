// services/backtester.js - Historical Quantitative Backtester Engine (VN30 / 10M VND)
const marketData = require('./marketData');
const logger = require('./logger');

class BacktestEngine {
  constructor() {
    this.defaultSymbols = ['FPT', 'HPG', 'TCB', 'SSI', 'MWG', 'VHM', 'MBB', 'ACB', 'VNM', 'DGC'];
  }

  async runBacktest({ symbols = this.defaultSymbols, days = 90, initialCapital = 10000000 }) {
    logger.info('BACKTEST', `Bắt đầu chạy Backtest chiến lược định lượng trên ${symbols.length} mã trong ${days} ngày qua...`);

    const now = Math.floor(Date.now() / 1000);
    const past = now - (days + 40) * 24 * 3600; // Add 40 extra days for technical indicator warmup (SMA50)

    // 1. Fetch OHLCV candles for all symbols
    const candlesBySymbol = new Map();
    for (const sym of symbols) {
      try {
        const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${past}&to=${now}&symbol=${sym}&resolution=1D`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          const data = await res.json();
          if (data && data.t && data.t.length > 0) {
            const list = data.t.map((t, idx) => ({
              date: new Date(t * 1000).toISOString().split('T')[0],
              timestamp: t * 1000,
              open: Math.round(data.o[idx] * 1000),
              high: Math.round(data.h[idx] * 1000),
              low: Math.round(data.l[idx] * 1000),
              close: Math.round(data.c[idx] * 1000),
              volume: data.v[idx] || 0
            }));
            candlesBySymbol.set(sym, list);
          }
        }
      } catch (e) {
        // use synthetic
      }

      if (!candlesBySymbol.has(sym) || candlesBySymbol.get(sym).length < 20) {
        candlesBySymbol.set(sym, marketData.generateSyntheticCandles(sym));
      }
    }

    // 2. Align chronological timeline of dates
    const allDatesSet = new Set();
    candlesBySymbol.forEach(list => {
      list.forEach(c => allDatesSet.add(c.date));
    });
    const sortedDates = Array.from(allDatesSet).sort();
    // Warmup period: skip first 25 bars for SMA & RSI calculation
    const testDates = sortedDates.slice(25);

    // 3. Initialize simulated ledger
    let cash = initialCapital;
    const holdings = {}; // sym -> { quantity, avgPrice, lots: [{ dateIndex, quantity, price }], highestPrice }
    const trades = [];
    const equityCurve = [];
    let peakNav = initialCapital;
    let maxDrawdown = 0;

    const BROKER_FEE = 0.0015; // 0.15%
    const TAX_RATE = 0.001;    // 0.1%

    for (let dIdx = 0; dIdx < testDates.length; dIdx++) {
      const curDate = testDates[dIdx];
      let dayTotalNav = cash;

      // Evaluate each symbol on this day
      for (const sym of symbols) {
        const fullCandles = candlesBySymbol.get(sym) || [];
        const barIndex = fullCandles.findIndex(c => c.date === curDate);
        if (barIndex < 20) continue;

        const currentBar = fullCandles[barIndex];
        const curPrice = currentBar.close;
        const historySlice = fullCandles.slice(0, barIndex + 1);
        const closes = historySlice.map(c => c.close);

        const rsi = marketData.calculateRSI(closes, 14);
        const sma20 = marketData.calculateSMA(closes, 20);
        const sma50 = marketData.calculateSMA(closes, 50);

        // Update holding valuation
        if (holdings[sym]) {
          const h = holdings[sym];
          h.highestPrice = Math.max(h.highestPrice || curPrice, curPrice);
          const pnlPct = ((curPrice - h.avgPrice) / h.avgPrice) * 100;
          const dropFromPeak = ((h.highestPrice - curPrice) / h.highestPrice) * 100;

          // Check T+2.5 settlement (holding for at least 3 days)
          const matureLots = h.lots.filter(l => (dIdx - l.dateIndex) >= 3);
          const availableQty = matureLots.reduce((acc, l) => acc + l.quantity, 0);

          let shouldSell = false;
          let sellReason = '';

          // 1. Hard Stop-Loss (-7%)
          if (pnlPct <= -7.0) {
            shouldSell = true;
            sellReason = `[CẮT LỖ KỶ LUẬT] Lỗ ${pnlPct.toFixed(1)}% chạm ngưỡng -7%`;
          }
          // 2. Trailing Stop (Gains > 3% and dropped 3.5% from peak)
          else if (pnlPct >= 3.0 && dropFromPeak >= 3.5) {
            shouldSell = true;
            sellReason = `[TRAILING STOP] Khóa lãi sau khi tụt ${dropFromPeak.toFixed(1)}% từ đỉnh`;
          }
          // 3. Take Profit (+15%)
          else if (pnlPct >= 15.0) {
            shouldSell = true;
            sellReason = `[CHỐT LỜI MỤC TIÊU] Lãi +${pnlPct.toFixed(1)}%`;
          }
          // 4. Overbought RSI (> 70)
          else if (rsi >= 72) {
            shouldSell = true;
            sellReason = `[QUÁ MUA] RSI đạt ${rsi.toFixed(1)}`;
          }

          if (shouldSell && availableQty > 0) {
            const sellQty = availableQty;
            const grossVal = sellQty * curPrice;
            const fee = Math.round(grossVal * BROKER_FEE);
            const tax = Math.round(grossVal * TAX_RATE);
            const netProceeds = grossVal - fee - tax;
            const costBasis = sellQty * h.avgPrice;
            const tradePnL = netProceeds - costBasis;

            cash += netProceeds;
            trades.push({
              date: curDate,
              symbol: sym,
              side: 'SELL',
              quantity: sellQty,
              price: curPrice,
              pnl: tradePnL,
              pnlPercent: Math.round(((tradePnL / costBasis) * 100) * 10) / 10,
              reason: sellReason
            });

            h.quantity -= sellQty;
            h.lots = h.lots.filter(l => (dIdx - l.dateIndex) < 3);
            if (h.quantity <= 0) {
              delete holdings[sym];
            }
          }
        }

        // BUY CONDITIONS (RSI oversold or strong breakout with support)
        const isAlreadyHolding = !!holdings[sym];
        const isOversoldBuy = rsi <= 38;
        const isTrendBuy = rsi > 45 && rsi < 62 && sma20 && curPrice > sma20 && sma50 && sma20 > sma50;

        if (!isAlreadyHolding && (isOversoldBuy || isTrendBuy)) {
          // Max 35% of total current NAV per stock
          const estNav = cash + Object.values(holdings).reduce((sum, item) => sum + item.quantity * curPrice, 0);
          const maxBudget = Math.min(cash * 0.9, estNav * 0.35);

          if (maxBudget >= curPrice * 10) {
            let shares = Math.floor(maxBudget / curPrice);
            shares = Math.floor(shares / 10) * 10; // lot of 10

            if (shares >= 10) {
              const orderVal = shares * curPrice;
              const fee = Math.round(orderVal * BROKER_FEE);
              const totalCost = orderVal + fee;

              if (cash >= totalCost) {
                cash -= totalCost;
                holdings[sym] = {
                  symbol: sym,
                  quantity: shares,
                  avgPrice: curPrice,
                  highestPrice: curPrice,
                  lots: [{ dateIndex: dIdx, quantity: shares, price: curPrice }]
                };

                trades.push({
                  date: curDate,
                  symbol: sym,
                  side: 'BUY',
                  quantity: shares,
                  price: curPrice,
                  pnl: 0,
                  pnlPercent: 0,
                  reason: isOversoldBuy ? `RSI ${rsi.toFixed(1)} quá bán tích lũy` : `Sóng tăng hội tụ MA20/MA50`
                });
              }
            }
          }
        }
      }

      // Calculate Day End NAV
      let holdingsVal = 0;
      for (const sym of Object.keys(holdings)) {
        const fullCandles = candlesBySymbol.get(sym) || [];
        const barIndex = fullCandles.findIndex(c => c.date === curDate);
        const p = barIndex >= 0 ? fullCandles[barIndex].close : holdings[sym].avgPrice;
        holdingsVal += holdings[sym].quantity * p;
      }
      dayTotalNav = Math.round(cash + holdingsVal);

      // Max Drawdown tracking
      if (dayTotalNav > peakNav) peakNav = dayTotalNav;
      const dd = peakNav > 0 ? ((peakNav - dayTotalNav) / peakNav) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = Math.round(dd * 100) / 100;

      equityCurve.push({
        date: curDate,
        nav: dayTotalNav,
        cash: Math.round(cash)
      });
    }

    // Final Valuation
    const finalNav = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].nav : initialCapital;
    const totalReturn = finalNav - initialCapital;
    const totalReturnPercent = Math.round(((totalReturn / initialCapital) * 100) * 100) / 100;

    const closedTrades = trades.filter(t => t.side === 'SELL');
    const winningTrades = closedTrades.filter(t => t.pnl > 0);
    const winRate = closedTrades.length > 0 ? Math.round((winningTrades.length / closedTrades.length) * 100) : 0;

    let totalGains = 0;
    let totalLosses = 0;
    closedTrades.forEach(t => {
      if (t.pnl > 0) totalGains += t.pnl;
      else totalLosses += Math.abs(t.pnl);
    });
    const profitFactor = totalLosses > 0 ? Math.round((totalGains / totalLosses) * 100) / 100 : (totalGains > 0 ? 99.9 : 1.0);

    logger.success('BACKTEST', `Backtest hoàn tất: Lợi nhuận ${totalReturnPercent}%, Tỷ lệ thắng ${winRate}%, MDD ${maxDrawdown}%`);

    return {
      initialCapital,
      finalNav,
      totalReturn,
      totalReturnPercent,
      days,
      startDate: testDates[0] || 'N/A',
      endDate: testDates[testDates.length - 1] || 'N/A',
      stats: {
        totalTrades: trades.length,
        closedTrades: closedTrades.length,
        winningTrades: winningTrades.length,
        winRate,
        profitFactor,
        maxDrawdown
      },
      equityCurve,
      trades: trades.slice(0, 50)
    };
  }
}

const backtester = new BacktestEngine();
module.exports = backtester;
