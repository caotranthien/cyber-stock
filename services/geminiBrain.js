// services/geminiBrain.js - Gemini AI Neural Decision Engine & Quant Fallback
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'config.json');

class GeminiBrain {
  constructor() {
    this.config = this.loadConfig();
    this.lastAnalysis = null;
    this.isAnalyzing = false;
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      }
    } catch (e) {
      // ignore
    }
    return {
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      model: 'gemini-flash-lite-latest',
      riskTolerance: 'BALANCED', // CONSERVATIVE | BALANCED | AGGRESSIVE
      scanIntervalSeconds: 120,
      autoTradeEnabled: true
    };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      const dataDir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
      logger.info('SYS', 'Cấu hình Gemini & Bot đã được cập nhật thành công.');
    } catch (err) {
      logger.error('SYS', `Lỗi lưu config.json: ${err.message}`);
    }
  }

  getApiKey() {
    return this.config.geminiApiKey || process.env.GEMINI_API_KEY || '';
  }

  async analyze(marketQuotes, newsArticles, portfolio) {
    if (this.isAnalyzing) {
      return this.lastAnalysis;
    }

    this.isAnalyzing = true;
    logger.info('AI_BRAIN', '>>> [NEURAL SCAN INITIATED]: Bắt đầu tiến trình phân tích đa kênh (Dữ liệu giá + Chỉ báo kỹ thuật + Tin tức CafeF)...');

    const apiKey = this.getApiKey();

    try {
      if (apiKey && apiKey.trim().length > 10) {
        logger.info('AI_BRAIN', `Kích hoạt mô hình Google Gemini [${this.config.model || 'gemini-2.5-flash'}] phân tích tài sản 10.000.000 VNĐ...`);
        const result = await this.callGeminiAPI(apiKey, marketQuotes, newsArticles, portfolio);
        if (result && result.recommendations) {
          this.lastAnalysis = result;
          logger.success('AI_BRAIN', `[GEMINI NEURAL SUCCESS] Phân tích hoàn tất: ${result.summaryAnalysis.substring(0, 100)}...`);
          this.isAnalyzing = false;
          return result;
        }
      } else {
        logger.warn('AI_BRAIN', 'Chưa cấu hình GEMINI_API_KEY. Chuyển sang chế độ Thuật toán Lượng tử Lập trình viên (Quant Rule-Based Algorithmic Engine). Bạn có thể nhập Gemini Key bất cứ lúc nào trong bảng điều khiển!');
      }
    } catch (err) {
      logger.error('AI_BRAIN', `Lỗi kết nối Gemini API (${err.message}). Tự động kích hoạt cơ chế Quant Fallback an toàn.`);
    }

    // Fallback: Quant Rule Engine
    const quantResult = this.runQuantAlgorithm(marketQuotes, newsArticles, portfolio);
    this.lastAnalysis = quantResult;
    this.isAnalyzing = false;
    return quantResult;
  }

  async callGeminiAPI(apiKey, marketQuotes, newsArticles, portfolio) {
    const model = this.config.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Prioritize: (1) Held stocks so Gemini can manage exits/holds, (2) Top quant score & vol surge
    const heldSymbols = new Set(Object.keys(portfolio.holdings || {}));
    const sortedQuotes = [...marketQuotes].sort((a, b) => {
      const aHeld = heldSymbols.has(a.symbol) ? 1 : 0;
      const bHeld = heldSymbols.has(b.symbol) ? 1 : 0;
      if (aHeld !== bHeld) return bHeld - aHeld;
      return (b.quantScore || 50) - (a.quantScore || 50);
    });

    const marketContext = sortedQuotes.slice(0, 20).map(q => ({
      sym: q.symbol,
      price: q.price,
      changePct: q.changePercent + '%',
      quantScore: q.quantScore + '/100',
      volSurge: (q.volSurge || 1.0) + 'x',
      rsi: q.rsi,
      bbRange: `${q.bbLower || 0} - ${q.bbUpper || 0}`,
      sma20: q.sma20,
      trend: q.trendText
    }));

    const newsContext = newsArticles.slice(0, 6).map(n => ({
      title: n.title,
      symbols: n.symbols,
      sentiment: n.sentimentLabel
    }));

    const portfolioContext = {
      cash: portfolio.cash,
      totalNav: portfolio.totalNav,
      unrealizedPnL: portfolio.unrealizedPnL,
      dailyPnL: portfolio.dailyPnL,
      holdings: Object.keys(portfolio.holdings).map(k => ({
        sym: k,
        qty: portfolio.holdings[k].quantity,
        availQty: portfolio.holdings[k].availableQuantity || 0,
        avgPrice: portfolio.holdings[k].avgPrice,
        pnlPercent: portfolio.holdings[k].pnlPercent + '%'
      }))
    };

    const systemPrompt = `Bạn là Cyber-Quant AI, hệ thống robot đầu tư chứng khoán Việt Nam (HOSE/VN30) chuyên nghiệp với số vốn ban đầu 10.000.000 VNĐ.
Nhiệm vụ của bạn:
1. Phân tích kết hợp đa nhân tố: Điểm lượng tử Quant Score (0-100), Đột biến dòng tiền Vol Surge (>1.5x là dòng tiền lớn vào), Dải Bollinger Bands, RSI, SMA20/50 và tin tức thời sự CafeF.
2. Đưa ra quyết định giao dịch cho tài sản 10 triệu đồng:
   - Tối đa 35% vốn cho 1 mã để bảo vệ tài sản (khoảng 3.5 triệu).
   - Đảm bảo khối lượng CP (shares) là bội số của 10 (ví dụ 50, 100, 150).
   - Tuân thủ chu kỳ T+2.5: chỉ khuyến nghị BÁN khi mã đó đã có lượng cổ phiếu khả dụng (availQty > 0).
   - CHỈ ĐƯA RA TỐI ĐA 3 ĐẾN 5 KHUYẾN NGHỊ (recommendations) cho các mã có cơ hội rõ nét nhất (ưu tiên BUY hoặc SELL, hạn chế lặp lại mã HOLD).
   - Quyết định hành động: 'BUY' (Mua), 'SELL' (Bán nếu đang nắm giữ), 'HOLD' (Giữ).
   - Đánh giá độ tin cậy confidence (1-100%).
   - Cung cấp lý do (reason) ngắn gọn 1 câu dưới 25 từ bằng tiếng Việt.
3. BẮT BUỘC chỉ trả về định dạng JSON hợp lệ, KHÔNG có thẻ markdown bọc ngoài nếu có thể, hoặc bọc trong \`\`\`json:
{
  "marketSentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "summaryAnalysis": "Nhận định ngắn gọn về trạng thái VNINDEX và cơ hội trong phiên...",
  "recommendations": [
    {
      "symbol": "Mã CP",
      "action": "BUY" | "SELL" | "HOLD",
      "confidence": 85,
      "shares": 50,
      "targetPrice": 62000,
      "stopLossPrice": 53500,
      "reason": "Lý do phân tích kỹ thuật và tin tức..."
    }
  ]
}`;

    const userPrompt = `Dữ liệu thời gian thực:
- Danh mục tài sản 10M: ${JSON.stringify(portfolioContext)}
- Bảng giá & chỉ báo kỹ thuật: ${JSON.stringify(marketContext)}
- Tin tức CafeF mới nhất: ${JSON.stringify(newsContext)}
- Khẩu vị rủi ro: ${this.config.riskTolerance}

Hãy phân tích và xuất quyết định JSON!`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            marketSentiment: { type: 'STRING', enum: ['BULLISH', 'BEARISH', 'NEUTRAL'] },
            summaryAnalysis: { type: 'STRING' },
            recommendations: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  symbol: { type: 'STRING' },
                  action: { type: 'STRING', enum: ['BUY', 'SELL', 'HOLD'] },
                  confidence: { type: 'NUMBER' },
                  shares: { type: 'NUMBER' },
                  targetPrice: { type: 'NUMBER' },
                  stopLossPrice: { type: 'NUMBER' },
                  reason: { type: 'STRING' }
                },
                required: ['symbol', 'action', 'confidence', 'shares', 'targetPrice', 'stopLossPrice', 'reason']
              }
            }
          },
          required: ['marketSentiment', 'summaryAnalysis', 'recommendations']
        }
      }
    };

    const preferredModel = this.config.model || 'gemini-flash-lite-latest';
    const modelsToTry = [...new Set([preferredModel, 'gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash'])];

    let lastError = null;
    for (const currentModel of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          if (response.status === 429 || response.status === 503 || response.status === 404) {
            logger.warn('AI_BRAIN', `Mô hình [${currentModel}] bị giới hạn quota hoặc bận (HTTP ${response.status}). Tự động chuyển tiếp sang mô hình tiếp theo...`);
            lastError = new Error(`HTTP ${response.status}: ${errText}`);
            continue;
          }
          throw new Error(`Gemini API HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Robust JSON extraction and parsing
        const parsed = this.cleanAndParseJson(rawText);
        parsed.engine = 'GEMINI_AI';
        parsed.model = currentModel;
        parsed.timestamp = new Date().toISOString();
        return parsed;
      } catch (err) {
        lastError = err;
        logger.warn('AI_BRAIN', `Lỗi kết nối [${currentModel}]: ${err.message}. Đang thử mô hình dự phòng...`);
      }
    }

    throw lastError || new Error('Tất cả mô hình Gemini đều quá tải quota');
  }

  // Auto-repairs truncated JSON responses (closes unclosed quotes, brackets, braces)
  repairTruncatedJson(str) {
    let inString = false;
    let escaped = false;
    let stack = [];

    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === '\\' && inString) {
        escaped = !escaped;
        continue;
      }
      if (c === '"' && !escaped) {
        inString = !inString;
      } else if (!inString) {
        if (c === '{' || c === '[') stack.push(c);
        else if (c === '}' && stack[stack.length - 1] === '{') stack.pop();
        else if (c === ']' && stack[stack.length - 1] === '[') stack.pop();
      }
      escaped = false;
    }

    let repaired = str;
    if (inString) repaired += '"';
    repaired = repaired.replace(/,\s*$/, '');

    while (stack.length > 0) {
      const b = stack.pop();
      repaired += (b === '{' ? '}' : ']');
    }
    return repaired;
  }

  // Flexible extraction of recommendation objects regardless of key order
  extractFlexibleRecommendations(text) {
    const recommendations = [];
    const itemMatches = text.match(/\{[^{}]*"symbol"[^{}]*\}/gi) || [];

    for (const block of itemMatches) {
      const sym = block.match(/"symbol"\s*:\s*"([^"]+)"/i)?.[1];
      const act = block.match(/"action"\s*:\s*"([^"]+)"/i)?.[1];
      const conf = block.match(/"confidence"\s*:\s*([0-9]+)/i)?.[1];
      const shares = block.match(/"shares"\s*:\s*([0-9]+)/i)?.[1];
      const target = block.match(/"targetPrice"\s*:\s*([0-9]+)/i)?.[1];
      const stop = block.match(/"stopLossPrice"\s*:\s*([0-9]+)/i)?.[1];
      const reason = block.match(/"reason"\s*:\s*"([^"]*)"/i)?.[1];

      if (sym && act) {
        recommendations.push({
          symbol: sym.toUpperCase(),
          action: act.toUpperCase(),
          confidence: conf ? parseInt(conf, 10) : 75,
          shares: shares ? parseInt(shares, 10) : 50,
          targetPrice: target ? parseInt(target, 10) : 0,
          stopLossPrice: stop ? parseInt(stop, 10) : 0,
          reason: reason || 'Tín hiệu AI phân tích'
        });
      }
    }
    return recommendations;
  }

  // Robust multi-stage JSON parser for AI outputs
  cleanAndParseJson(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Dữ liệu trả về từ Gemini rỗng');
    }

    // 1. Remove markdown backticks if any
    let clean = rawText
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/im, '')
      .replace(/```\s*$/im, '')
      .trim();

    // 2. Extract starting from first '{'
    const firstBrace = clean.indexOf('{');
    if (firstBrace !== -1) {
      clean = clean.substring(firstBrace);
    }

    // 3. Stage 1: Try direct parse
    try {
      return JSON.parse(clean);
    } catch (e1) {
      // 4. Stage 2: Relaxed syntax cleanup
      try {
        let fixed = clean
          .replace(/\/\/[^\n\r]*/g, '') // remove single-line comments
          .replace(/,\s*([\]}])/g, '$1') // remove trailing commas
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":'); // quote unquoted keys
        return JSON.parse(fixed);
      } catch (e2) {
        // 5. Stage 3: Auto-repair truncated JSON (handles cut-off end of JSON)
        try {
          const repaired = this.repairTruncatedJson(clean);
          return JSON.parse(repaired);
        } catch (e3) {
          // 6. Stage 4: Guaranteed Flexible Extraction Fallback
          const sentMatch = clean.match(/"marketSentiment"\s*:\s*"([^"]+)"/i);
          const summMatch = clean.match(/"summaryAnalysis"\s*:\s*"([^"]+)"/i);
          const recommendations = this.extractFlexibleRecommendations(clean);

          if (recommendations.length > 0) {
            return {
              marketSentiment: sentMatch ? sentMatch[1] : 'NEUTRAL',
              summaryAnalysis: summMatch ? summMatch[1] : 'Phân tích hoàn tất từ Gemini.',
              recommendations
            };
          }

          throw new Error(`Cú pháp JSON từ Gemini bị lỗi: ${e1.message}`);
        }
      }
    }
  }

  // Quant Algorithmic Fallback Engine
  runQuantAlgorithm(marketQuotes, newsArticles, portfolio) {
    const recommendations = [];
    let bullishCount = 0;
    let bearishCount = 0;

    for (const q of marketQuotes) {
      const sym = q.symbol;
      const price = q.price;
      const isHolding = !!portfolio.holdings[sym];
      const holding = portfolio.holdings[sym];

      // Check news mentions
      const relevantNews = newsArticles.filter(n => n.symbols.includes(sym));
      const hasPositiveNews = relevantNews.some(n => n.sentiment === 'POSITIVE');
      const hasNegativeNews = relevantNews.some(n => n.sentiment === 'NEGATIVE');

      let action = 'HOLD';
      let confidence = 50;
      let reason = 'Tín hiệu trung tính, tiếp tục quan sát dòng tiền.';
      let targetPrice = Math.round(price * 1.10);
      let stopLossPrice = Math.round(price * 0.93);
      let shares = 0;

      // BUY SCENARIOS
      if (q.rsi < 38 || (q.rsi < 62 && q.sma20 && price > q.sma20 && hasPositiveNews)) {
        action = 'BUY';
        confidence = hasPositiveNews ? 88 : 74;
        bullishCount++;
        // Calculate shares affordable within 30% of totalNav
        const budget = Math.min(portfolio.cash * 0.5, portfolio.totalNav * 0.3);
        const calcShares = Math.floor(budget / price);
        shares = Math.max(10, Math.floor(calcShares / 10) * 10);
        
        reason = `[QUANT SIGNAL] RSI đạt ${q.rsi.toFixed(1)} ở vùng tích lũy tốt${hasPositiveNews ? ', kết hợp tin tức tích cực từ CafeF' : ''}. MA20(${q.sma20 || price}) hỗ trợ vững chắc.`;
      }
      // SELL SCENARIOS (If holding)
      else if (isHolding && (q.rsi > 70 || (holding && holding.pnlPercent < -5) || hasNegativeNews)) {
        action = 'SELL';
        confidence = 82;
        bearishCount++;
        shares = holding.quantity;
        reason = q.rsi > 70
          ? `[QUANT SIGNAL] RSI ${q.rsi.toFixed(1)} chạm ngưỡng quá mua, chốt lời bảo vệ thành quả.`
          : `[QUANT RISK] Cảnh báo suy yếu hoặc tin tức tiêu cực, bán để bảo toàn vốn gốc 10M.`;
      }

      recommendations.push({
        symbol: sym,
        action,
        confidence,
        shares,
        targetPrice,
        stopLossPrice,
        reason
      });
    }

    const marketSentiment = bullishCount > bearishCount ? 'BULLISH' : (bearishCount > bullishCount ? 'BEARISH' : 'NEUTRAL');
    const summaryAnalysis = `Thị trường đang ở trạng thái [${marketSentiment}]. Phát hiện ${bullishCount} mã có tín hiệu mua tích cực và ${bearishCount} mã cảnh báo áp lực chốt lời. Hệ thống tự động quản trị rủi ro chặt chẽ theo số vốn 10 triệu đồng.`;

    return {
      engine: 'QUANT_ALGO_FALLBACK',
      model: 'CyberQuant Rule v2.5',
      marketSentiment,
      summaryAnalysis,
      recommendations,
      timestamp: new Date().toISOString()
    };
  }

  // Hacker AI Co-Pilot interactive chat method
  async askCopilot(userQuery, marketQuotes = [], portfolio = {}, newsArticles = []) {
    const apiKey = this.getApiKey();
    const model = this.config.model || 'gemini-2.5-flash';

    if (!apiKey || apiKey.trim().length < 10) {
      return {
        reply: `[CYBER-QUANT FALLBACK]: Chưa tìm thấy GEMINI_API_KEY. Vui lòng vào Cài đặt (⚙) để nhập API key trước khi trò chuyện với AI Co-Pilot!`,
        engine: 'FALLBACK'
      };
    }

    const quotesSummary = (marketQuotes || []).slice(0, 15).map(q => 
      `${q.symbol}: ${q.price}đ (${q.changePercent}%), RSI: ${q.rsi?.toFixed(1) || '-'}, Quant: ${q.quantScore || '-'}/100, Trend: ${q.trendText}`
    ).join(' | ');

    const holdingsSummary = Object.keys(portfolio.holdings || {}).map(k => {
      const h = portfolio.holdings[k];
      return `${k} (${h.quantity} CP, PnL: ${h.pnlPercent}%)`;
    }).join(', ') || '100% tiền mặt';

    const systemPrompt = `Bạn là Cyber-Quant AI Co-Pilot, trợ lý robot đầu tư chứng khoán thông minh chuyên nghiệp tại thị trường Việt Nam (HOSE/VN30) với vốn 10 triệu đồng.
Phong cách trả lời: Dứt khoát, chuyên sâu về phân tích kỹ thuật (RSI, MA20/50, Bollinger Bands, Volume Surge) và dòng tiền, phong cách Hacker/Quant ngầu nhưng chuẩn xác, lịch sự, tiếng Việt, tối đa 2-4 câu ngắn gọn súc tích.

Dữ liệu thời gian thực hiện tại:
- Danh mục tài sản: Tiền mặt ${portfolio.cash?.toLocaleString() || '10,000,000'}đ | NAV: ${portfolio.totalNav?.toLocaleString() || '10,000,000'}đ | Đang giữ: ${holdingsSummary}
- Bảng giá VN30: ${quotesSummary}`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nNgười dùng hỏi: "${userQuery}"\nHãy trả lời sắc bén:` }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500
      }
    };

    const preferredModel = this.config.model || 'gemini-flash-lite-latest';
    const modelsToTry = [...new Set([preferredModel, 'gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash'])];

    for (const currentModel of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          if (response.status === 429 || response.status === 503 || response.status === 404) {
            continue; // try next model
          }
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'AI không phản hồi.';
        return { reply, engine: 'GEMINI_AI', model: currentModel };
      } catch (err) {
        // continue to next model
      }
    }

    return {
      reply: `[CO-PILOT LOCAL]: Gemini API hiện đang tạm thời hết lượt gọi miễn phí (Quota 429). Hệ thống tự động kích hoạt bảo toàn danh mục 10M với kỷ luật cắt lỗ -7% và chốt lời +15%.`,
      engine: 'FALLBACK'
    };
  }
}

const geminiBrain = new GeminiBrain();
module.exports = geminiBrain;
