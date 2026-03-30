export class Vector2 {
  constructor(public x: number, public y: number) {}

  distanceTo(other: Vector2): number {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  add(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }
}

export type ObstacleType =
  | 'wall' | 'pillar' | 'tree' | 'rock' | 'building'
  | 'sandbag' | 'electric_fence' | 'explosive_barrel' | 'streetlight'
  | 'tombstone' | 'vending_machine' | 'container'
  | 'altar' | 'monolith';

export type ZombieType = 'normal' | 'big' | 'slime' | 'slime_small' | 'spitter' | 'butcher';

export type GameMode = 'endless' | 'arena';

// ── 場地殘留效果（龍捲風 / 岩漿標記）────────────────────────────────────────
export interface ActiveEffect {
  type: 'tornado' | 'lava_mark' | 'ground_fire' | 'spawn_warning';
  x: number;
  y: number;
  radius: number;
  lifetime: number;
  maxLifetime: number;

  // 傷害 tick
  damage: number;
  tickInterval: number;   // ms between damage ticks
  tickTimer: number;      // countdown to next tick

  ownerId: number;
  level: number;

  // lava_mark 專用：跟蹤目標殭屍，死亡後清空
  targetZombieId?: number;
  explodeRadius?: number;
  explodeDamage?: number;

  // spawn_warning 專用
  zombieType?: import('./Zombie').ZombieType;
}

// 子彈建立規格（WeaponDefinitions.fire() 的回傳型別）
export interface ProjectileSpec {
  ownerId: number;
  x: number; y: number;
  vx: number; vy: number;
  damage: number;
  pierce: number;
  lifetime: number;
  type: 'bullet' | 'slash';
  radius: number;
  knockback: boolean;
  level: number;
  bulletType?: string; // 子彈外觀模組鍵值（對應 BULLET_REGISTRY）
}
