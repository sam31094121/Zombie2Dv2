import { Zombie } from '../Zombie';

export class ArcProjectile {
  ownerId: number;
  level: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  lifetime: number;
  maxLifetime: number;
  
  maxJumps: number;
  paralyzeDuration: number;

  isEmbedded: boolean = false;
  embeddedTarget: Zombie | null = null;
  embedTimer: number = 0;
  maxEmbedTime: number = 200; // 嵌入後 0.2 秒爆發連鎖
  hasTriggeredArc: boolean = false;

  constructor(
    ownerId: number,
    level: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    maxJumps: number,
    paralyzeDuration: number
  ) {
    this.ownerId = ownerId;
    this.level = level;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.radius = 8;
    this.lifetime = 1500;
    this.maxLifetime = 1500;
    this.maxJumps = maxJumps;
    this.paralyzeDuration = paralyzeDuration;
  }
}
