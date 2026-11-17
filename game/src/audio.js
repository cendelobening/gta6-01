// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, police siren, gunshots, pickup chimes and a sunny bass groove.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.started = false;
  }

  /** Must be called from a user gesture at least once. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.started = true;
    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.ctx.suspend();
    if (!muted && this.ctx) this.ctx.resume();
  }

  setEngine(running, speedRatio) {
    if (!this.ctx || this.muted) return;
    if (!running) {
      if (this.engineOsc) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    }
    const freq = 55 + speedRatio * 110;
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.05, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx || this.muted) return;
    if (!on) {
      if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
      // Two-tone wail: alternate 660 / 880 Hz twice a second.
      window.setInterval(() => {
        if (!this.sirenOsc || !this.ctx) return;
        const now = this.ctx.currentTime;
        const high = Math.floor(now * 2) % 2 === 0;
        this.sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, now, 0.05);
      }, 120);
    }
    this.sirenGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.2);
  }

  blip(freq, duration, type = 'sine', volume = 0.12) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  gunshot() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const length = Math.floor(this.ctx.sampleRate * 0.12);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.25;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    this.blip(120, 0.08, 'square', 0.1);
  }

  crash() {
    this.blip(70, 0.25, 'sawtooth', 0.2);
  }

  chime() {
    this.blip(660, 0.12, 'sine', 0.12);
    window.setTimeout(() => this.blip(880, 0.18, 'sine', 0.12), 110);
  }

  /** A laid-back funk bass groove: A minor pentatonic, 100 BPM, 8 steps. */
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const bass = [55, 0, 65.41, 0, 82.41, 0, 65.41, 73.42];
    const lead = [220, 0, 261.63, 329.63, 0, 293.66, 0, 261.63];
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ctx) return;
      const step = this.musicStep % 8;
      if (bass[step]) this.blip(bass[step], 0.22, 'triangle', 0.09);
      if (this.musicStep % 16 >= 8 && lead[step]) this.blip(lead[step], 0.16, 'sine', 0.04);
      this.musicStep += 1;
    }, 300);
  }
}
