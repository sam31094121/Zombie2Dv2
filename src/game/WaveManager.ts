export interface Wave {
  id: number;
  composition: { normal: number; big: number; slime: number; spitter: number };
  arenaDuration?: number | 'objective';
  arenaObjective?: 'tombstones' | 'boss';
  spawnRateMultiplier?: number;
  weightCap?: number;
}

export const WAVES: Wave[] = [
  { id: 1, composition: { normal: 1.0, big: 0.0, slime: 0.0, spitter: 0.0 }, arenaDuration: 30, weightCap: 20 },
  { id: 2, composition: { normal: 0.8, big: 0.2, slime: 0.0, spitter: 0.0 }, arenaDuration: 30, weightCap: 30 },
  { id: 3, composition: { normal: 0.7, big: 0.0, slime: 0.3, spitter: 0.0 }, arenaDuration: 45, weightCap: 40 },
  { id: 4, composition: { normal: 0.6, big: 0.2, slime: 0.2, spitter: 0.0 }, arenaDuration: 45, weightCap: 50 },
  { id: 5, composition: { normal: 0.5, big: 0.2, slime: 0.0, spitter: 0.3 }, arenaDuration: 'objective', arenaObjective: 'tombstones', weightCap: 60 },
  { id: 6, composition: { normal: 0.4, big: 0.2, slime: 0.2, spitter: 0.2 }, arenaDuration: 40, spawnRateMultiplier: 0.5, weightCap: 80 },
  { id: 7, composition: { normal: 0.3, big: 0.3, slime: 0.2, spitter: 0.2 }, arenaDuration: 40, spawnRateMultiplier: 0.5, weightCap: 110 },
  { id: 8, composition: { normal: 0.2, big: 0.4, slime: 0.2, spitter: 0.2 }, arenaDuration: 40, spawnRateMultiplier: 0.5, weightCap: 140 },
  { id: 9, composition: { normal: 0.6, big: 0.0, slime: 0.0, spitter: 0.4 }, arenaDuration: 40, spawnRateMultiplier: 0.2, weightCap: 180 },
  { id: 10, composition: { normal: 0.0, big: 0.4, slime: 0.25, spitter: 0.35 }, arenaDuration: 'objective', arenaObjective: 'boss', weightCap: 200 },
];

export class WaveManager {
  currentWave: number = 1;
  timer: number = 20;
  isResting: boolean = false;
  isInfinite: boolean = false;
  difficultyMultiplier: number = 1.0;
  activeMechanics: string[] = [];
  infiniteTimer: number = 0;
  waveIntroTimer: number = 0;
  combatElapsedMs: number = 0;
  mode: 'endless' | 'arena' = 'endless';
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
      this.timer = 999;
    } else {
      this.timer = config.arenaDuration || 30;
    }
  }

  completeObjective() {
    if (this.isObjectiveBased() && !this.isTransitioning && !this.isResting) {
      this.startTransition();
    }
  }

  startTransition() {
    this.isTransitioning = true;
    this.transitionTimer = 0.6;
  }

  update(dt: number) {
    if (this.isResting && this.mode === 'arena') return;

    if (this.isTransitioning) {
      this.transitionTimer -= dt / 1000;
      if (this.transitionTimer <= 0) {
        this.isTransitioning = false;
        this.timer = 0;
        this.isResting = true;
        this.combatElapsedMs = 0;
      }
      return;
    }

    if (this.waveIntroTimer > 0) {
      this.waveIntroTimer -= dt;
    }

    if (!this.isResting) {
      this.combatElapsedMs += dt;
    }

    if (this.isInfinite && !this.isResting) {
      this.infiniteTimer += dt / 1000;
      if (this.infiniteTimer >= 20) {
        this.infiniteTimer = 0;
        this.difficultyMultiplier += 0.1;
      }
    }

    if (!this.isObjectiveBased()) {
      this.timer -= dt / 1000;
      if (this.timer <= 0) {
        if (this.mode === 'arena') {
          this.startTransition();
        } else if (this.isResting) {
          this.startCombat();
        } else {
          this.startRest();
        }
      }
    }
  }

  startCombat() {
    this.isResting = false;
    this.isTransitioning = false;
    this.waveIntroTimer = 3000;
    this.combatElapsedMs = 0;

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
    this.combatElapsedMs = 0;
  }

  getComposition() {
    return this.currentWaveConfig.composition;
  }

  getObjectiveText(): string | null {
    if (!this.isObjectiveBased()) return null;

    if (this.currentWaveConfig.arenaObjective === 'tombstones') {
      return '任務：摧毀十字墓碑';
    }
    if (this.currentWaveConfig.arenaObjective === 'boss') {
      return '任務：擊敗屠夫';
    }
    return '任務波';
  }

  getHint(): string {
    if (this.isTransitioning) return 'WAVE CLEARED!';
    const objectiveText = this.getObjectiveText();
    if (objectiveText) return objectiveText;
    if (this.isInfinite) return '無盡模式：每 20 秒殭屍強化。';
    return `Wave ${this.currentWave}`;
  }
}
