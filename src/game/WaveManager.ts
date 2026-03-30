import { CONSTANTS } from './Constants';

export interface Wave {
  id: number;
  composition: { normal: number; big: number; slime: number; spitter: number };
}

// 競技場：Wave 1–10（固定）  無盡模式：Wave 1–9 後轉無限
export const WAVES: Wave[] = [
  { id:  1, composition: { normal: 1.00, big: 0.00, slime: 0.00, spitter: 0.00 } },
  { id:  2, composition: { normal: 0.80, big: 0.20, slime: 0.00, spitter: 0.00 } },
  { id:  3, composition: { normal: 0.70, big: 0.00, slime: 0.30, spitter: 0.00 } },
  { id:  4, composition: { normal: 0.60, big: 0.20, slime: 0.20, spitter: 0.00 } },
  { id:  5, composition: { normal: 0.50, big: 0.20, slime: 0.00, spitter: 0.30 } },
  { id:  6, composition: { normal: 0.40, big: 0.20, slime: 0.20, spitter: 0.20 } },
  { id:  7, composition: { normal: 0.30, big: 0.30, slime: 0.20, spitter: 0.20 } },
  { id:  8, composition: { normal: 0.20, big: 0.40, slime: 0.20, spitter: 0.20 } },
  { id:  9, composition: { normal: 0.20, big: 0.20, slime: 0.30, spitter: 0.30 } },
  { id: 10, composition: { normal: 0.00, big: 0.40, slime: 0.25, spitter: 0.35 } }, // FINAL
];

export class WaveManager {
  currentWave: number = 1;
  timer: number = 20;
  isResting: boolean = false;
  isInfinite: boolean = false;
  difficultyMultiplier: number = 1.0;
  activeMechanics: string[] = []; // 保留欄位供外部相容讀取，值恆為空
  infiniteTimer: number = 0;
  waveIntroTimer: number = 0;
  mode: 'endless' | 'arena' = 'endless';

  constructor(mode: 'endless' | 'arena' = 'endless') {
    this.mode = mode;
    this.timer = this.mode === 'arena' ? 20 : 30;
  }

  update(dt: number) {
    if (this.isResting && this.mode === 'arena') return;

    this.timer -= dt / 1000;
    if (this.waveIntroTimer > 0) {
      this.waveIntroTimer -= dt;
    }

    // 無盡模式：每 20 秒強化難度
    if (this.isInfinite && !this.isResting) {
      this.infiniteTimer += dt / 1000;
      if (this.infiniteTimer >= 20) {
        this.infiniteTimer = 0;
        this.difficultyMultiplier += 0.1;
      }
    }

    if (this.timer <= 0) {
      if (this.mode === 'arena') {
        this.timer = 0;
        this.isResting = true;
      } else {
        if (this.isResting) {
          this.startCombat();
        } else {
          this.startRest();
        }
      }
    }
  }

  startCombat() {
    this.isResting = false;
    this.timer = this.mode === 'arena' ? 30 + Math.floor(Math.random() * 21) : 30;
    this.waveIntroTimer = 3000;

    if (this.mode === 'arena') {
      // 競技場：波次自然增長
      this.currentWave++;
    } else {
      // 無盡模式：波次自然增長，不再強制切換 isInfinite 狀態
      this.currentWave++;
    }
  }

  startRest() {
    this.isResting = true;
    this.timer = 5;
  }

  getComposition() {
    // 移除硬編碼的 25% 比例，回歸 WAVES 配置陣列
    return WAVES[Math.min(this.currentWave - 1, WAVES.length - 1)].composition;
  }

  getHint(): string {
    if (this.isInfinite) return '無盡模式：每 20 秒殭屍強化。';
    return `Wave ${this.currentWave}`;
  }
}
