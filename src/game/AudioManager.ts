export class AudioManager {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Master volume
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // BGM state
  private bgmOscillators: OscillatorNode[] = [];
  private bgmInterval: number | null = null;
  private step = 0;

  constructor() {}

  public init() {
    if (this.isInitialized) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.3;
      this.bgmGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.masterGain);

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createOscillator(type: OscillatorType, freq: number, time: number, duration: number, vol: number = 1): { osc: OscillatorNode, gain: GainNode } | null {
    if (!this.ctx || !this.sfxGain) return null;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(vol, time);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(time);
    osc.stop(time + duration);
    
    return { osc, gain };
  }

  // --- SFX ---

  public playShoot(level: number) {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    
    // Random pitch variation for less ear fatigue
    const pitchJitter = 1 + (Math.random() * 0.1 - 0.05);

    if (level === 1 || level === 2) {
      // Basic pistol/dual guns: punchy square wave
      const baseFreq = level === 1 ? 150 : 180;
      const node = this.createOscillator('square', baseFreq * pitchJitter, time, 0.1, 0.3);
      if (node) {
        node.osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
        node.gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
      }
    } else if (level === 3) {
      // Plasma rifle: high pitch "pew"
      const node = this.createOscillator('sawtooth', 800 * pitchJitter, time, 0.15, 0.2);
      if (node) {
        node.osc.frequency.exponentialRampToValueAtTime(100, time + 0.15);
        node.gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
      }
    } else {
      // Shotgun (Lv4, Lv5): deep boom with noise
      const node = this.createOscillator('square', 100 * pitchJitter, time, 0.2, 0.4);
      if (node) {
        node.osc.frequency.exponentialRampToValueAtTime(20, time + 0.2);
        node.gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
      }
      // Add a high-pitch click for impact
      const click = this.createOscillator('triangle', 1200 * pitchJitter, time, 0.05, 0.3);
      if (click) {
        click.osc.frequency.exponentialRampToValueAtTime(100, time + 0.05);
        click.gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
      }
    }
  }

  public playSlash(level: number) {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    const pitchJitter = 1 + (Math.random() * 0.1 - 0.05);
    
    // Swoosh sound using a fast dropping triangle wave
    const baseFreq = 600 - (level * 50); // Heavier weapons sound lower
    // Make it shorter and quieter so it doesn't drown out other sounds
    const duration = 0.1 + (level * 0.015);
    const volume = 0.06; // Reduced from 0.2
    
    const node = this.createOscillator('triangle', baseFreq * pitchJitter, time, duration, volume);
    if (node) {
      node.osc.frequency.exponentialRampToValueAtTime(50, time + duration);
      node.gain.gain.linearRampToValueAtTime(0, time + duration);
    }
  }

  public playHit() {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    // Short, dull thwack
    const node = this.createOscillator('square', 100 + Math.random() * 50, time, 0.05, 0.2);
    if (node) {
      node.osc.frequency.exponentialRampToValueAtTime(20, time + 0.05);
      node.gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    }
  }

  public playKill() {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    // Satisfying pop/splat
    const node = this.createOscillator('sine', 300 + Math.random() * 100, time, 0.1, 0.3);
    if (node) {
      node.osc.frequency.exponentialRampToValueAtTime(800, time + 0.05);
      node.gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    }
  }

  public playPickup() {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    // Pleasant chime (arpeggio)
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, i) => {
      const node = this.createOscillator('sine', freq, time + i * 0.05, 0.2, 0.2);
      if (node) {
        node.gain.gain.setValueAtTime(0.2, time + i * 0.05);
        node.gain.gain.exponentialRampToValueAtTime(0.01, time + i * 0.05 + 0.2);
      }
    });
  }

  public playPlayerHit() {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    // Deep, harsh thud
    const node = this.createOscillator('sawtooth', 80, time, 0.3, 0.5);
    if (node) {
      node.osc.frequency.exponentialRampToValueAtTime(10, time + 0.3);
      node.gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
    }
  }

  // --- BGM ---

  public startBGM() {
    if (!this.ctx || !this.bgmGain) return;
    this.stopBGM();
    
    // A simple driving 16-step bassline sequencer
    const bassNotes = [65.41, 65.41, 77.78, 65.41, 65.41, 65.41, 98.00, 77.78]; // C2, Eb2, G2
    const tempo = 130; // BPM
    const stepTime = (60 / tempo) / 4; // 16th notes
    
    this.step = 0;
    
    this.bgmInterval = window.setInterval(() => {
      if (!this.ctx || !this.bgmGain) return;
      const time = this.ctx.currentTime;
      
      // Schedule next note slightly in the future for tight timing
      const freq = bassNotes[this.step % bassNotes.length];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time + 0.05);
      
      // Filter for that dark synthwave feel
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, time + 0.05);
      filter.frequency.exponentialRampToValueAtTime(100, time + 0.05 + stepTime * 0.8);
      
      gain.gain.setValueAtTime(0.2, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05 + stepTime * 0.8);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);
      
      osc.start(time + 0.05);
      osc.stop(time + 0.05 + stepTime);
      
      // Add a kick drum on the downbeats
      if (this.step % 4 === 0) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(150, time + 0.05);
        kickOsc.frequency.exponentialRampToValueAtTime(20, time + 0.05 + 0.1);
        kickGain.gain.setValueAtTime(0.4, time + 0.05);
        kickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05 + 0.1);
        kickOsc.connect(kickGain);
        kickGain.connect(this.bgmGain);
        kickOsc.start(time + 0.05);
        kickOsc.stop(time + 0.05 + 0.1);
      }
      
      this.step++;
    }, stepTime * 1000);
  }

  public stopBGM() {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const audioManager = new AudioManager();
