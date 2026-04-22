// ── MissileProjectile.ts ──────────────────────────────────────────────────────
// 燃燒導彈實體（Gun Branch A 5A-8A 專用）
// 軟追蹤：每幀有限速率轉向；命中後在地面留下 ground_fire ActiveEffect
// 8A 大導彈：飛行 splitAfter ms 後分裂為 3 顆小導彈
// ─────────────────────────────────────────────────────────────────────────────

export interface MissileConfig {
  ownerId: number;
  x: number; y: number;
  angle: number;
  damage: number;
  /** px/frame at 60fps（與 Projectile 同單位，配合 dt/16 正規化） */
  speed: number;
  /** rad/ms 轉向速率上限 */
  turnSpeed: number;
  radius: number;
  isSmall: boolean;
  /** 分裂倒數 ms；0 = 不分裂 */
  splitAfter: number;
  groundFireRadius: number;
  groundFireDuration: number; // ms
  /** How many zombies this missile can pierce through (default 1 = no pierce) */
  pierceRemaining?: number;
  /** Visual variant for rendering */
  variant?: 'fire' | 'energy';
  homingDelayMs?: number;
  obstacleGraceMs?: number;
  splashRadius?: number;
}

export class MissileProjectile {
  private static _nextId = 0;

  readonly id: number;
  ownerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  turnSpeed: number;
  damage: number;
  radius: number;
  isSmall: boolean;
  splitAfter: number;
  splitTimer: number;
  groundFireRadius: number;
  groundFireDuration: number;
  lifetime: number = 3000;
  maxLifetime: number = 3000;
  alive: boolean = true;
  pierceRemaining: number = 1;
  variant: 'fire' | 'energy' = 'fire';
  homingDelayTimer: number = 0;
  obstacleGraceTimer: number = 0;
  splashRadius: number = 0;

  constructor(cfg: MissileConfig) {
    this.id         = ++MissileProjectile._nextId;
    this.ownerId    = cfg.ownerId;
    this.x          = cfg.x;
    this.y          = cfg.y;
    this.vx         = Math.cos(cfg.angle) * cfg.speed;
    this.vy         = Math.sin(cfg.angle) * cfg.speed;
    this.speed      = cfg.speed;
    this.turnSpeed  = cfg.turnSpeed;
    this.damage     = cfg.damage;
    this.radius     = cfg.radius;
    this.isSmall    = cfg.isSmall;
    this.splitAfter = cfg.splitAfter;
    this.splitTimer = cfg.splitAfter;
    this.groundFireRadius   = cfg.groundFireRadius;
    this.groundFireDuration = cfg.groundFireDuration;
    this.pierceRemaining    = cfg.pierceRemaining ?? 1;
    this.variant            = cfg.variant ?? 'fire';
    this.homingDelayTimer   = cfg.homingDelayMs ?? 0;
    this.obstacleGraceTimer = cfg.obstacleGraceMs ?? 0;
    this.splashRadius       = cfg.splashRadius ?? 0;
  }
}
