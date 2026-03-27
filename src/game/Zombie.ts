import { Player } from './Player';
import { Obstacle } from './map/Obstacle';
import { Projectile } from './Projectile';
import { ZombieType } from './types';
import { ZOMBIE_REGISTRY, ZombieBehaviorCtx } from './entities/definitions/ZombieDefinitions';
import { drawZombie } from './renderers/ZombieRenderer';

// Re-export for backward compatibility
export type { ZombieType };

export class Zombie {
  id: number = 0;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  type: ZombieType;
  lastDamageTime: Map<number, number> = new Map();

  // 擊退速度
  vx: number = 0;
  vy: number = 0;

  // 狀態效果
  paralysisTimer: number = 0;
  slowTimer: number = 0;
  flashWhiteTimer: number = 0;
  isInfiniteGlow: boolean = false;
  leanBackTimer: number = 0;
  isInsideContainer: boolean = false;

  // 動畫屬性
  time: number = 0;
  isCloseToPlayer: boolean = false;
  angle: number = 0;

  // slime / spitter 動畫
  jellyPhase: number = 0;
  lastSpitTime: number = 0;
  lastTrailTime: number = 0;

  // 行為 Hook 的任意狀態（如 Butcher 狀態機）
  extraState: Map<string, unknown> = new Map();

  constructor(x: number, y: number, type: ZombieType = 'normal') {
    this.x = x;
    this.y = y;
    this.type = type;
    const def = ZOMBIE_REGISTRY[type];
    this.radius = def.radius;
    this.hp     = def.baseHp;
    this.maxHp  = def.baseHp;
    this.speed  = def.baseSpeed;
  }

  update(
    dt: number,
    players: Player[],
    obstacles: Obstacle[],
    projectiles: Projectile[],
    slimeTrails: { x: number; y: number; radius: number; lifetime: number; maxLifetime: number }[],
  ) {
    if (this.hp <= 0) return;

    this.time += dt;

    if (this.paralysisTimer > 0) {
      this.paralysisTimer -= dt;
      return;
    }
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      dt *= 0.5;
    }
    if (this.flashWhiteTimer > 0) this.flashWhiteTimer -= dt;
    if (this.leanBackTimer   > 0) this.leanBackTimer   -= dt;

    // 找最近的存活玩家
    let nearest: Player | null = null;
    let minDist = Infinity;
    for (const p of players) {
      if (p.hp <= 0) continue;
      const dist = Math.hypot(p.x - this.x, p.y - this.y);
      if (dist < minDist) { minDist = dist; nearest = p; }
    }

    const def = ZOMBIE_REGISTRY[this.type];
    const ctx: ZombieBehaviorCtx = {
      dt, nearest, nearestDist: minDist,
      players, obstacles, projectiles, slimeTrails,
    };

    if (def.updateBehavior) {
      // 行為 Hook：完全由定義控制移動與攻擊
      def.updateBehavior(this, ctx);
    } else {
      // 預設：向最近玩家移動
      if (nearest && minDist > 0) {
        const dx = nearest.x - this.x;
        const dy = nearest.y - this.y;
        this.angle = Math.atan2(dy, dx);
        this.x += (dx / minDist) * this.speed * (dt / 16);
        this.y += (dy / minDist) * this.speed * (dt / 16);
      }
      this.isCloseToPlayer = minDist < this.radius + 50;
    }

    // 留痕跡（slime 類）
    if (def.leavesTrail) {
      this.jellyPhase += dt * 0.01;
      if (nearest && this.time - this.lastTrailTime > 200) {
        this.lastTrailTime = this.time;
        slimeTrails.push({ x: this.x, y: this.y, radius: this.radius + 5, lifetime: 5000, maxLifetime: 5000 });
      }
    }

    // 擊退物理（免疫擊退的殭屍跳過）
    if ((def.knockbackResistLevel ?? 0) < 10) {
      this.x += this.vx * (dt / 16);
      this.y += this.vy * (dt / 16);
      const friction = Math.pow(0.92, dt / 16);
      this.vx *= friction;
      this.vy *= friction;
      if (Math.abs(this.vx) < 0.01) this.vx = 0;
      if (Math.abs(this.vy) < 0.01) this.vy = 0;
    }

    // 障礙物碰撞
    for (const obs of obstacles) {
      if (obs.isDestroyed) continue;
      if (obs.collidesWithCircle(this.x, this.y, this.radius)) {
        def.onObstacleCollide?.(this, obs);
        const resolved = obs.resolveCircleCollision(this.x, this.y, this.radius);
        if (resolved) { this.x = resolved.x; this.y = resolved.y; }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    drawZombie(this, ctx);
  }
}
