// scripts/test_gemini_connection.js
require('dotenv').config();
const geminiBrain = require('../services/geminiBrain');
const marketData = require('../services/marketData');
const newsScraper = require('../services/newsScraper');
const tradingEngine = require('../services/tradingEngine');

async function testConnection() {
  console.log('--- TEST KẾT NỐI GEMINI API ---');
  const apiKey = geminiBrain.getApiKey();
  console.log(`API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`Model: ${geminiBrain.config.model}`);

  console.log('\n[1/3] Đang lấy dữ liệu thị trường VPS và tin tức CafeF thực tế...');
  const quotes = await marketData.getMarketSnapshot();
  const news = await newsScraper.fetchNews();
  const portfolio = tradingEngine.getSummary();

  console.log(`- Đã lấy ${quotes.length} mã VN30.`);
  console.log(`- Đã lấy ${news.length} tin tức tài chính.`);
  console.log(`- Tiền mặt danh mục: ${portfolio.cash.toLocaleString()} VND, NAV: ${portfolio.totalNav.toLocaleString()} VND.`);

  console.log('\n[2/3] Gửi yêu cầu phân tích nơ-ron đến Google Gemini API (gemini-2.5-flash)...');
  const startTime = Date.now();
  const result = await geminiBrain.analyze(quotes, news, portfolio);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n[3/3] Kết quả phân tích sau ${elapsed}s:`);
  console.log(`- Engine: ${result.engine}`);
  console.log(`- Model: ${result.model}`);
  console.log(`- Xu hướng thị trường: ${result.marketSentiment}`);
  console.log(`- Tóm tắt: ${result.summaryAnalysis}`);
  console.log(`- Số khuyến nghị: ${result.recommendations?.length || 0}`);
  
  if (result.recommendations && result.recommendations.length > 0) {
    console.log('\nChi tiết các khuyến nghị từ Gemini:');
    result.recommendations.forEach((rec, idx) => {
      console.log(`  [${idx + 1}] ${rec.symbol} -> ${rec.action} (Tin cậy: ${rec.confidence}%, Khối lượng: ${rec.shares} CP)`);
      console.log(`      Mục tiêu: ${rec.targetPrice?.toLocaleString()} VND | Cắt lỗ: ${rec.stopLossPrice?.toLocaleString()} VND`);
      console.log(`      Lý do: ${rec.reason}`);
    });
  }

  if (result.engine === 'GEMINI_AI') {
    console.log('\n>>> THÀNH CÔNG: Gemini API kết nối và phân tích hoàn hảo 100%! <<<');
  } else {
    console.log('\n>>> CHÚ Ý: Chạy ở chế độ fallback:', result.engine);
  }
}

testConnection().catch(err => {
  console.error('LỖI TEST:', err);
  process.exit(1);
});
