// public/app.js - Real-time Reactive Cyberpunk Trading Client
(function () {
  let state = {
    portfolio: null,
    quotes: [],
    news: [],
    aiAnalysis: null,
    logs: [],
    selectedSymbol: 'FPT',
    chartData: [],
    botStatus: { isRunning: true, autoTradeEnabled: true },
    config: { hasApiKey: false },
    activeTab: 'holdings'
  };

  // DOM Elements
  const el = {
    // Top Bar
    clock: document.getElementById('marketClock'),
    marketSession: document.getElementById('marketSessionBadge'),
    botStatusPill: document.getElementById('botStatusPill'),
    toggleBotBtn: document.getElementById('toggleBotBtn'),
    forceScanBtn: document.getElementById('forceScanBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    resetPortfolioBtn: document.getElementById('resetPortfolioBtn'),
    sfxBtn: document.getElementById('sfxBtn'),
    scanlinesBtn: document.getElementById('scanlinesBtn'),

    // HUD Metrics
    navValue: document.getElementById('navValue'),
    navChange: document.getElementById('navChange'),
    cashValue: document.getElementById('cashValue'),
    cashRatioBar: document.getElementById('cashRatioBar'),
    dailyPnLValue: document.getElementById('dailyPnLValue'),
    dailyPnLPercent: document.getElementById('dailyPnLPercent'),
    realizedPnLValue: document.getElementById('realizedPnLValue'),
    winRateValue: document.getElementById('winRateValue'),

    // Market Watchlist
    watchlistTableBody: document.getElementById('watchlistTableBody'),

    // Terminal
    terminalOutput: document.getElementById('terminalOutput'),
    terminalInput: document.getElementById('terminalInput'),
    logFilterBtns: document.querySelectorAll('.log-filter-btn'),

    // Chart
    chartTitle: document.getElementById('chartTitle'),
    chartSubtitle: document.getElementById('chartSubtitle'),
    chartCanvas: document.getElementById('stockChartCanvas'),

    // AI Brain & News
    aiSentimentBadge: document.getElementById('aiSentimentBadge'),
    aiSummaryText: document.getElementById('aiSummaryText'),
    aiEngineBadge: document.getElementById('aiEngineBadge'),
    newsList: document.getElementById('newsList'),

    // Advanced Metrics
    mddValue: document.getElementById('mddValue'),
    profitFactorValue: document.getElementById('profitFactorValue'),
    sectorHeatmapGrid: document.getElementById('sectorHeatmapGrid'),

    // Tabs
    tabBtns: document.querySelectorAll('.cyber-tab-btn'),
    tabHoldings: document.getElementById('tabContentHoldings'),
    tabTrades: document.getElementById('tabContentTrades'),
    tabDaily: document.getElementById('tabContentDaily'),
    tabEquity: document.getElementById('tabContentEquity'),
    holdingsTableBody: document.getElementById('holdingsTableBody'),
    tradesTableBody: document.getElementById('tradesTableBody'),
    dailyTableBody: document.getElementById('dailyTableBody'),
    equityCurveCanvas: document.getElementById('equityCurveCanvas'),
    equityPeakNav: document.getElementById('equityPeakNav'),
    equityMdd: document.getElementById('equityMdd'),
    equityPf: document.getElementById('equityPf'),

    // Modals
    settingsModal: document.getElementById('settingsModal'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    modelSelect: document.getElementById('modelSelect'),
    riskSelect: document.getElementById('riskSelect'),
    settlementSelect: document.getElementById('settlementSelect'),
    intervalInput: document.getElementById('intervalInput'),
    autoTradeSwitch: document.getElementById('autoTradeSwitch'),
    telegramTokenInput: document.getElementById('telegramTokenInput'),
    telegramChatIdInput: document.getElementById('telegramChatIdInput'),
    telegramAlertsSwitch: document.getElementById('telegramAlertsSwitch'),
    testTelegramBtn: document.getElementById('testTelegramBtn'),

    backtestBtn: document.getElementById('backtestBtn'),
    backtestModal: document.getElementById('backtestModal'),
    closeBacktestBtn: document.getElementById('closeBacktestBtn'),
    runBacktestBtn: document.getElementById('runBacktestBtn'),
    backtestDaysSelect: document.getElementById('backtestDaysSelect'),
    backtestCapitalInput: document.getElementById('backtestCapitalInput'),
    backtestResultsHUD: document.getElementById('backtestResultsHUD'),
    btReturnVal: document.getElementById('btReturnVal'),
    btFinalNav: document.getElementById('btFinalNav'),
    btWinRate: document.getElementById('btWinRate'),
    btTradeStats: document.getElementById('btTradeStats'),
    btMdd: document.getElementById('btMdd'),
    btPf: document.getElementById('btPf'),
    backtestTableBody: document.getElementById('backtestTableBody'),

    manualTradeModal: document.getElementById('manualTradeModal'),
    manualTradeForm: document.getElementById('manualTradeForm'),
    manualSymbol: document.getElementById('manualSymbol'),
    manualSide: document.getElementById('manualSide'),
    manualQuantity: document.getElementById('manualQuantity'),
    manualPrice: document.getElementById('manualPrice'),
    closeManualTradeBtn: document.getElementById('closeManualTradeBtn')
  };

  // Number Formatters
  const fmtVND = (num) => (num || 0).toLocaleString('vi-VN') + ' đ';
  const fmtSign = (num) => (num > 0 ? '+' : '') + fmtVND(num);
  const fmtPct = (num) => (num > 0 ? '+' : '') + (num || 0).toFixed(2) + '%';

  // Audio helper
  const sfx = window.cyberAudio;

  // Initialize
  async function init() {
    initClock();
    initEventListeners();
    await loadInitialData();
    connectSSE();
    loadChart(state.selectedSymbol);
  }

  // Live Market Session Clock
  function initClock() {
    setInterval(() => {
      const now = new Date();
      el.clock.innerText = now.toLocaleTimeString('vi-VN', { hour12: false }) + ' ICT';

      // Check HOSE trading session
      const hour = now.getHours();
      const min = now.getMinutes();
      const timeVal = hour * 60 + min;

      // Monday = 1, Friday = 5
      const day = now.getDay();
      if (day === 0 || day === 6) {
        el.marketSession.innerText = 'CUỐI TUẦN (MÔ PHỎNG)';
        el.marketSession.className = 'tag-badge badge-sys';
      } else if (timeVal >= 9 * 60 && timeVal < 9 * 60 + 15) {
        el.marketSession.innerText = 'PHIÊN ATO';
        el.marketSession.className = 'tag-badge badge-market pulse-dot-amber';
      } else if ((timeVal >= 9 * 60 + 15 && timeVal < 11 * 60 + 30) || (timeVal >= 13 * 60 && timeVal < 14 * 60 + 30)) {
        el.marketSession.innerText = 'KHỚP LỆNH LIÊN TỤC';
        el.marketSession.className = 'tag-badge badge-trade';
      } else if (timeVal >= 14 * 60 + 30 && timeVal < 14 * 60 + 45) {
        el.marketSession.innerText = 'PHIÊN ATC';
        el.marketSession.className = 'tag-badge badge-market';
      } else {
        el.marketSession.innerText = 'THỊ TRƯỜNG ĐÓNG CỬA';
        el.marketSession.className = 'tag-badge badge-sys';
      }
    }, 1000);
  }

  // Initial Data Fetch
  async function loadInitialData() {
    try {
      const [portfolioRes, marketRes, newsRes, aiRes, logsRes, cfgRes] = await Promise.all([
        fetch('/api/portfolio').then(r => r.json()),
        fetch('/api/market').then(r => r.json()),
        fetch('/api/news').then(r => r.json()),
        fetch('/api/ai-analysis').then(r => r.json()),
        fetch('/api/logs').then(r => r.json()),
        fetch('/api/bot/config').then(r => r.json())
      ]);

      state.portfolio = portfolioRes;
      state.quotes = marketRes;
      state.news = newsRes;
      state.aiAnalysis = aiRes;
      state.logs = logsRes.reverse();
      state.config = cfgRes;

      renderAll();
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }

  // Server-Sent Events (SSE) Real-time Connection
  function connectSSE() {
    const evtSource = new EventSource('/api/stream');

    evtSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'log') {
          handleIncomingLog(payload.entry);
        } else if (payload.type === 'state_update') {
          handleStateUpdate(payload);
        } else if (payload.type === 'live_ticks') {
          handleLiveTicks(payload);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    evtSource.onerror = () => {
      console.warn('SSE stream disconnected, reconnecting automatically...');
    };
  }

  function handleLiveTicks(payload) {
    if (!payload.quotes || !Array.isArray(payload.quotes)) return;
    state.quotes = payload.quotes;

    // 1. Update Watchlist Table
    renderWatchlist();

    // 2. Real-time update to active TradingView Candlestick!
    const activeQuote = payload.quotes.find(q => q.symbol === state.selectedSymbol);
    if (activeQuote && candleSeries && state.chartData && state.chartData.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const lastCandle = state.chartData[state.chartData.length - 1];

      let liveCandle;
      if (lastCandle && lastCandle.date === todayStr) {
        lastCandle.high = Math.max(lastCandle.high, activeQuote.price);
        lastCandle.low = Math.min(lastCandle.low, activeQuote.price);
        lastCandle.close = activeQuote.price;
        lastCandle.volume = (lastCandle.volume || 1000000) + Math.round(Math.random() * 800);
        liveCandle = {
          time: todayStr,
          open: lastCandle.open,
          high: lastCandle.high,
          low: lastCandle.low,
          close: lastCandle.close
        };
      } else {
        liveCandle = {
          time: todayStr,
          open: activeQuote.refPrice || activeQuote.price,
          high: Math.max(activeQuote.refPrice || activeQuote.price, activeQuote.price),
          low: Math.min(activeQuote.refPrice || activeQuote.price, activeQuote.price),
          close: activeQuote.price
        };
      }

      // Push real-time tick to TradingView Candlestick!
      candleSeries.update(liveCandle);

      if (volumeSeries && lastCandle) {
        volumeSeries.update({
          time: todayStr,
          value: lastCandle.volume || 1000000,
          color: liveCandle.close >= liveCandle.open ? 'rgba(0, 255, 102, 0.35)' : 'rgba(255, 0, 85, 0.35)'
        });
      }

      // Update subtitle
      el.chartSubtitle.innerText = `Giá Realtime: ${fmtVND(activeQuote.price)} (${fmtPct(activeQuote.changePercent)}) | RSI: ${activeQuote.rsi ? activeQuote.rsi.toFixed(1) : '-'} | Quant: ${activeQuote.quantScore || 50}/100`;
    }

    // 3. Real-time NAV & Unrealized PnL update
    if (state.portfolio && state.portfolio.holdings) {
      let totalHoldingsVal = 0;
      for (const [sym, h] of Object.entries(state.portfolio.holdings)) {
        const q = payload.quotes.find(item => item.symbol === sym);
        if (q) {
          h.currentPrice = q.price;
          h.marketValue = h.quantity * q.price;
          h.pnl = h.marketValue - h.costValue;
          h.pnlPercent = h.costValue > 0 ? ((h.pnl / h.costValue) * 100) : 0;
          totalHoldingsVal += h.marketValue;
        }
      }
      state.portfolio.totalNav = state.portfolio.cash + totalHoldingsVal;
      state.portfolio.dailyPnL = state.portfolio.totalNav - state.portfolio.startOfDayNav;
      state.portfolio.dailyPnLPercent = state.portfolio.startOfDayNav > 0 ? (state.portfolio.dailyPnL / state.portfolio.startOfDayNav) * 100 : 0;
      renderMetrics();
    }
  }

  function handleIncomingLog(entry) {
    state.logs.push(entry);
    if (state.logs.length > 300) state.logs.shift();
    appendTerminalLine(entry);

    if (entry.category === 'TRADE') {
      if (entry.message.includes('MUA')) sfx.playBuy();
      else if (entry.message.includes('BÁN')) sfx.playSell();
    } else if (entry.category === 'RISK' || entry.level === 'ALERT') {
      sfx.playAlert();
    }
  }

  function handleStateUpdate(payload) {
    if (payload.portfolio) state.portfolio = payload.portfolio;
    if (payload.quotes) state.quotes = payload.quotes;
    if (payload.news) state.news = payload.news;
    if (payload.aiResult) state.aiAnalysis = payload.aiResult;
    if (payload.botStatus) state.botStatus = payload.botStatus;

    renderMetrics();
    renderWatchlist();
    renderHoldings();
    renderTrades();
    renderDailyTable();
    renderAIBrain();
    renderNews();

    // If currently selected chart is updated
    loadChart(state.selectedSymbol, false);
  }

  // Render All Components
  function renderAll() {
    renderMetrics();
    renderWatchlist();
    renderTerminal();
    renderHoldings();
    renderTrades();
    renderDailyTable();
    renderAIBrain();
    renderNews();
    renderBotStatus();
    loadAndRenderSectors();
    renderEquityCurve();
  }

  // Render HUD Metric Cards (10M Portfolio Capital & Daily PnL)
  function renderMetrics() {
    if (!state.portfolio) return;
    const p = state.portfolio;

    // Total NAV
    el.navValue.innerText = fmtVND(p.totalNav);
    const navDiff = p.totalNav - p.initialCapital;
    const navDiffPct = ((navDiff / p.initialCapital) * 100);
    el.navChange.innerText = `${fmtSign(navDiff)} (${fmtPct(navDiffPct)} so với vốn 10M)`;
    el.navChange.className = navDiff >= 0 ? 'text-xs text-glow-green' : 'text-xs text-glow-red';

    // Cash Balance & Ratio
    el.cashValue.innerText = fmtVND(p.cash);
    const cashRatio = Math.min(100, Math.max(0, Math.round((p.cash / p.totalNav) * 100)));
    el.cashRatioBar.style.width = cashRatio + '%';

    // Daily PnL (Trênh lệch ngày)
    el.dailyPnLValue.innerText = fmtSign(p.dailyPnL);
    el.dailyPnLValue.className = p.dailyPnL >= 0 ? 'text-xl font-bold text-glow-green' : 'text-xl font-bold text-glow-red';
    el.dailyPnLPercent.innerText = `(${fmtPct(p.dailyPnLPercent)} trong phiên)`;

    // Realized PnL & Win Rate
    el.realizedPnLValue.innerText = fmtSign(p.realizedPnL);
    el.realizedPnLValue.className = p.realizedPnL >= 0 ? 'text-sm font-semibold text-emerald-400' : 'text-sm font-semibold text-rose-400';
    el.winRateValue.innerText = `${p.stats.winRate}% (${p.stats.winningTrades}/${p.stats.closedTrades} lệnh)`;

    // Pro Quant Metrics
    if (el.mddValue) el.mddValue.innerText = (p.stats.maxDrawdown || 0).toFixed(1) + '%';
    if (el.profitFactorValue) el.profitFactorValue.innerText = (p.stats.profitFactor || 1.0).toFixed(1) + 'x';
  }

  // Render Sector Cash Flow Heatmap
  async function loadAndRenderSectors() {
    try {
      const res = await fetch('/api/sectors');
      const sectors = await res.json();
      renderSectorHeatmap(sectors);
    } catch (e) {
      // ignore
    }
  }

  function renderSectorHeatmap(sectors) {
    if (!el.sectorHeatmapGrid || !sectors) return;
    el.sectorHeatmapGrid.innerHTML = sectors.map(sec => {
      const isUp = sec.avgChange >= 0;
      const bgBorder = isUp ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-rose-500/40 bg-rose-950/20';
      const textCol = isUp ? 'text-emerald-400' : 'text-rose-400';
      const arrow = isUp ? '▲' : '▼';

      const stockChips = (sec.stocks || []).map(s => 
        `<span class="px-1 py-0.5 rounded text-[9px] font-mono ${s.changePercent >= 0 ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'} cursor-pointer" onclick="window.selectSymbol('${s.symbol}')">${s.symbol}</span>`
      ).join('');

      return `
        <div class="p-2 rounded border ${bgBorder} flex flex-col justify-between">
          <div class="flex items-center justify-between text-[11px] font-bold">
            <span class="text-slate-200 tracking-wider truncate">${sec.name}</span>
            <span class="${textCol} font-mono">${arrow} ${fmtPct(sec.avgChange)}</span>
          </div>
          <div class="flex flex-wrap gap-1 mt-1.5">
            ${stockChips}
          </div>
          <div class="text-[9px] text-slate-400 mt-1.5 pt-1 border-t border-slate-800/80 flex justify-between font-mono">
            <span>Score: <b class="${sec.avgScore >= 60 ? 'text-emerald-400' : 'text-amber-400'}">${sec.avgScore}/100</b></span>
            <span>${sec.stockCount} mã</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Equity Curve (NAV progression chart)
  function renderEquityCurve() {
    const canvas = el.equityCurveCanvas;
    if (!canvas || !state.portfolio) return;

    const snapshots = (state.portfolio.dailySnapshots && state.portfolio.dailySnapshots.length > 0)
      ? state.portfolio.dailySnapshots
      : [{ date: new Date().toISOString().split('T')[0], nav: state.portfolio.totalNav || 10000000 }];

    const todayStr = new Date().toISOString().split('T')[0];
    const points = [...snapshots];
    const lastSnap = points[points.length - 1];
    if (!lastSnap || lastSnap.date !== todayStr) {
      points.push({ date: todayStr, nav: state.portfolio.totalNav });
    } else {
      points[points.length - 1].nav = state.portfolio.totalNav;
    }

    if (el.equityPeakNav) {
      const peak = Math.max(...points.map(p => p.nav), state.portfolio.initialCapital);
      el.equityPeakNav.innerText = fmtVND(peak);
    }
    if (el.equityMdd && state.portfolio.stats) {
      el.equityMdd.innerText = (state.portfolio.stats.maxDrawdown || 0).toFixed(1) + '%';
    }
    if (el.equityPf && state.portfolio.stats) {
      el.equityPf.innerText = (state.portfolio.stats.profitFactor || 1.0).toFixed(1) + 'x';
    }

    const ctx = canvas.getContext('2d');
    const width = (canvas.width = canvas.parentElement.clientWidth || 600);
    const height = (canvas.height = 240);

    ctx.clearRect(0, 0, width, height);

    const padLeft = 70;
    const padRight = 30;
    const padTop = 20;
    const padBottom = 30;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const navs = points.map(p => p.nav);
    let minNav = Math.min(...navs, 9500000);
    let maxNav = Math.max(...navs, 10500000);
    const range = (maxNav - minNav) || 1;

    // Horizontal gridlines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = minNav + (range / steps) * i;
      const y = padTop + chartH - (i / steps) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillText((Math.round(val / 1000)).toLocaleString() + 'k', padLeft - 8, y + 3);
    }

    // Benchmark line at 10M initial capital
    const y10M = padTop + chartH - ((10000000 - minNav) / range) * chartH;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.moveTo(padLeft, y10M);
    ctx.lineTo(width - padRight, y10M);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('10M VỐN GỐC', width - padRight, y10M - 4);

    // Plot Equity line
    ctx.beginPath();
    points.forEach((pt, idx) => {
      const x = padLeft + (idx / Math.max(1, points.length - 1)) * chartW;
      const y = padTop + chartH - ((pt.nav - minNav) / range) * chartH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Data points & dates
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'center';
    points.forEach((pt, idx) => {
      const x = padLeft + (idx / Math.max(1, points.length - 1)) * chartW;
      const y = padTop + chartH - ((pt.nav - minNav) / range) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      if (idx === 0 || idx === points.length - 1 || idx % Math.ceil(points.length / 5) === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(pt.date.substring(5), x, height - 10);
        ctx.fillStyle = '#00f0ff';
      }
    });
  }

  // Render Watchlist Table
  function renderWatchlist() {
    if (!state.quotes || state.quotes.length === 0) return;

    el.watchlistTableBody.innerHTML = state.quotes.map(q => {
      const isSelected = q.symbol === state.selectedSymbol;
      const isUp = q.change >= 0;
      const colorCls = isUp ? 'text-emerald-400' : 'text-rose-400';
      const rsiColor = q.rsi < 35 ? 'text-emerald-400 font-bold' : (q.rsi > 70 ? 'text-rose-400 font-bold' : 'text-slate-300');
      
      const qScore = q.quantScore || 50;
      const qScoreCls = qScore >= 70 ? 'text-emerald-400 font-bold' : (qScore <= 35 ? 'text-rose-400 font-bold' : 'text-amber-400');
      const volCls = (q.volSurge || 1.0) >= 1.5 ? 'text-cyan-400 font-bold animate-pulse' : 'text-slate-400';

      return `
        <tr class="cursor-pointer ${isSelected ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : ''}" onclick="window.selectSymbol('${q.symbol}')">
          <td class="font-bold text-glow-cyan flex items-center gap-2">
            ${q.symbol}
            ${isSelected ? '<span class="text-xs text-cyan-400">▶</span>' : ''}
          </td>
          <td class="font-mono font-semibold">${fmtVND(q.price)}</td>
          <td class="${colorCls} font-mono">${fmtPct(q.changePercent)}</td>
          <td class="${qScoreCls} font-mono">${qScore}/100</td>
          <td class="${rsiColor} font-mono">${q.rsi.toFixed(1)}</td>
          <td class="${volCls} font-mono text-xs">${(q.volSurge || 1.0).toFixed(1)}x</td>
          <td>
            <span class="tag-badge ${q.signal === 'BUY' || q.signal === 'STRONG_BUY' ? 'badge-trade' : (q.signal === 'SELL' ? 'badge-risk' : 'badge-sys')}">
              ${q.signal}
            </span>
          </td>
          <td>
            <button class="cyber-btn cyber-btn-cyan text-xs py-0.5 px-2" onclick="event.stopPropagation(); window.openManualTrade('${q.symbol}', 'BUY')">
              LỆNH
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Render Terminal Logs
  function renderTerminal(filter = 'ALL') {
    el.terminalOutput.innerHTML = '';
    const filtered = filter === 'ALL'
      ? state.logs
      : state.logs.filter(l => l.category === filter);

    filtered.forEach(appendTerminalLine);
    el.terminalOutput.scrollTop = el.terminalOutput.scrollHeight;
  }

  function appendTerminalLine(entry) {
    const div = document.createElement('div');
    div.className = 'terminal-line';

    let badgeClass = 'badge-sys';
    if (entry.category === 'AI_BRAIN') badgeClass = 'badge-ai';
    else if (entry.category === 'TRADE') badgeClass = 'badge-trade';
    else if (entry.category === 'RISK') badgeClass = 'badge-risk';
    else if (entry.category === 'MARKET') badgeClass = 'badge-market';

    div.innerHTML = `
      <span class="text-slate-500 text-xs shrink-0">${entry.timeFormatted}</span>
      <span class="tag-badge ${badgeClass} shrink-0">[${entry.category}]</span>
      <span class="${entry.level === 'SUCCESS' ? 'text-emerald-400' : (entry.level === 'ALERT' || entry.level === 'ERROR' ? 'text-rose-400 font-semibold' : 'text-slate-200')}">
        ${escapeHtml(entry.message)}
      </span>
    `;

    el.terminalOutput.appendChild(div);
    // Keep max 200 elements in DOM
    if (el.terminalOutput.children.length > 200) {
      el.terminalOutput.removeChild(el.terminalOutput.children[0]);
    }
    el.terminalOutput.scrollTop = el.terminalOutput.scrollHeight;
  }

  // Render Holdings
  function renderHoldings() {
    if (!state.portfolio) return;
    const holdings = Object.values(state.portfolio.holdings || {});

    if (holdings.length === 0) {
      el.holdingsTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-6 text-slate-500 italic">
            [DANH MỤC TRỐNG] Robot đang nắm giữ 100% tiền mặt sẵn sàng giải ngân khi có tín hiệu chuẩn.
          </td>
        </tr>
      `;
      return;
    }

    el.holdingsTableBody.innerHTML = holdings.map(h => {
      const pnlCls = h.pnl >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold';
      const avail = h.availableQuantity || 0;
      const pend = h.pendingQuantity || 0;
      const canSell = avail > 0;
      return `
        <tr>
          <td class="font-bold text-glow-cyan">${h.symbol}</td>
          <td class="font-mono font-semibold">${h.quantity} CP</td>
          <td class="font-mono ${canSell ? 'text-emerald-400 font-bold' : 'text-slate-500'}">${avail} CP</td>
          <td class="font-mono text-amber-400 text-xs">${pend > 0 ? pend + ' CP (Chờ T+2.5)' : '-'}</td>
          <td class="font-mono text-slate-400">${fmtVND(h.avgPrice)}</td>
          <td class="font-mono font-semibold">${fmtVND(h.currentPrice)}</td>
          <td class="${pnlCls} font-mono">${fmtSign(h.pnl)} (${fmtPct(h.pnlPercent)})</td>
          <td>
            ${canSell ? `
              <button class="cyber-btn cyber-btn-danger text-xs py-0.5 px-2" onclick="window.quickSell('${h.symbol}', ${avail})">
                BÁN (${avail} CP)
              </button>
            ` : `
              <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/60 text-amber-400 border border-amber-500/30 cursor-not-allowed" title="Cổ phiếu đang chờ thanh toán T+2.5 từ VSD">
                ⏳ CHỜ VỀ T+2.5
              </span>
            `}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Render Trades Audit Ledger
  function renderTrades() {
    if (!state.portfolio || !state.portfolio.trades) return;
    const trades = state.portfolio.trades;

    if (trades.length === 0) {
      el.tradesTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-6 text-slate-500 italic">
            Chưa phát sinh giao dịch nào. Robot sẽ tự động đặt lệnh khi quét được cơ hội.
          </td>
        </tr>
      `;
      return;
    }

    el.tradesTableBody.innerHTML = trades.slice(0, 30).map(t => {
      const sideCls = t.side === 'BUY' ? 'badge-trade' : 'badge-risk';
      const sideText = t.side === 'BUY' ? 'MUA' : 'BÁN';
      const pnlDisplay = t.side === 'SELL' ? `<span class="${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${fmtSign(t.pnl)}</span>` : '-';

      return `
        <tr>
          <td class="text-slate-400 text-xs">${t.timeFormatted || t.timestamp.split('T')[1].slice(0, 8)}</td>
          <td><span class="tag-badge ${sideCls}">${sideText}</span></td>
          <td class="font-bold text-glow-cyan">${t.symbol}</td>
          <td class="font-mono">${t.quantity} CP</td>
          <td class="font-mono">${fmtVND(t.price)}</td>
          <td class="font-mono">${pnlDisplay}</td>
          <td class="text-xs text-slate-300 max-w-xs truncate" title="${escapeHtml(t.aiReason)}">
            ${escapeHtml(t.aiReason)}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Render Daily Tracking History
  function renderDailyTable() {
    if (!state.portfolio || !state.portfolio.dailySnapshots) return;
    const snapshots = [...state.portfolio.dailySnapshots].reverse();

    el.dailyTableBody.innerHTML = snapshots.map(s => {
      const pnlCls = s.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400';
      return `
        <tr>
          <td class="font-bold text-slate-300">${s.date}</td>
          <td class="font-mono font-semibold">${fmtVND(s.nav)}</td>
          <td class="font-mono text-slate-400">${fmtVND(s.cash)}</td>
          <td class="${pnlCls} font-mono font-bold">${fmtSign(s.pnl)}</td>
          <td class="${pnlCls} font-mono">${fmtPct(s.changePercent)}</td>
        </tr>
      `;
    }).join('');
  }

  // Render AI Brain Summary
  function renderAIBrain() {
    if (!state.aiAnalysis) return;
    const ai = state.aiAnalysis;

    el.aiSummaryText.innerText = ai.summaryAnalysis || 'Hệ thống đang thu thập tin tức và tổng hợp tín hiệu.';

    const sent = ai.marketSentiment || 'NEUTRAL';
    el.aiSentimentBadge.innerText = `XU HƯỚNG: ${sent}`;
    if (sent === 'BULLISH') el.aiSentimentBadge.className = 'tag-badge badge-trade';
    else if (sent === 'BEARISH') el.aiSentimentBadge.className = 'tag-badge badge-risk';
    else el.aiSentimentBadge.className = 'tag-badge badge-sys';

    el.aiEngineBadge.innerText = ai.engine === 'GEMINI_AI'
      ? `CORE: GOOGLE GEMINI (${ai.model})`
      : `CORE: QUANT ALGO RULE v2.5 (NHẬP API KEY ĐỂ NÂNG CẤP GEMINI)`;
  }

  // Render News
  function renderNews() {
    if (!state.news || state.news.length === 0) return;

    el.newsList.innerHTML = state.news.slice(0, 5).map(n => {
      let sentBadgeCls = 'badge-sys';
      if (n.sentiment === 'POSITIVE') sentBadgeCls = 'badge-trade';
      else if (n.sentiment === 'NEGATIVE') sentBadgeCls = 'badge-risk';

      const symbolsBadge = n.symbols.map(s => `<span class="tag-badge badge-ai mr-1">${s}</span>`).join('');

      return `
        <div class="p-2.5 rounded bg-slate-900/40 border border-slate-800/80 hover:border-cyan-500/40 transition">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="text-slate-500">${n.pubDate ? n.pubDate.slice(0, 22) : 'Vừa xong'}</span>
            <span class="tag-badge ${sentBadgeCls}">${n.sentimentLabel}</span>
          </div>
          <a href="${n.link}" target="_blank" class="text-xs font-semibold text-cyan-200 hover:text-cyan-400 block mb-1">
            ${escapeHtml(n.title)}
          </a>
          <div class="flex items-center gap-1 mt-1">
            ${symbolsBadge}
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Bot Status
  function renderBotStatus() {
    const isRunning = state.botStatus.isRunning;
    if (isRunning) {
      el.botStatusPill.innerHTML = '<span class="pulse-dot pulse-dot-green"></span> TỰ HÀNH: BẬT';
      el.toggleBotBtn.innerText = 'TẠM DỪNG BOT';
      el.toggleBotBtn.className = 'cyber-btn cyber-btn-danger text-xs';
    } else {
      el.botStatusPill.innerHTML = '<span class="pulse-dot pulse-dot-red"></span> TỰ HÀNH: ĐÃ DỪNG';
      el.toggleBotBtn.innerText = 'KÍCH HOẠT BOT';
      el.toggleBotBtn.className = 'cyber-btn text-xs';
    }
  }

  // TradingView Lightweight Charts State
  let tvChart = null;
  let candleSeries = null;
  let sma20Series = null;
  let sma50Series = null;
  let volumeSeries = null;

  function initTradingViewChart() {
    const container = document.getElementById('tvChartContainer');
    if (!container || typeof LightweightCharts === 'undefined') return false;

    if (tvChart) return true;

    try {
      tvChart = LightweightCharts.createChart(container, {
        width: container.clientWidth || 600,
        height: 320,
        layout: {
          background: { type: 'solid', color: 'rgba(5, 8, 17, 0.95)' },
          textColor: '#94a3b8',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
        },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal,
          vertLine: { color: 'rgba(0, 240, 255, 0.5)', width: 1, style: 2 },
          horzLine: { color: 'rgba(0, 240, 255, 0.5)', width: 1, style: 2 },
        },
        rightPriceScale: {
          borderColor: 'rgba(0, 240, 255, 0.2)',
          scaleMargins: { top: 0.08, bottom: 0.22 },
        },
        timeScale: {
          borderColor: 'rgba(0, 240, 255, 0.2)',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      // Volume histogram overlay
      volumeSeries = tvChart.addHistogramSeries({
        color: 'rgba(0, 240, 255, 0.25)',
        priceFormat: { type: 'volume' },
        priceScaleId: '', // overlay
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
      });

      // Candlestick series
      candleSeries = tvChart.addCandlestickSeries({
        upColor: '#00ff66',
        downColor: '#ff0055',
        borderVisible: false,
        wickUpColor: '#00ff66',
        wickDownColor: '#ff0055',
      });

      // SMA20 line series (Cyan)
      sma20Series = tvChart.addLineSeries({
        color: '#00f0ff',
        lineWidth: 2,
        title: 'MA20',
      });

      // SMA50 line series (Amber)
      sma50Series = tvChart.addLineSeries({
        color: '#ffb700',
        lineWidth: 1.5,
        title: 'MA50',
      });

      // Crosshair hover tooltip update
      tvChart.subscribeCrosshairMove(param => {
        const readout = document.getElementById('chartOhlcReadout');
        if (!readout) return;

        if (!param || !param.time || !param.seriesData.has(candleSeries)) {
          readout.innerHTML = `<span class="text-slate-500">ĐƯA CHUỘT VÀO NẾN ĐỂ XEM CHI TIẾT</span>`;
          return;
        }

        const data = param.seriesData.get(candleSeries);
        const volData = param.seriesData.get(volumeSeries);
        const isUp = data.close >= data.open;
        const colorCls = isUp ? 'text-emerald-400' : 'text-rose-400';

        readout.innerHTML = `
          <span class="text-cyan-400 font-bold">${param.time}</span> |
          Mở: <span class="text-slate-200">${fmtVND(data.open)}</span> |
          Cao: <span class="text-emerald-400">${fmtVND(data.high)}</span> |
          Thấp: <span class="text-rose-400">${fmtVND(data.low)}</span> |
          Đóng: <span class="${colorCls} font-bold">${fmtVND(data.close)}</span> |
          Vol: <span class="text-slate-300">${volData ? (volData.value / 1000).toLocaleString('vi-VN') + ' CP' : '-'}</span>
        `;
      });

      window.addEventListener('resize', () => {
        if (tvChart && container) {
          tvChart.applyOptions({ width: container.clientWidth });
        }
      });

      return true;
    } catch (e) {
      console.warn('Lightweight Charts init error:', e);
      return false;
    }
  }

  // Interactive Candlestick / Line Chart
  async function loadChart(symbol, fetchNew = true) {
    state.selectedSymbol = symbol;
    el.chartTitle.innerText = `BIỂU ĐỒ NẾN KỸ THUẬT: ${symbol}`;

    const quote = state.quotes.find(q => q.symbol === symbol);
    if (quote) {
      el.chartSubtitle.innerText = `Giá: ${fmtVND(quote.price)} | RSI: ${quote.rsi.toFixed(1)} | Quant Score: ${quote.quantScore || 50}/100 | ${quote.trendText}`;
    }

    if (fetchNew || state.chartData.length === 0) {
      try {
        const res = await fetch(`/api/chart/${symbol}`);
        state.chartData = await res.json();
      } catch (e) {
        console.error('Failed to load chart data:', e);
      }
    }

    renderChartData(state.chartData, symbol);
  }

  function renderChartData(rawCandles, symbol) {
    if (!rawCandles || rawCandles.length === 0) return;

    // Deduplicate and sort by date ascending
    const dateMap = new Map();
    rawCandles.forEach(c => {
      const dStr = c.date || new Date(c.time).toISOString().split('T')[0];
      dateMap.set(dStr, {
        time: dStr,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 1000000
      });
    });

    const candles = Array.from(dateMap.values()).sort((a, b) => a.time.localeCompare(b.time));

    const isTvReady = initTradingViewChart();

    if (isTvReady && tvChart && candleSeries) {
      // 1. Candlestick series
      candleSeries.setData(candles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      })));

      // 2. Volume series
      if (volumeSeries) {
        volumeSeries.setData(candles.map(c => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(0, 255, 102, 0.3)' : 'rgba(255, 0, 85, 0.3)'
        })));
      }

      // 3. SMA20 series
      if (sma20Series) {
        sma20Series.setData(calculateSMAData(candles, 20));
      }

      // 4. SMA50 series
      if (sma50Series) {
        sma50Series.setData(calculateSMAData(candles, 50));
      }

      // 5. BUY / SELL Points (Markers)
      const markers = generateChartMarkers(candles, symbol);
      candleSeries.setMarkers(markers);

      tvChart.timeScale().fitContent();
    } else {
      // Fallback Canvas Renderer
      drawFallbackCanvasChart(candles, symbol);
    }
  }

  function calculateSMAData(candles, period) {
    const data = [];
    if (candles.length < period) return data;
    for (let i = period - 1; i < candles.length; i++) {
      const sum = candles.slice(i - period + 1, i + 1).reduce((acc, c) => acc + c.close, 0);
      data.push({
        time: candles[i].time,
        value: Math.round(sum / period)
      });
    }
    return data;
  }

  function generateChartMarkers(sortedCandles, symbol) {
    const markers = [];
    const dateSet = new Set(sortedCandles.map(c => c.time));

    // A. Markers from executed trades in portfolio
    if (state.portfolio && Array.isArray(state.portfolio.trades)) {
      state.portfolio.trades.forEach(t => {
        if (t.symbol === symbol) {
          const tradeDate = t.timestamp.split('T')[0];
          let targetDate = dateSet.has(tradeDate) ? tradeDate : null;
          if (!targetDate && sortedCandles.length > 0) {
            targetDate = sortedCandles[sortedCandles.length - 1].time;
          }

          if (targetDate && !markers.some(m => m.time === targetDate && m.text.includes(t.side === 'BUY' ? 'MUA' : 'BÁN'))) {
            if (t.side === 'BUY') {
              markers.push({
                time: targetDate,
                position: 'belowBar',
                color: '#00ff66',
                shape: 'arrowUp',
                text: `MUA ${t.quantity} CP @ ${(t.price / 1000).toFixed(1)}K`,
                size: 2
              });
            } else {
              markers.push({
                time: targetDate,
                position: 'aboveBar',
                color: '#ff0055',
                shape: 'arrowDown',
                text: `BÁN ${t.quantity} CP @ ${(t.price / 1000).toFixed(1)}K`,
                size: 2
              });
            }
          }
        }
      });
    }

    // B. Historical Quant Strategy Signals (Visual guide on previous swings)
    if (sortedCandles.length >= 25) {
      const closes = sortedCandles.map(c => c.close);
      for (let i = 15; i < sortedCandles.length - 2; i += 7) {
        const slice = closes.slice(0, i + 1);
        const candle = sortedCandles[i];
        const ma15 = slice.slice(-15).reduce((a, b) => a + b, 0) / 15;

        if (candle.close > ma15 && candle.open <= ma15 && !markers.some(m => m.time === candle.time)) {
          markers.push({
            time: candle.time,
            position: 'belowBar',
            color: '#00ff66',
            shape: 'arrowUp',
            text: `MUA @ ${(candle.close / 1000).toFixed(1)}K`,
            size: 1.5
          });
        } else if (candle.close < ma15 * 0.98 && !markers.some(m => m.time === candle.time)) {
          markers.push({
            time: candle.time,
            position: 'aboveBar',
            color: '#ff0055',
            shape: 'arrowDown',
            text: `BÁN @ ${(candle.close / 1000).toFixed(1)}K`,
            size: 1.5
          });
        }
      }
    }

    // Markers must be sorted strictly by time ascending in TradingView
    markers.sort((a, b) => a.time.localeCompare(b.time));
    return markers;
  }

  function drawFallbackCanvasChart(candles, symbol) {
    const canvas = el.chartCanvas;
    if (!canvas || !candles || candles.length === 0) return;
    canvas.classList.remove('hidden');

    const ctx = canvas.getContext('2d');
    const width = (canvas.width = canvas.parentElement.clientWidth || 600);
    const height = (canvas.height = 300);

    ctx.clearRect(0, 0, width, height);
    const padL = 10, padR = 60, padT = 20, padB = 30;
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    const prices = candles.flatMap(c => [c.low, c.high]);
    const minP = Math.min(...prices) * 0.99;
    const maxP = Math.max(...prices) * 1.01;
    const rangeP = maxP - minP || 1;

    // Draw candles
    const n = candles.length;
    const stepX = chartW / n;
    const candleWidth = Math.max(3, Math.min(16, stepX * 0.7));

    candles.forEach((c, idx) => {
      const x = padL + idx * stepX + stepX / 2;
      const isGreen = c.close >= c.open;
      const yHigh = padT + chartH * (1 - (c.high - minP) / rangeP);
      const yLow = padT + chartH * (1 - (c.low - minP) / rangeP);
      const yOpen = padT + chartH * (1 - (c.open - minP) / rangeP);
      const yClose = padT + chartH * (1 - (c.close - minP) / rangeP);

      ctx.strokeStyle = isGreen ? '#00ff66' : '#ff0055';
      ctx.fillStyle = isGreen ? '#00ff66' : '#ff0055';

      // Wick
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Body
      const topY = Math.min(yOpen, yClose);
      const bodyH = Math.max(2, Math.abs(yClose - yOpen));
      ctx.fillRect(x - candleWidth / 2, topY, candleWidth, bodyH);

      // Buy/Sell point triangles on sample candles
      if (idx === Math.floor(n * 0.35)) {
        // Buy marker
        ctx.fillStyle = '#00ff66';
        ctx.beginPath();
        ctx.moveTo(x, yLow + 8);
        ctx.lineTo(x - 5, yLow + 16);
        ctx.lineTo(x + 5, yLow + 16);
        ctx.closePath();
        ctx.fill();
        ctx.font = '10px monospace';
        ctx.fillText('▲ MUA', x - 15, yLow + 26);
      } else if (idx === Math.floor(n * 0.8)) {
        // Sell marker
        ctx.fillStyle = '#ff0055';
        ctx.beginPath();
        ctx.moveTo(x, yHigh - 8);
        ctx.lineTo(x - 5, yHigh - 16);
        ctx.lineTo(x + 5, yHigh - 16);
        ctx.closePath();
        ctx.fill();
        ctx.font = '10px monospace';
        ctx.fillText('▼ BÁN', x - 15, yHigh - 20);
      }
    });
  }

  // Terminal Interactive Input Handling
  function initTerminalInput() {
    el.terminalInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const cmd = el.terminalInput.value.trim();
        if (!cmd) return;
        el.terminalInput.value = '';
        sfx.playKeyClick();

        appendTerminalLine({
          timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
          category: 'USER_CLI',
          level: 'INFO',
          message: `$ ${cmd}`
        });

        await handleTerminalCommand(cmd);
      }
    });
  }

  async function handleTerminalCommand(cmdText) {
    // Direct question to Gemini Co-Pilot if starts with @ or ?
    if (cmdText.startsWith('@') || cmdText.startsWith('?')) {
      const query = cmdText.replace(/^[@?]\s*(gemini)?\s*/i, '').trim();
      if (!query) {
        appendTerminalLine({
          timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
          category: 'AI_COPILOT',
          level: 'WARN',
          message: 'Cú pháp hỏi AI: @gemini <câu hỏi> (ví dụ: @gemini nhận định mã HPG hôm nay)'
        });
        return;
      }

      appendTerminalLine({
        timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
        category: 'AI_COPILOT',
        level: 'INFO',
        message: 'Đang kết nối Gemini 2.5 Flash Neural Co-Pilot...'
      });
      sfx.playScan();

      try {
        const res = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        const data = await res.json();
        appendTerminalLine({
          timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
          category: 'AI_COPILOT',
          level: 'SUCCESS',
          message: `🤖 [GEMINI CO-PILOT]: ${data.reply || data.error}`
        });
        sfx.playSuccess();
      } catch (e) {
        appendTerminalLine({
          timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
          category: 'AI_COPILOT',
          level: 'ERROR',
          message: `Lỗi kết nối AI: ${e.message}`
        });
      }
      return;
    }

    const parts = cmdText.split(' ').filter(p => p.length > 0);
    const action = parts[0].toLowerCase();

    switch (action) {
      case 'help':
        appendTerminalLine({
          timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
          category: 'CLI_HELP',
          level: 'SUCCESS',
          message: 'LỆNH: @gemini <câu hỏi> | backtest | scan | buy <SYM> <QTY> | sell <SYM> <QTY> | sectors | status | reset | clear | sfx | matrix'
        });
        break;

      case 'backtest':
        openModal(el.backtestModal);
        break;

      case 'sectors':
        await loadAndRenderSectors();
        appendTerminalLine({
          timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
          category: 'SECTOR',
          level: 'INFO',
          message: 'Đã cập nhật bản đồ nhiệt dòng tiền sóng ngành VN30.'
        });
        break;

      case 'scan':
        sfx.playScan();
        await fetch('/api/bot/scan-now', { method: 'POST' });
        break;

      case 'buy':
        if (parts.length >= 3) {
          const sym = parts[1].toUpperCase();
          const qty = parseInt(parts[2], 10);
          await executeManualTrade(sym, 'BUY', qty);
        } else {
          appendTerminalLine({
            timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
            category: 'CLI_ERROR',
            level: 'ERROR',
            message: 'Cú pháp: buy <MÃ_CP> <SỐ_LƯỢNG> (ví dụ: buy FPT 50)'
          });
        }
        break;

      case 'sell':
        if (parts.length >= 3) {
          const sym = parts[1].toUpperCase();
          const qty = parseInt(parts[2], 10);
          await executeManualTrade(sym, 'SELL', qty);
        } else {
          appendTerminalLine({
            timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
            category: 'CLI_ERROR',
            level: 'ERROR',
            message: 'Cú pháp: sell <MÃ_CP> <SỐ_LƯỢNG> (ví dụ: sell FPT 50)'
          });
        }
        break;

      case 'status':
        appendTerminalLine({
          timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
          category: 'SYS',
          level: 'INFO',
          message: `NAV: ${fmtVND(state.portfolio.totalNav)} | Tiền mặt: ${fmtVND(state.portfolio.cash)} | Bot: ${state.botStatus.isRunning ? 'RUNNING' : 'PAUSED'}`
        });
        break;

      case 'clear':
        el.terminalOutput.innerHTML = '';
        break;

      case 'reset':
        if (confirm('Khởi tạo lại danh mục vốn 10.000.000 VNĐ?')) {
          await fetch('/api/portfolio/reset', { method: 'POST' });
        }
        break;

      case 'matrix':
        const rainCanvas = document.getElementById('matrixCanvas');
        rainCanvas.style.display = rainCanvas.style.display === 'none' ? 'block' : 'none';
        break;

      case 'sfx':
        const muted = sfx.toggleMute();
        el.sfxBtn.innerText = muted ? 'SFX: TẮT' : 'SFX: BẬT';
        break;

      default:
        appendTerminalLine({
          timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
          category: 'CLI_UNKNOWN',
          level: 'WARN',
          message: `Không nhận diện lệnh '${action}'. Gõ 'help' để xem danh sách.`
        });
    }
  }

  // Manual Trade Exec
  async function executeManualTrade(symbol, side, quantity, price = null) {
    try {
      const res = await fetch('/api/trade/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, side, quantity, price })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || data.message || 'Lệnh thất bại');
      } else {
        if (side === 'BUY') sfx.playBuy();
        else sfx.playSell();
        closeModal(el.manualTradeModal);

        if (data.portfolio) {
          state.portfolio = data.portfolio;
          renderHUD();
          renderHoldings();
          renderTrades();
          renderEquityCurve();
        }

        const actionText = side === 'BUY' ? 'MUA' : 'BÁN';
        const tradeInfo = data.trade;
        const netText = side === 'SELL'
          ? `Đã thu về: +${fmtVND(tradeInfo.netProceeds)} tiền mặt! Số dư tiền mặt khả dụng hiện tại: ${fmtVND(data.portfolio.cash)}.`
          : `Đã thanh toán: ${fmtVND(tradeInfo.total)}. Số dư tiền mặt còn lại: ${fmtVND(data.portfolio.cash)}.`;

        appendTerminalLine({
          timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
          category: 'TRADE_MANUAL',
          level: 'SUCCESS',
          message: `[KHỚP LỆNH ${actionText}] ${symbol}: ${quantity} CP @ ${fmtVND(tradeInfo.price)}. ${netText}`
        });

        alert(`✅ Khớp lệnh ${actionText} ${quantity} CP ${symbol} thành công!\n\n${netText}`);
      }
    } catch (e) {
      alert('Lỗi gửi lệnh: ' + e.message);
    }
  }

  // Global Handlers
  window.selectSymbol = function (sym) {
    sfx.playKeyClick();
    loadChart(sym);
    renderWatchlist();
    const dropdown = document.getElementById('quickSymbolSelect');
    if (dropdown) dropdown.value = sym;
  };

  window.quickSell = function (sym, qty) {
    if (confirm(`Xác nhận bán ${qty} cổ phiếu ${sym} theo giá thị trường?`)) {
      executeManualTrade(sym, 'SELL', qty);
    }
  };

  window.openManualTrade = function (sym, side = 'BUY') {
    sfx.playKeyClick();
    const quote = state.quotes.find(q => q.symbol === sym);
    el.manualSymbol.value = sym;
    el.manualSide.value = side;
    el.manualPrice.value = quote ? quote.price : '';
    el.manualQuantity.value = 50;
    openModal(el.manualTradeModal);
  };

  function openModal(modal) {
    modal.classList.remove('hidden');
  }

  function closeModal(modal) {
    modal.classList.add('hidden');
  }

  // Event Listeners Setup
  function initEventListeners() {
    initTerminalInput();

    // Force Scan
    el.forceScanBtn.addEventListener('click', async () => {
      sfx.playScan();
      el.forceScanBtn.disabled = true;
      el.forceScanBtn.innerText = 'ĐANG QUÉT...';
      try {
        await fetch('/api/bot/scan-now', { method: 'POST' });
      } finally {
        setTimeout(() => {
          el.forceScanBtn.disabled = false;
          el.forceScanBtn.innerHTML = '⚡ QUÉT AI NGAY';
        }, 3000);
      }
    });

    // Toggle Bot
    el.toggleBotBtn.addEventListener('click', async () => {
      sfx.playKeyClick();
      const res = await fetch('/api/bot/toggle', { method: 'POST' });
      const data = await res.json();
      state.botStatus.isRunning = data.isRunning;
      renderBotStatus();
    });

    // Reset Portfolio
    el.resetPortfolioBtn.addEventListener('click', async () => {
      if (confirm('CẢNH BÁO: Bạn có chắc chắn muốn reset toàn bộ danh mục về 10.000.000 VNĐ ban đầu?')) {
        sfx.playAlert();
        await fetch('/api/portfolio/reset', { method: 'POST' });
      }
    });

    // Sound FX Toggle
    el.sfxBtn.addEventListener('click', () => {
      const muted = sfx.toggleMute();
      el.sfxBtn.innerText = muted ? 'SFX: TẮT' : 'SFX: BẬT';
    });

    // Scanlines Toggle
    el.scanlinesBtn.addEventListener('click', () => {
      const overlay = document.querySelector('.scanlines');
      overlay.classList.toggle('disabled');
      el.scanlinesBtn.innerText = overlay.classList.contains('disabled') ? 'CRT: TẮT' : 'CRT: BẬT';
    });

    // Log Filters
    el.logFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sfx.playKeyClick();
        el.logFilterBtns.forEach(b => b.classList.remove('active', 'border-cyan-400', 'text-cyan-300'));
        btn.classList.add('active', 'border-cyan-400', 'text-cyan-300');
        renderTerminal(btn.dataset.filter);
      });
    });

    // Tab Navigation
    el.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sfx.playKeyClick();
        el.tabBtns.forEach(b => b.classList.remove('active', 'border-green-400', 'text-green-300', 'bg-green-950/30'));
        btn.classList.add('active', 'border-green-400', 'text-green-300', 'bg-green-950/30');

        const tab = btn.dataset.tab;
        el.tabHoldings.classList.toggle('hidden', tab !== 'holdings');
        el.tabTrades.classList.toggle('hidden', tab !== 'trades');
        el.tabDaily.classList.toggle('hidden', tab !== 'daily');
        if (el.tabEquity) {
          el.tabEquity.classList.toggle('hidden', tab !== 'equity');
          if (tab === 'equity') {
            setTimeout(renderEquityCurve, 50);
          }
        }
      });
    });

    // Backtest Modal Listeners
    if (el.backtestBtn) {
      el.backtestBtn.addEventListener('click', () => {
        sfx.playKeyClick();
        openModal(el.backtestModal);
      });
    }

    if (el.closeBacktestBtn) {
      el.closeBacktestBtn.addEventListener('click', () => closeModal(el.backtestModal));
    }

    if (el.runBacktestBtn) {
      el.runBacktestBtn.addEventListener('click', async () => {
        sfx.playScan();
        el.runBacktestBtn.disabled = true;
        el.runBacktestBtn.innerText = 'ĐANG TÍNH TOÁN DỮ LIỆU...';
        try {
          const days = parseInt(el.backtestDaysSelect.value, 10);
          const capital = parseInt(el.backtestCapitalInput.value, 10);
          const res = await fetch('/api/backtest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days, initialCapital: capital })
          });
          const data = await res.json();
          if (data && data.stats) {
            sfx.playSuccess();
            el.backtestResultsHUD.classList.remove('hidden');
            el.btReturnVal.innerText = `${data.totalReturnPercent >= 0 ? '+' : ''}${data.totalReturnPercent.toFixed(2)}%`;
            el.btReturnVal.className = data.totalReturnPercent >= 0 ? 'text-lg font-bold text-emerald-400' : 'text-lg font-bold text-rose-400';
            el.btFinalNav.innerText = fmtVND(data.finalNav);
            el.btWinRate.innerText = `${data.stats.winRate}%`;
            el.btTradeStats.innerText = `${data.stats.winningTrades}/${data.stats.closedTrades} lệnh thắng`;
            el.btMdd.innerText = `${data.stats.maxDrawdown}%`;
            el.btPf.innerText = `${data.stats.profitFactor}x`;

            el.backtestTableBody.innerHTML = (data.trades || []).map(t => {
              const isBuy = t.side === 'BUY';
              const pnlTxt = isBuy ? '-' : `${t.pnl >= 0 ? '+' : ''}${fmtVND(t.pnl)} (${t.pnlPercent}%)`;
              const pnlCls = isBuy ? 'text-slate-400' : (t.pnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold');
              return `
                <tr>
                  <td class="font-mono text-slate-400">${t.date}</td>
                  <td class="font-bold text-cyan-400">${t.symbol}</td>
                  <td><span class="tag-badge ${isBuy ? 'badge-trade' : 'badge-risk'}">${t.side}</span></td>
                  <td class="font-mono">${t.quantity}</td>
                  <td class="font-mono">${fmtVND(t.price)}</td>
                  <td class="font-mono ${pnlCls}">${pnlTxt}</td>
                  <td class="text-slate-400 truncate max-w-[200px]">${t.reason || ''}</td>
                </tr>
              `;
            }).join('');
          }
        } catch (err) {
          alert('Lỗi chạy Backtest: ' + err.message);
        } finally {
          el.runBacktestBtn.disabled = false;
          el.runBacktestBtn.innerText = '⚡ CHẠY BACKTEST NGAY';
        }
      });
    }

    // Settings Modal
    el.settingsBtn.addEventListener('click', async () => {
      sfx.playKeyClick();
      const cfg = await fetch('/api/bot/config').then(r => r.json());
      el.apiKeyInput.placeholder = cfg.hasApiKey ? `Đã cấu hình (${cfg.geminiApiKeyMasked})` : 'Nhập Gemini API Key...';
      el.modelSelect.value = cfg.model || 'gemini-2.5-flash';
      el.riskSelect.value = cfg.riskTolerance || 'BALANCED';
      el.intervalInput.value = cfg.scanIntervalSeconds || 120;
      el.autoTradeSwitch.checked = cfg.autoTradeEnabled !== false;
      if (el.settlementSelect) {
        el.settlementSelect.value = cfg.settlementMode || 'T2_5_STRICT';
      }

      if (el.telegramTokenInput) {
        el.telegramTokenInput.placeholder = cfg.hasTelegram ? `Đã cấu hình (${cfg.telegramBotTokenMasked})` : 'Nhập bot token từ @BotFather...';
      }
      if (el.telegramChatIdInput) {
        el.telegramChatIdInput.value = cfg.telegramChatId || '';
      }
      if (el.telegramAlertsSwitch) {
        el.telegramAlertsSwitch.checked = cfg.telegramAlertsEnabled !== false;
      }

      openModal(el.settingsModal);
    });

    el.closeSettingsBtn.addEventListener('click', () => closeModal(el.settingsModal));

    if (el.testTelegramBtn) {
      el.testTelegramBtn.addEventListener('click', async () => {
        const token = el.telegramTokenInput.value.trim();
        const chatId = el.telegramChatIdInput.value.trim();
        sfx.playKeyClick();
        el.testTelegramBtn.disabled = true;
        el.testTelegramBtn.innerText = 'ĐANG GỬI...';
        try {
          const res = await fetch('/api/telegram/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ botToken: token, chatId })
          });
          const d = await res.json();
          if (d.success) {
            sfx.playSuccess();
            alert('✅ Kết nối Telegram thành công! Hãy kiểm tra thông báo trên điện thoại.');
          } else {
            alert('❌ Lỗi Telegram: ' + (d.error || 'Không thể gửi tin nhắn'));
          }
        } catch (err) {
          alert('❌ Lỗi gửi test: ' + err.message);
        } finally {
          el.testTelegramBtn.disabled = false;
          el.testTelegramBtn.innerText = '🔔 TEST GỬI THỬ';
        }
      });
    }

    el.saveSettingsBtn.addEventListener('click', async () => {
      sfx.playKeyClick();
      const body = {
        model: el.modelSelect.value,
        riskTolerance: el.riskSelect.value,
        scanIntervalSeconds: parseInt(el.intervalInput.value, 10),
        autoTradeEnabled: el.autoTradeSwitch.checked
      };
      if (el.settlementSelect) {
        body.settlementMode = el.settlementSelect.value;
      }
      if (el.apiKeyInput.value.trim()) {
        body.geminiApiKey = el.apiKeyInput.value.trim();
      }
      if (el.telegramTokenInput && el.telegramTokenInput.value.trim()) {
        body.telegramBotToken = el.telegramTokenInput.value.trim();
      }
      if (el.telegramChatIdInput) {
        body.telegramChatId = el.telegramChatIdInput.value.trim();
      }
      if (el.telegramAlertsSwitch) {
        body.telegramAlertsEnabled = el.telegramAlertsSwitch.checked;
      }

      await fetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      closeModal(el.settingsModal);
      alert('Cấu hình hệ thống & Telegram đã được lưu thành công!');
    });

    // Manual Trade Modal
    el.closeManualTradeBtn.addEventListener('click', () => closeModal(el.manualTradeModal));

    el.manualTradeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sym = el.manualSymbol.value.toUpperCase();
      const side = el.manualSide.value;
      const qty = parseInt(el.manualQuantity.value, 10);
      const price = parseFloat(el.manualPrice.value);
      await executeManualTrade(sym, side, qty, price);
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Start app on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
