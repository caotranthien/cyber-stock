// public/matrix.js - Matrix Digital Rain Background Canvas
(function () {
  const canvas = document.getElementById('matrixCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  // Characters: Katakana + Cyber Hex + Binary
  const chars = '0123456789ABCDEF01010101日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ';
  const fontSize = 14;
  let columns = Math.floor(width / fontSize);
  let drops = [];

  function initDrops() {
    columns = Math.floor(width / fontSize);
    drops = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.floor(Math.random() * -height / fontSize);
    }
  }

  initDrops();

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initDrops();
  });

  let isRunning = true;

  function draw() {
    if (!isRunning) return;

    // Translucent black background for fading trail
    ctx.fillStyle = 'rgba(5, 8, 17, 0.08)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#00ff66';
    ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;

    for (let i = 0; i < drops.length; i++) {
      const text = chars[Math.floor(Math.random() * chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      // Random leading bright cyan glyph
      if (Math.random() > 0.95) {
        ctx.fillStyle = '#00f0ff';
      } else {
        ctx.fillStyle = '#00ff66';
      }

      ctx.fillText(text, x, y);

      if (y > height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);

  // Global toggle hook
  window.toggleMatrixRain = function (enable) {
    isRunning = enable;
    if (enable) requestAnimationFrame(draw);
  };
})();
