// public/audio.js - Synthesized Web Audio Cyber SFX
class CyberAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.isMuted = localStorage.getItem('cyber_sfx_muted') === 'true';
  }

  init() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('cyber_sfx_muted', this.isMuted.toString());
    return this.isMuted;
  }

  playTone(freq, type, duration, gainVal = 0.05) {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy
    }
  }

  playKeyClick() {
    this.playTone(800 + Math.random() * 400, 'triangle', 0.04, 0.02);
  }

  playScan() {
    this.playTone(1200, 'sine', 0.08, 0.04);
  }

  playBuy() {
    if (this.isMuted) return;
    try {
      this.init();
      const now = this.audioCtx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        setTimeout(() => this.playTone(f, 'sine', 0.15, 0.05), i * 60);
      });
    } catch (e) {}
  }

  playSell() {
    if (this.isMuted) return;
    try {
      this.init();
      [1046.5, 783.99, 659.25, 523.25].forEach((f, i) => {
        setTimeout(() => this.playTone(f, 'sine', 0.12, 0.05), i * 50);
      });
    } catch (e) {}
  }

  playAlert() {
    if (this.isMuted) return;
    try {
      this.init();
      this.playTone(300, 'sawtooth', 0.3, 0.08);
      setTimeout(() => this.playTone(250, 'sawtooth', 0.3, 0.08), 120);
    } catch (e) {}
  }
}

window.cyberAudio = new CyberAudioEngine();
