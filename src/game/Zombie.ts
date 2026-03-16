import { CONSTANTS } from './Constants';
import { Player } from './Player';
import { Obstacle } from './map/Obstacle';
import { Projectile } from './Projectile';

export type ZombieType = 'normal' | 'big' | 'slime' | 'slime_small' | 'spitter';

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
    if (type === 'big') {
      this.radius = 30;
      this.hp = CONSTANTS.BIG_ZOMBIE_HP;
      this.maxHp = CONSTANTS.BIG_ZOMBIE_HP;
      this.speed = CONSTANTS.BIG_ZOMBIE_SPEED;
    } else if (type === 'slime') {
      this.radius = 16;
      this.hp = 10;
      this.maxHp = 10;
      this.speed = CONSTANTS.ZOMBIE_SPEED * 1.5;
    } else if (type === 'slime_small') {
      this.radius = 10;
      this.hp = 3;
      this.maxHp = 3;
      this.speed = 2.7;
    } else if (type === 'spitter') {
      this.radius = 18;
      this.hp = 20;
      this.maxHp = 20;
      this.speed = CONSTANTS.ZOMBIE_SPEED * 0.6;
    } else {
      this.radius = 12;
      this.hp = CONSTANTS.ZOMBIE_HP;
      this.maxHp = CONSTANTS.ZOMBIE_HP;
      this.speed = CONSTANTS.ZOMBIE_SPEED;
    }
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
    ctx.save();
    if (this.isInsideContainer) {
      ctx.globalAlpha = 0.4;
    }
    
    let swayX = 0;
    let swayY = 0;
    let rotation = this.angle + Math.PI / 2; // Face the player (up is forward)
    
    if (this.leanBackTimer > 0) {
      rotation -= Math.PI / 4 * (this.leanBackTimer / 300); // Lean back
    }
    
    if (this.type === 'big') {
      // Heavy, slow swaying with a limp
      swayX = Math.sin(this.time / 400) * 3;
      swayY = Math.abs(Math.cos(this.time / 400)) * 2; // Bobbing up and down
      rotation += Math.sin(this.time / 400) * 0.15;
    } else if (this.type === 'slime' || this.type === 'slime_small') {
      // Jelly movement
      swayX = Math.sin(this.time / 150) * 2;
      swayY = Math.cos(this.time / 150) * 2;
    } else {
      // Speedy jitter
      swayX = Math.sin(this.time / 100) * 1;
      swayY = Math.cos(this.time / 100) * 1;
    }

    ctx.translate(this.x + swayX, this.y + swayY);
    ctx.rotate(rotation);

    if (this.type === 'big') {
      const bounce = Math.abs(Math.sin(this.time / 400));
      ctx.scale(1 + bounce * 0.08, 1 - bounce * 0.05);
    } else if (this.type === 'slime' || this.type === 'slime_small') {
      const scaleX = 1 + Math.sin(this.jellyPhase) * 0.15;
      const scaleY = 1 + Math.cos(this.jellyPhase) * 0.15;
      ctx.scale(scaleX, scaleY);
    }

    // Shadow
    ctx.beginPath();
    ctx.arc(4, 6, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();
    ctx.closePath();

    if (this.type === 'big') {
      // Heavy arms swinging underneath the body
      const armSwing = Math.sin(this.time / 400) * 15;
      ctx.fillStyle = '#144d18'; // Slightly darker green for arms
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      
      // Left arm
      ctx.beginPath();
      ctx.arc(-this.radius + 2, 5 + armSwing, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Right arm
      ctx.beginPath();
      ctx.arc(this.radius - 2, 5 - armSwing, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Body
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    
    if (this.type === 'big') ctx.fillStyle = '#1b5e20';
    else if (this.type === 'slime') ctx.fillStyle = '#8bc34a'; // Yellow-green
    else if (this.type === 'slime_small') ctx.fillStyle = '#7cb342';
    else if (this.type === 'spitter') ctx.fillStyle = '#9c27b0'; // Purple
    else ctx.fillStyle = '#4caf50';

    if (this.flashWhiteTimer > 0) {
      ctx.fillStyle = '#ffffff';
    }

    if (this.isInfiniteGlow) {
      ctx.shadowColor = ctx.fillStyle as string;
      ctx.shadowBlur = 15;
    }

    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.closePath();

    if (this.type === 'normal') {
      // Glowing Red Eyes
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff0000';
      
      ctx.beginPath(); ctx.arc(-4, -4, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4, -4, 2.5, 0, Math.PI * 2); ctx.fill();
      
      ctx.shadowBlur = 0; // Reset shadow

      // Mouth
      if (this.isCloseToPlayer) {
        // Jagged Mouth
        ctx.beginPath();
        ctx.moveTo(-6, 2);
        ctx.lineTo(-3, 6);
        ctx.lineTo(0, 2);
        ctx.lineTo(3, 6);
        ctx.lineTo(6, 2);
        ctx.lineTo(6, 8);
        ctx.lineTo(-6, 8);
        ctx.closePath();
        ctx.fillStyle = '#3e0000';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        // Normal closed mouth
        ctx.beginPath();
        ctx.moveTo(-4, 4);
        ctx.lineTo(4, 4);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (this.type === 'big') {
      // Big Zombie Features
      
      // Dull Eyes
      ctx.fillStyle = '#8bc34a'; // Pale green/yellow eyes
      ctx.beginPath(); ctx.arc(-12, -15, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(12, -15, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Stitch marks
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3; // Thicker stitches
      
      // Main stitch line across the forehead
      ctx.beginPath();
      ctx.moveTo(-22, -2);
      ctx.lineTo(18, 12);
      ctx.stroke();
      
      // Cross stitches
      for(let i = 0; i < 6; i++) {
        const t = (i + 1) / 7;
        const sx = -22 + 40 * t;
        const sy = -2 + 14 * t;
        ctx.beginPath();
        ctx.moveTo(sx - 5, sy + 5);
        ctx.lineTo(sx + 5, sy - 5);
        ctx.stroke();
      }
      
      // Neck Bolts
      ctx.fillStyle = '#9e9e9e'; // Grey metal
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      
      // Left bolt
      ctx.beginPath();
      ctx.rect(-this.radius - 4, -5, 8, 10);
      ctx.fill();
      ctx.stroke();
      
      // Right bolt
      ctx.beginPath();
      ctx.rect(this.radius - 4, -5, 8, 10);
      ctx.fill();
      ctx.stroke();
      
      // Heavy Mouth
      ctx.beginPath();
      ctx.moveTo(-10, -22);
      ctx.lineTo(10, -22);
      ctx.lineTo(8, -26);
      ctx.lineTo(-8, -26);
      ctx.closePath();
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.stroke();
    } else if (this.type === 'spitter') {
      // Venom spots
      ctx.fillStyle = '#8bc34a';
      ctx.beginPath(); ctx.arc(-5, -5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-2, 6, 2, 0, Math.PI * 2); ctx.fill();
      
      // Eyes
      ctx.fillStyle = '#00ff00';
      ctx.beginPath(); ctx.arc(-6, -10, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -10, 2.5, 0, Math.PI * 2); ctx.fill();
      
      // Mouth (ready to spit)
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(0, -15, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8bc34a';
      ctx.beginPath(); ctx.arc(0, -15, 2, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'slime' || this.type === 'slime_small') {
      // Slime core/eyes
      ctx.fillStyle = '#33691e';
      ctx.beginPath(); ctx.arc(-4, -4, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4, -4, 2, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();

    // HP Bar
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    const barWidth = this.radius * 2;
    const barHeight = this.type === 'big' ? 5 : 3;
    ctx.fillStyle = 'red';
    ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 10, barWidth, barHeight);
    ctx.fillStyle = 'green';
    ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 10, barWidth * hpRatio, barHeight);
  }
}
