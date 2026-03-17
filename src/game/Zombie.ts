import { CONSTANTS } from './Constants';
import { Player } from './Player';
import { Obstacle } from './map/Obstacle';
import { Projectile } from './Projectile';
import { ZombieType } from './types';
import { ZOMBIE_REGISTRY } from './entities/definitions/ZombieDefinitions';
import { drawZombie } from './renderers/ZombieRenderer';

// Re-export for backward compatibility（其他檔案仍可 import { ZombieType } from './Zombie'）
export type { ZombieType };

export class Zombie {
  id: number = 0;  // Feature 3/6: Stable ID for delta tracking & ID-based matching
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  type: ZombieType;
  lastDamageTime: Map<number, number> = new Map(); // player id -> time
  
  // Knockback velocity
  vx: number = 0;
  vy: number = 0;
  
  // Status effects
  paralysisTimer: number = 0;
  slowTimer: number = 0;
  flashWhiteTimer: number = 0;
  isInfiniteGlow: boolean = false;
  leanBackTimer: number = 0;
  isInsideContainer: boolean = false;
  
  // Animation properties
  time: number = 0;
  isCloseToPlayer: boolean = false;
  angle: number = 0;
  
  // New properties for Slime and Spitter
  jellyPhase: number = 0;
  lastSpitTime: number = 0;
  lastTrailTime: number = 0;

  constructor(x: number, y: number, type: ZombieType = 'normal') {
    this.x = x;
    this.y = y;
    this.type = type;
    // 從登錄表讀取基礎屬性 — 新增殭屍只需加 ZOMBIE_REGISTRY entry，不動此處
    const def = ZOMBIE_REGISTRY[type];
    this.radius = def.radius;
    this.hp     = def.baseHp;
    this.maxHp  = def.baseHp;
    this.speed  = def.baseSpeed;
  }

  update(dt: number, players: Player[], obstacles: Obstacle[], projectiles: Projectile[], slimeTrails: {x: number, y: number, radius: number, lifetime: number, maxLifetime: number}[]) {
    this.time += dt;
    
    if (this.paralysisTimer > 0) {
      this.paralysisTimer -= dt;
      return; // Skip movement
    }
    
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      dt *= 0.5; // Half speed
    }
    
    if (this.flashWhiteTimer > 0) {
      this.flashWhiteTimer -= dt;
    }
    
    if (this.leanBackTimer > 0) {
      this.leanBackTimer -= dt;
    }
    
    // Find nearest alive player
    let nearest: Player | null = null;
    let minDist = Infinity;
    for (const p of players) {
      if (p.hp <= 0) continue;
      const dist = Math.hypot(p.x - this.x, p.y - this.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }

    if (nearest) {
      const dx = nearest.x - this.x;
      const dy = nearest.y - this.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      let shouldMove = true;
      
      if (this.type === 'spitter') {
        // Maintain distance
        if (len < 200) {
          shouldMove = false; // Stop moving if within range
          // Move away if too close
          this.x -= (dx / len) * this.speed * (dt / 16);
          this.y -= (dy / len) * this.speed * (dt / 16);
        } else if (len > 300) {
          shouldMove = true; // Move closer if too far
        } else {
          shouldMove = false; // Stay in range
        }
        
        // Check line of sight
        let hasLineOfSight = true;
        for (const obs of obstacles) {
          if (obs.isLineBlocked(this.x, this.y, nearest.x, nearest.y)) {
            hasLineOfSight = false;
            break;
          }
        }

        if (hasLineOfSight && this.time - this.lastSpitTime > 2500) {
          this.lastSpitTime = this.time;
          // Spit acid
          const angle = Math.atan2(dy, dx);
          const speed = 5; // Extremely slow speed for easy dodging
          projectiles.push(new Projectile(
            -1, this.x, this.y,
            Math.cos(angle) * speed, Math.sin(angle) * speed,
            10, 1, 3000, 'zombie_spit', 12, true, 1, true // isEnemy = true
          ));
        }
      }

      if (len > 0) {
        this.angle = Math.atan2(dy, dx);
        if (shouldMove) {
          this.x += (dx / len) * this.speed * (dt / 16);
          this.y += (dy / len) * this.speed * (dt / 16);
        }
      }
      this.isCloseToPlayer = minDist < this.radius + 50;
    } else {
      this.isCloseToPlayer = false;
    }

    // Slime trail logic
    if ((this.type === 'slime' || this.type === 'slime_small') && nearest) {
      if (this.time - this.lastTrailTime > 200) {
        this.lastTrailTime = this.time;
        slimeTrails.push({
          x: this.x, y: this.y, radius: this.radius + 5, lifetime: 5000, maxLifetime: 5000
        });
      }
      this.jellyPhase += dt * 0.01;
    }

    // Apply knockback velocity
    this.x += this.vx * (dt / 16);
    this.y += this.vy * (dt / 16);
    
    // Friction for knockback
    const friction = Math.pow(0.92, dt / 16);
    this.vx *= friction;
    this.vy *= friction;
    
    if (Math.abs(this.vx) < 0.01) this.vx = 0;
    if (Math.abs(this.vy) < 0.01) this.vy = 0;

    // Obstacle collision
    for (const obs of obstacles) {
      if (obs.isDestroyed) continue;
      if (obs.collidesWithCircle(this.x, this.y, this.radius)) {
        // Big zombies can destroy sandbags
        if (this.type === 'big' && obs.type === 'sandbag') {
          obs.takeDamage(0.5); // Fast destruction
        }
        
        const resolved = obs.resolveCircleCollision(this.x, this.y, this.radius);
        if (resolved) {
          this.x = resolved.x;
          this.y = resolved.y;
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    drawZombie(this, ctx);
  }
}
