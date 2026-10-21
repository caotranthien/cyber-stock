// services/telegramBot.js - Real-time Telegram Alerts for Trades & Portfolio
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'config.json');

class TelegramBotService {
  constructor() {
    this.lastDailySummaryDate = null;
  }

  getConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        return {
          botToken: cfg.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '',
          chatId: cfg.telegramChatId || process.env.TELEGRAM_CHAT_ID || '',
          enabled: cfg.telegramAlertsEnabled !== false && !!(cfg.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN)
        };
      }
    } catch (e) {
      // ignore
    }
    return {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
      enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
    };
  }

  async sendMessage(messageText) {
    const { botToken, chatId, enabled } = this.getConfig();
    if (!enabled || !botToken || !chatId) {
      return { success: false, reason: 'Telegram chưa được cấu hình hoặc đã tắt' };
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });

      const data = await res.json();
      if (!data.ok) {
        logger.warn('TELEGRAM', `Lỗi gửi tin nhắn Telegram: ${data.description}`);
        return { success: false, error: data.description };
      }
      return { success: true };
    } catch (err) {
      logger.warn('TELEGRAM', `Không thể kết nối Telegram API: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // Send Trade Execution Alert
  async sendTradeAlert(trade) {
    const isBuy = trade.side === 'BUY';
    const icon = isBuy ? '🟢' : '🔴';
    const actionText = isBuy ? 'LỆNH MUA THÀNH CÔNG' : 'LỆNH BÁN THÀNH CÔNG';
    const priceFormatted = (trade.price || 0).toLocaleString('vi-VN');
    const totalFormatted = (trade.total || 0).toLocaleString('vi-VN');

    const msg = `
${icon} <b>[CYBER-QUANT AI: ${actionText}]</b>
━━━━━━━━━━━━━━━━━━━━
📌 <b>Mã CP:</b> <code>${trade.symbol}</code>
📊 <b>Khối lượng:</b> ${trade.quantity} CP
💵 <b>Giá khớp:</b> ${priceFormatted} đ
💰 <b>Tổng giá trị:</b> ${totalFormatted} đ
⏱ <b>Thời gian:</b> ${trade.timeFormatted || new Date().toLocaleTimeString('vi-VN')}
🧠 <b>Phân tích:</b> <i>${trade.aiReason || 'Quyết định định lượng từ Gemini 2.5 Flash'}</i>
━━━━━━━━━━━━━━━━━━━━
<i>Hệ thống tự động vận hành vốn 10.000.000 VNĐ</i>
`;
    await this.sendMessage(msg.trim());
  }

  // Send Stop Loss / Take Profit Risk Alert
  async sendRiskAlert(type, symbol, pnlPercent, price, reason) {
    const isProfit = type === 'TAKE_PROFIT';
    const icon = isProfit ? '🎯' : (type === 'TRAILING_STOP' ? '🛡️' : '🚨');
    const title = isProfit
      ? 'CHỐT LỜI MỤC TIÊU (+15%)'
      : (type === 'TRAILING_STOP' ? 'CHỐT LÃI BẢO VỆ THÀNH QUẢ (TRAILING STOP)' : 'CẮT LỖ KỶ LUẬT BẢO TOÀN VỐN (-7%)');

    const msg = `
${icon} <b>[CẢNH BÁO RỦI RO: ${title}]</b>
━━━━━━━━━━━━━━━━━━━━
📌 <b>Mã CP:</b> <code>${symbol}</code>
📈 <b>Lợi nhuận thực tế:</b> ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%
💵 <b>Giá thoát vị thế:</b> ${price.toLocaleString('vi-VN')} đ
⚠️ <b>Lý do:</b> ${reason}
━━━━━━━━━━━━━━━━━━━━
<i>Bảo vệ tài sản 10M VNĐ theo chuẩn quản trị rủi ro</i>
`;
    await this.sendMessage(msg.trim());
  }

  // Send Daily Market Close Summary (15h00)
  async sendDailySummary(portfolio) {
    const today = new Date().toLocaleDateString('en-CA');
    if (this.lastDailySummaryDate === today) return; // avoid duplicate

    const pnlSign = portfolio.dailyPnL >= 0 ? '+' : '';
    const icon = portfolio.dailyPnL >= 0 ? '🚀' : '🔻';

    const holdingsLines = Object.keys(portfolio.holdings || {}).map(sym => {
      const h = portfolio.holdings[sym];
      return `• <b>${sym}</b>: ${h.quantity} CP | PnL: ${h.pnlPercent >= 0 ? '+' : ''}${h.pnlPercent.toFixed(2)}%`;
    }).join('\n') || '• Danh mục rỗng (100% tiền mặt an toàn)';

    const msg = `
${icon} <b>[BÁO CÁO TỔNG KẾT PHIÊN GIAO DỊCH]</b>
📅 <b>Ngày:</b> ${today}
━━━━━━━━━━━━━━━━━━━━
💎 <b>Tổng tài sản (NAV):</b> ${(portfolio.totalNav || 0).toLocaleString('vi-VN')} đ
💵 <b>Tiền mặt khả dụng:</b> ${(portfolio.cash || 0).toLocaleString('vi-VN')} đ
📊 <b>Chênh lệch trong ngày:</b> ${pnlSign}${(portfolio.dailyPnL || 0).toLocaleString('vi-VN')} đ (${pnlSign}${(portfolio.dailyPnLPercent || 0).toFixed(2)}%)
🏆 <b>Lãi lũy kế đã chốt:</b> ${(portfolio.realizedPnL || 0).toLocaleString('vi-VN')} đ

📦 <b>Cổ phiếu đang nắm giữ:</b>
${holdingsLines}
━━━━━━━━━━━━━━━━━━━━
<i>Cyber-Quant AI Trading Desk (VN30 Core)</i>
`;
    const res = await this.sendMessage(msg.trim());
    if (res.success) {
      this.lastDailySummaryDate = today;
    }
  }

  // Test connection utility
  async testConnection(botToken, chatId) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '⚡ [CYBER-QUANT TEST]: Kết nối Telegram Bot thành công 100%! Từ bây giờ bạn sẽ nhận thông báo khớp lệnh và cảnh báo tài sản trực tiếp tại đây.',
          parse_mode: 'HTML'
        })
      });
      const data = await res.json();
      if (!data.ok) {
        return { success: false, error: data.description };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

const telegramBot = new TelegramBotService();
module.exports = telegramBot;
