import { Zombie } from './Zombie';
import { Obstacle } from './map/Obstacle';
import { drawProjectile } from './renderers/ProjectileRenderer';

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  pierce: number;
  lifetime: number;
  type: 'bullet' | 'slash' | 'zombie_spit';
  radius: number;
  knockback: boolean;
  hitZombies: Set<Zombie> = new Set();
  ownerId: number;
  level: number;
  maxLifetime: number;
  isEnemy: boolean;
  bulletType: string; // 子彈外觀模組鍵值，預設 'blue_ellipse'

  constructor(
    ownerId: number,
    x: number, y: number, vx: number, vy: number,
    damage: number, pierce: number, lifetime: number,
    type: 'bullet' | 'slash' | 'zombie_spit', radius: number, knockback: boolean = false,
    level: number = 1, isEnemy: boolean = false,
    bulletType: string = 'blue_ellipse',
  ) {
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.pierce = pierce;
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
    this.type = type;
    this.radius = radius;
    this.knockback = knockback;
    this.level = level;
    this.isEnemy = isEnemy;
    this.bulletType = bulletType;
  }

  update(dt: number, obstacles: Obstacle[]) {
    this.x += this.vx * (dt / 16);
    this.y += this.vy * (dt / 16);
    this.lifetime -= dt;

    if (this.type === 'bullet' || this.type === 'zombie_spit') {
      for (const obs of obstacles) {
        if (obs.collidesWithCircle(this.x, this.y, this.radius)) {
          this.lifetime = 0; // Destroy bullet
          break;
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    drawProjectile(this, ctx);
  }
}
