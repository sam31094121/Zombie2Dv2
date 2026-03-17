// ── ZombieDefinitions.ts ────────────────────────────────────────────────────
// 殭屍型別登錄表（Registry Pattern / Open-Closed Principle）
//
// 新增殭屍方式：
//   1. 在 types.ts 的 ZombieType 加入新型別名
//   2. 在 ZOMBIE_REGISTRY 加一個 entry（含可選的 splitOnDeath）
//   3. 在 ZombieRenderer.ts 加對應的 drawZombie case（只加，不改舊 case）
//   ✅ Zombie.ts / Game.ts 主邏輯零修改
// ────────────────────────────────────────────────────────────────────────────
import { ZombieType } from '../../types';
import { CONSTANTS } from '../../Constants';

// ── 分裂死亡規格（slime → 2 slime_small）────────────────────────────────────
export interface ZombieSpawnSpec {
  type: ZombieType;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// ── 殭屍定義介面 ─────────────────────────────────────────────────────────────
export interface IZombieDefinition {
  readonly radius: number;
  readonly baseHp: number;
  readonly baseSpeed: number;
  // XP 掉落
  readonly orbCount: number;
  readonly orbColor: string;
  readonly orbValue: number;
  // 死亡時額外生成（slime 分裂）— 傳入死亡位置，回傳要生成的殭屍規格
  readonly splitOnDeath?: (x: number, y: number) => ZombieSpawnSpec[];
}

// ── slime 分裂函式 ───────────────────────────────────────────────────────────
function slimeSplit(x: number, y: number): ZombieSpawnSpec[] {
  const angle1 = Math.random() * Math.PI * 2;
  const angle2 = angle1 + Math.PI;
  return [
    {
      type: 'slime_small',
      x: x + Math.cos(angle1) * 3,
      y: y + Math.sin(angle1) * 3,
      vx: Math.cos(angle1) * 16,
      vy: Math.sin(angle1) * 16,
    },
    {
      type: 'slime_small',
      x: x + Math.cos(angle2) * 3,
      y: y + Math.sin(angle2) * 3,
      vx: Math.cos(angle2) * 16,
      vy: Math.sin(angle2) * 16,
    },
  ];
}

// ── 殭屍登錄表 ────────────────────────────────────────────────────────────────
// 新增殭屍 = 在這裡加一行，不動其他任何程式碼
export const ZOMBIE_REGISTRY: Record<ZombieType, IZombieDefinition> = {
  normal: {
    radius: 12,
    baseHp: CONSTANTS.ZOMBIE_HP,
    baseSpeed: CONSTANTS.ZOMBIE_SPEED,
    orbCount: 1,
    orbColor: '#2196f3',
    orbValue: 1,
  },
  big: {
    radius: 30,
    baseHp: CONSTANTS.BIG_ZOMBIE_HP,
    baseSpeed: CONSTANTS.BIG_ZOMBIE_SPEED,
    orbCount: 4,
    orbColor: '#9c27b0',
    orbValue: 2,
  },
  slime: {
    radius: 16,
    baseHp: 10,
    baseSpeed: CONSTANTS.ZOMBIE_SPEED * 1.5,
    orbCount: 2,
    orbColor: '#4caf50',
    orbValue: 1,
    splitOnDeath: slimeSplit,
  },
  slime_small: {
    radius: 10,
    baseHp: 3,
    baseSpeed: 2.7,
    orbCount: 1,
    orbColor: '#4caf50',
    orbValue: 1,
  },
  spitter: {
    radius: 18,
    baseHp: 20,
    baseSpeed: CONSTANTS.ZOMBIE_SPEED * 0.6,
    orbCount: 2,
    orbColor: '#4caf50',
    orbValue: 1,
  },
};
