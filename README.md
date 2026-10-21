# 🟢 CYBER_QUANT_VN — GEMINI AI ROBOT ĐẦU TƯ CHỨNG KHOÁN 24/7

> **Hệ thống web dashboard phong cách Hacker Cyberpunk Terminal tích hợp Bot giao dịch chứng khoán Việt Nam (VN30 / HOSE) tự động hóa hoàn toàn bằng Google Gemini AI với số vốn ban đầu 10.000.000 VNĐ.**

![Cyberpunk Terminal](https://img.shields.io/badge/Theme-Cyberpunk_Matrix-00ff66?style=for-the-badge)
![Gemini AI](https://img.shields.io/badge/AI-Google_Gemini_2.5_Flash-00f0ff?style=for-the-badge)
![Capital](https://img.shields.io/badge/Capital-10%2C000%2C000_VND-ffb700?style=for-the-badge)
![Hosting](https://img.shields.io/badge/Hosting-100%25_Free_24%2F7-ff0055?style=for-the-badge)

---

## ⚡ 1. TÍNH NĂNG NỔI BẬT

### 🧠 Bộ Não Trí Tuệ Nhân Tạo (Gemini AI Brain)
- **Đa kênh phân tích:** Tự động tổng hợp và đối soát cùng lúc 3 nguồn dữ liệu:
  1. **Bảng giá realtime & lịch sử nến:** Kết nối dữ liệu từ VPS Datafeed & Entrade OHLC cho các mã trụ cột HOSE/VN30 (`FPT`, `HPG`, `VNM`, `SSI`, `MWG`, `TCB`, `MBB`, `VIC`, `VHM`, `STB`, `DGC`, `VND`).
  2. **Chỉ báo kỹ thuật chuyên sâu:** RSI(14) (quá mua/quá bán), đường trung bình động SMA20 & SMA50 (Golden Cross / Death Cross), MACD line & Signal.
  3. **Tin tức thời sự CafeF:** Tự động cào tin tức nóng nhất từ CafeF RSS (`https://cafef.vn/thi-truong-chung-khoan.rss`), bóc tách mã chứng khoán liên quan và đánh giá cảm xúc thị trường.
- **Quyết định có lý do rõ ràng (Explainable AI):** Mỗi lệnh mua/bán đều kèm lý do phân tích cụ thể (ví dụ: *FPT lợi nhuận Q3 tăng 55%, RSI 56 ở nhịp tích lũy, MA20 vượt MA50...*).
- **Quant Fallback Engine:** Nếu chưa cấu hình Gemini API Key hoặc khi mất mạng, hệ thống tự động kích hoạt bộ thuật toán định lượng (Quant Algorithmic Rules) để bot vẫn vận hành mượt mà 100%!

### 💰 Quản Trị Vốn 10.000.000 VNĐ & Kỷ Luật Thép
- **Số vốn khởi điểm:** `10.000.000 VNĐ` (Mô phỏng Paper Trading chuẩn quy tắc sàn Việt Nam).
- **Phí giao dịch & thuế thực tế:** Tự động trừ phí môi giới `0.15%` khi mua/bán và thuế `0.1%` khi bán cổ phiếu.
- **Quy tắc phân bổ vốn:** Tối đa 35% tổng tài sản cho một mã cổ phiếu (tránh all-in, giảm thiểu rủi ro).
- **Quy tắc cắt lỗ kỷ luật (-7%):** Nếu giá sụt giảm chạm ngưỡng -7% so với giá vốn, hệ thống kích hoạt **Cắt lỗ khẩn cấp (Emergency Stop-Loss)** để bảo toàn vốn gốc.
- **Quy tắc chốt lời (+15%):** Tự động chốt lời từng phần khi đạt mục tiêu lợi nhuận.
- **Theo dõi chênh lệch hàng ngày (Daily PnL Tracker):** Ghi nhận biến động tài sản ròng (NAV) so với mốc bắt đầu ngày và lưu biểu đồ lịch sử theo từng phiên.

### 🖥️ Giao Diện Hacker Cyberpunk Terminal Chuẩn Realtime
- **Hiệu ứng Matrix Digital Rain Canvas:** Mưa ký tự xanh neon rơi mượt mà ở hình nền (có thể bật/tắt).
- **Màn hình CRT Scanlines Retro:** Giả lập màn hình CRT cổ điển với độ quét scanline chân thực.
- **Âm thanh Cyber Web Audio Synthesized:** Tự tổng hợp âm thanh tiếng click phím máy tính, tiếng radar quét thị trường, tiếng chuông khớp lệnh mua/bán bằng Web Audio API thuần (không cần file âm thanh ngoài).
- **Terminal Matrix Console:** Luồng log streaming thời gian thực qua Server-Sent Events (SSE). Hỗ trợ dòng lệnh CLI tương tác trực tiếp (`help`, `buy FPT 50`, `sell HPG 50`, `scan`, `status`, `reset`).
- **Biểu đồ nến kỹ thuật Canvas:** Vẽ nến, đường trung bình MA20/MA50 và các mốc giá theo thời gian thực.

---

## 🚀 2. HƯỚNG DẪN CÀI ĐẶT & CHẠY LOCALHOST

### Yêu cầu:
- Đã cài đặt **Node.js** (phiên bản v18 trở lên).

### Các bước chạy:
1. Mở terminal tại thư mục dự án:
   ```bash
   cd d:\SourceCode\gemini-cybertrade-vn
   ```
2. Cài đặt các thư viện (nếu chưa cài):
   ```bash
   npm install
   ```
3. Khởi động server:
   ```bash
   npm start
   ```
4. Truy cập trình duyệt tại địa chỉ:
   ```text
   http://localhost:3000
   ```

*Mẹo: Bạn có thể click vào nút **⚙ CẤU HÌNH** trên giao diện web để dán Google Gemini API Key của mình vào (Lấy key miễn phí tại: [Google AI Studio](https://aistudio.google.com/app/apikey)).*

---

## 🌐 3. HƯỚNG DẪN DEPLOY FREE 24/7 (BOT TỰ CHẠY NỀN KHÔNG CẦN MỞ TRANG WEB)

Bạn muốn bot tự chạy liên tục 24/7 trên đám mây, tự quét tín hiệu và đặt lệnh mà **không cần mở trình duyệt, không cần bật máy tính cá nhân**, và **hoàn toàn MIỄN PHÍ**? Dưới đây là các giải pháp tốt nhất:

### ⭐ Cách 1: Render.com (Khuyên dùng - 100% Free)
Render cho phép chạy Web Service Node.js miễn phí. Để dịch vụ không bao giờ bị "ngủ" (Sleep after 15 mins), ta kết hợp với một công cụ Ping Uptime miễn phí:

1. Đẩy mã nguồn lên tài khoản **GitHub** của bạn:
   ```bash
   git init
   git add .
   git commit -m "feat: Cyber trade bot 10M Gemini"
   git remote add origin https://github.com/<tai-khoan-cua-ban>/gemini-cybertrade-vn.git
   git push -u origin main
   ```
2. Đăng nhập [Render.com](https://render.com) (chọn Sign in with GitHub).
3. Nhấn **New +** -> **Web Service** -> Chọn repository vừa tải lên.
4. Render sẽ tự nhận diện file `render.yaml` hoặc điền cấu hình:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** `Free`
   - **Environment Variables:**
     - `GEMINI_API_KEY`: Điền khóa API Gemini của bạn.
5. Nhấn **Create Web Service**. Chờ 1-2 phút bạn sẽ nhận được đường link công khai, ví dụ: `https://gemini-cybertrade-vn.onrender.com`.
6. **BƯỚC QUAN TRỌNG ĐỂ BOT CHẠY 24/7 KHÔNG NGỦ:**
   - Truy cập trang miễn phí [cron-job.org](https://cron-job.org) hoặc [UptimeRobot.com](https://uptimerobot.com).
   - Tạo 1 tác vụ giám sát mới (Monitor / Cron job):
     - URL: `https://gemini-cybertrade-vn.onrender.com/health`
     - Tần suất (Schedule): Cứ mỗi **10 phút** một lần.
   - Nhờ việc ping liên tục vào endpoint `/health`, Render sẽ giữ bot của bạn hoạt động 24/7 mà không bao giờ bị dừng!

---

### ⭐ Cách 2: GitHub Actions Scheduled Cron (Chạy hoàn toàn trên hạ tầng GitHub)
Dự án đã tích hợp sẵn workflow tại [`.github/workflows/trading_bot.yml`](.github/workflows/trading_bot.yml):
- Workflow này được lên lịch chạy tự động mỗi 15 phút từ Thứ 2 đến Thứ 6 trong các khung giờ giao dịch chứng khoán Việt Nam (09:00 - 15:00).
- Nó sẽ kích hoạt bot quét thị trường từ xa hoàn toàn tự động mà bạn không cần phải đụng tay vào bất cứ điều gì!

---

### ⭐ Cách 3: Koyeb / Railway / Docker
Dự án cung cấp sẵn file `Dockerfile` và `docker-compose.yml`. Bạn có thể deploy lên Koyeb (Gói Nano miễn phí chạy liên tục không sleep) hoặc VPS cá nhân chỉ với 1 lệnh:
```bash
docker compose up -d
```

---

## 🕹️ 4. BẢNG TRA CỨU LỆNH HACKER TERMINAL (CLI)

Trên giao diện web, tại ô nhập lệnh `quant-bot:~$`, bạn có thể gõ các câu lệnh sau:

| Lệnh | Ý nghĩa |
| :--- | :--- |
| `help` | Hiển thị danh sách tất cả các lệnh hỗ trợ |
| `scan` | Kích hoạt chu kỳ quét dữ liệu và phân tích AI ngay lập tức |
| `buy <MÃ> <SL>` | Đặt lệnh mua thủ công theo giá thị trường (ví dụ: `buy FPT 50`) |
| `sell <MÃ> <SL>` | Đặt lệnh bán thủ công theo giá thị trường (ví dụ: `sell HPG 50`) |
| `status` | Xem nhanh tổng tài sản, tiền mặt khả dụng và trạng thái bot |
| `matrix` | Bật / tắt hiệu ứng mưa ký tự Matrix ở hình nền |
| `sfx` | Bật / tắt hiệu ứng âm thanh máy tính Hacker |
| `reset` | Khởi tạo lại toàn bộ danh mục về mốc ban đầu 10.000.000 VNĐ |
| `clear` | Xóa sạch màn hình dòng lệnh Terminal |

---

## 🔒 5. LƯU Ý VỀ TÍNH PHÁP LÝ & AN TOÀN
- Hệ thống này sử dụng cơ chế **Giao dịch mô phỏng (Paper Trading)** với bảng giá thật từ thị trường chứng khoán Việt Nam để phục vụ mục đích nghiên cứu, học tập thuật toán và đánh giá hiệu quả đầu tư của các mô hình AI.
- Nếu muốn tích hợp kết nối tài khoản chứng khoán thật (đặt lệnh tiền thật qua API công ty chứng khoán như SSI iBoard API hoặc DNSE Entrade X API), người dùng có thể mở rộng thêm mô-đun API riêng có xác thực chữ ký số OTP/Token của CTCK tương ứng.
