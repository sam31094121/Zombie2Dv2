import { CONSTANTS } from './Constants';

export interface Wave {
  id: number;
  composition: { normal: number; big: number; slime: number; spitter: number };
  arenaDuration?: number | 'objective';
  arenaObjective?: 'tombstones' | 'boss';
  spawnRateMultiplier?: number;
}

// 競技場：Wave 1–10（根據設計） 無盡模式：Wave 1–9 後轉無限
export const WAVES: Wave[] = [
  { id:  1, composition: { normal: 1.00, big: 0.00, slime: 0.00, spitter: 0.00 }, arenaDuration: 30 },
  { id:  2, composition: { normal: 0.80, big: 0.20, slime: 0.00, spitter: 0.00 }, arenaDuration: 30 },
  { id:  3, composition: { normal: 0.70, big: 0.00, slime: 0.30, spitter: 0.00 }, arenaDuration: 45 },
  { id:  4, composition: { normal: 0.60, big: 0.20, slime: 0.20, spitter: 0.00 }, arenaDuration: 45 },
  { id:  5, composition: { normal: 0.50, big: 0.20, slime: 0.00, spitter: 0.30 }, arenaDuration: 'objective', arenaObjective: 'tombstones' },
  { id:  6, composition: { normal: 0.40, big: 0.20, slime: 0.20, spitter: 0.20 }, arenaDuration: 40, spawnRateMultiplier: 0.5 },
  { id:  7, composition: { normal: 0.30, big: 0.30, slime: 0.20, spitter: 0.20 }, arenaDuration: 40, spawnRateMultiplier: 0.5 },
  { id:  8, composition: { normal: 0.20, big: 0.40, slime: 0.20, spitter: 0.20 }, arenaDuration: 40, spawnRateMultiplier: 0.5 },
  { id:  9, composition: { normal: 0.60, big: 0.00, slime: 0.00, spitter: 0.40 }, arenaDuration: 40, spawnRateMultiplier: 0.7 }, // W9 大量普通與吐酸
  { id: 10, composition: { normal: 0.00, big: 0.40, slime: 0.25, spitter: 0.35 }, arenaDuration: 'objective', arenaObjective: 'boss' }, // FINAL
];

export class WaveManager {
  currentWave: number = 1;
  timer: number = 20;
  isResting: boolean = false;
  isInfinite: boolean = false;
  difficultyMultiplier: number = 1.0;
  activeMechanics: string[] = []; // 保留欄位供外部相容讀取
  infiniteTimer: number = 0;
  waveIntroTimer: number = 0;
  mode: 'endless' | 'arena' = 'endless';

  // 平滑轉場狀態
  isTransitioning: boolean = false;
  transitionTimer: number = 0;

  constructor(mode: 'endless' | 'arena' = 'endless') {
    this.mode = mode;
    if (this.mode === 'arena') {
      this.applyWaveConfig();
    } else {
      this.timer = 30;
    }
  }

  get currentWaveConfig(): Wave {
    return WAVES[Math.min(this.currentWave - 1, WAVES.length - 1)];
  }

  isObjectiveBased(): boolean {
    return this.mode === 'arena' && this.currentWaveConfig.arenaDuration === 'objective';
  }

  applyWaveConfig() {
    const config = this.currentWaveConfig;
    if (config.arenaDuration === 'objective') {
      this.timer = 999; // 顯示上的假時間或隱藏，不會倒數
    } else {
      this.timer = config.arenaDuration || 30;
    }
  }

  // 由外部 Game.ts 在達成條件時呼叫
  completeObjective() {
    if (this.isObjectiveBased() && !this.isTransitioning && !this.isResting) {
      this.startTransition();
    }
  }

  startTransition() {
    this.isTransitioning = true;
    this.transitionTimer = 0.6; // 配合 dt *= 0.3 達到真實時間 2 秒的慢動作
  }

  update(dt: number) {
    if (this.isResting && this.mode === 'arena') return;

    if (this.isTransitioning) {
      this.transitionTimer -= dt / 1000;
      if (this.transitionTimer <= 0) {
        this.isTransitioning = false;
        this.timer = 0; // Trigger shop
        this.isResting = true;
      }
      return;
    }

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

    // 若非任務目標倒數計時
    if (!this.isObjectiveBased()) {
      this.timer -= dt / 1000;
      if (this.timer <= 0) {
        if (this.mode === 'arena') {
          this.startTransition(); // 不再立刻 isResting，而是進入轉場
        } else {
          if (this.isResting) {
            this.startCombat();
          } else {
            this.startRest();
          }
        }
      }
    }
  }

  startCombat() {
    this.isResting = false;
    this.isTransitioning = false;
    this.waveIntroTimer = 3000;

    if (this.mode === 'arena') {
      this.currentWave++;
      this.applyWaveConfig();
    } else {
      this.timer = 30;
      this.currentWave++;
    }
  }

  startRest() {
    this.isResting = true;
    this.isTransitioning = false;
    this.timer = 5;
  }

  getComposition() {
    return this.currentWaveConfig.composition;
  }

  getHint(): string {
    if (this.isTransitioning) return 'WAVE CLEARED!';
    if (this.isObjectiveBased()) {
      const obj = this.currentWaveConfig.arenaObjective;
      if (obj === 'tombstones') return '摧毀墓碑以進入下一波！';
      if (obj === 'boss') return '警告：紅色屠夫！';
    }
    if (this.isInfinite) return '無盡模式：每 20 秒殭屍強化。';
    return `Wave ${this.currentWave}`;
  }
}
