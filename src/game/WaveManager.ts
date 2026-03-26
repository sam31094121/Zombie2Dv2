import { CONSTANTS } from './Constants';

export interface Wave {
  id: number;
  composition: { normal: number; big: number; slime: number; spitter: number };
  effect: string;
}

export const WAVES: Wave[] = [
  { id: 1, composition: { normal: 1.0, big: 0.0, slime: 0.0, spitter: 0.0 }, effect: "草地明亮。" },
  { id: 2, composition: { normal: 0.8, big: 0.2, slime: 0.0, spitter: 0.0 }, effect: "雲層陰影掠過。" },
  { id: 3, composition: { normal: 0.7, big: 0.0, slime: 0.3, spitter: 0.0 }, effect: "綠色雲層陰影掠過。" },
  { id: 4, composition: { normal: 0.6, big: 0.2, slime: 0.2, spitter: 0.0 }, effect: "雲層陰影掠過。" },
  { id: 5, composition: { normal: 0.5, big: 0.2, slime: 0.0, spitter: 0.3 }, effect: "雲層陰影掠過。" },
  { id: 6, composition: { normal: 0.4, big: 0.2, slime: 0.2, spitter: 0.2 }, effect: "深綠色調：雲層陰影掠過。" },
  { id: 7, composition: { normal: 0.3, big: 0.3, slime: 0.2, spitter: 0.2 }, effect: "紅色雲層陰影掠過：殭屍攻擊力提升 15%。" },
  { id: 8, composition: { normal: 0.2, big: 0.4, slime: 0.2, spitter: 0.2 }, effect: "雲層陰影掠過地面裂痕處會噴發黑色液體，造成緩速。" },
  { id: 9, composition: { normal: 0.2, big: 0.2, slime: 0.3, spitter: 0.3 }, effect: "優化閃電特效重新設計。" },
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
  mode: 'endless' | 'arena' = 'endless';

  constructor(mode: 'endless' | 'arena' = 'endless') {
    this.mode = mode;
    this.timer = this.mode === 'arena' ? 20 : 30;
  }

  update(dt: number) {
    if (this.isResting && this.mode === 'arena') return; // Arena mode rest state is fully managed manually (Shop Phase)

    this.timer -= dt / 1000;
    if (this.waveIntroTimer > 0) {
      this.waveIntroTimer -= dt;
    }
    
    if (this.isInfinite && !this.isResting) {
      this.infiniteTimer += dt / 1000;
      if (this.infiniteTimer >= 20) {
        this.infiniteTimer = 0;
        this.difficultyMultiplier += 0.1;
        this.randomizeMechanics();
      }
    }

    if (this.timer <= 0) {
      if (this.mode === 'arena') {
        this.timer = 0;
        this.isResting = true; // Wait for external signal to proceed
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
    this.timer = this.mode === 'arena' ? 30 + Math.floor(Math.random() * 21) : 30; // 30~50 seconds for arena
    this.waveIntroTimer = 3000; // 3 seconds intro
    if (!this.isInfinite) {
      if (this.currentWave < 9) {
        this.currentWave++;
      } else {
        this.isInfinite = true;
        this.infiniteTimer = 0;
        this.difficultyMultiplier = 1.0;
        this.randomizeMechanics();
      }
    }
  }

  startRest() {
    this.isResting = true;
    this.timer = 5;
  }

  randomizeMechanics() {
    const allMechanics = ['attack_boost', 'slow_liquid', 'lightning'];
    // Shuffle and pick 2
    this.activeMechanics = allMechanics.sort(() => 0.5 - Math.random()).slice(0, 2);
  }
  
  getComposition() {
    if (this.isInfinite) {
        return { normal: 0.25, big: 0.25, slime: 0.25, spitter: 0.25 };
    }
    return WAVES[this.currentWave - 1].composition;
  }

  getHint(): string {
    if (this.isInfinite) {
      return "純黑底色：僅玩家與殭屍發光，[機制]每過20秒殭屍強化並隨機切換機制。";
    }
    return WAVES[this.currentWave - 1].effect;
  }
}
