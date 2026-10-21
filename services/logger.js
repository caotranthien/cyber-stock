// services/logger.js - Cyberpunk Real-time Logger
class CyberLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 300;
    this.subscribers = new Set();
  }

  log(category, message, level = 'INFO', data = null) {
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      category: category.toUpperCase(), // 'SYS', 'MARKET', 'AI_BRAIN', 'TRADE', 'RISK', 'NEWS'
      message,
      level: level.toUpperCase(), // 'INFO', 'WARN', 'SUCCESS', 'ALERT', 'ERROR'
      data
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Terminal console format
    const prefix = `[${entry.timeFormatted}] [${entry.category}] [${entry.level}]`;
    console.log(`${prefix} ${message}`);

    // Broadcast to SSE clients
    this.broadcast({ type: 'log', entry });

    return entry;
  }

  info(category, message, data = null) {
    return this.log(category, message, 'INFO', data);
  }

  success(category, message, data = null) {
    return this.log(category, message, 'SUCCESS', data);
  }

  warn(category, message, data = null) {
    return this.log(category, message, 'WARN', data);
  }

  alert(category, message, data = null) {
    return this.log(category, message, 'ALERT', data);
  }

  error(category, message, data = null) {
    return this.log(category, message, 'ERROR', data);
  }

  getRecentLogs(limit = 100) {
    return this.logs.slice(0, limit);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  broadcast(payload) {
    for (const callback of this.subscribers) {
      try {
        callback(payload);
      } catch (err) {
        console.error('Broadcast error:', err.message);
      }
    }
  }
}

const logger = new CyberLogger();
module.exports = logger;
