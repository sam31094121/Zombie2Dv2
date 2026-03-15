import { Zombie } from './Zombie';
import { Obstacle } from './map/Obstacle';

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

  constructor(
    ownerId: number,
    x: number, y: number, vx: number, vy: number,
    damage: number, pierce: number, lifetime: number,
    type: 'bullet' | 'slash' | 'zombie_spit', radius: number, knockback: boolean = false,
    level: number = 1, isEnemy: boolean = false
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
    ctx.save();
    
    // Shadow
    if (this.type === 'bullet' || this.type === 'zombie_spit') {
      ctx.beginPath();
      ctx.arc(this.x + 4, this.y + 6, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();
      ctx.closePath();
    }

    if (this.type === 'bullet') {
      const angle = Math.atan2(this.vy, this.vx);
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);

      if (this.level === 1) {
        // Lv.1: Old Pistol - Small yellow dot
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffeb3b';
        ctx.fill();
        ctx.closePath();
      } else if (this.level === 2) {
        // Lv.2: Double-barrel SMG - Blue bullet with trail
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#00e5ff';
        ctx.fill();
        ctx.closePath();
        // Trail
        ctx.fillStyle = 'rgba(0, 229, 255, 0.5)';
        ctx.fillRect(-15, -2, 10, 4);
      } else if (this.level === 3) {
        // Lv.3: Plasma Gun - Green plasma beam
        ctx.shadowColor = '#00e676';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(-10, -2, 20, 4, 2);
        ctx.fillStyle = '#b2ff59';
        ctx.fill();
        ctx.closePath();
        ctx.shadowBlur = 0;
      } else if (this.level === 4) {
        // Lv.4: Explosive Shotgun - Orange-red pellet (larger)
        ctx.shadowColor = '#ff5722';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#ff9800';
        ctx.fill();
        ctx.closePath();
        // Fire trail
        ctx.fillStyle = 'rgba(255, 87, 34, 0.6)';
        ctx.beginPath();
        ctx.moveTo(-25, 0);
        ctx.lineTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (this.level === 5) {
        // Lv.5: Spacetime Shotgun - Black sphere with spatial distortion
        ctx.shadowColor = '#9c27b0';
        ctx.shadowBlur = 15;
        
        // Distortion aura (purple/blue)
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(156, 39, 176, 0.5)';
        ctx.fill();
        
        // Black core
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();
        
        // White rim
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    } else if (this.type === 'slash') {
      const angle = Math.atan2(this.vy, this.vx);
      const progress = 1 - (this.lifetime / this.maxLifetime); // 0 to 1
      
      let visualProgress = 0;
      let alpha = 1;
      let offset = 0;
      
      if (progress < 0.2) {
        // Windup: 0 to 1
        const p = progress / 0.2;
        visualProgress = 0;
        alpha = p * 0.5; // Slight glow
        offset = -10 * p; // Pull back
      } else if (progress < 0.6) {
        // Slash: 0 to 1
        const p = (progress - 0.2) / 0.4;
        visualProgress = p;
        alpha = 1;
        offset = -10 * (1 - p); // Move forward
      } else {
        // Lingering: 0 to 1
        const p = (progress - 0.6) / 0.4;
        visualProgress = 1;
        alpha = 1 - p; // Fade out
        offset = 0;
      }
      
      if (alpha <= 0) {
        ctx.restore();
        return;
      }
      
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);
      ctx.translate(offset, 0);
      
      let startAngle = -Math.PI/4; // -45 degrees
      let endAngle = Math.PI/4; // 45 degrees (Total 90)
      
      if (this.level === 2) { startAngle = -Math.PI/4; endAngle = Math.PI/4; } // ±45 (Total 90)
      else if (this.level === 3) { startAngle = -(50 * Math.PI / 180); endAngle = (50 * Math.PI / 180); } // ±50 (Total 100)
      else if (this.level === 4) { startAngle = -Math.PI/3; endAngle = Math.PI/3; } // ±60 (Total 120)
      else if (this.level === 5) { startAngle = -(85 * Math.PI / 180); endAngle = (85 * Math.PI / 180); } // ±85 (Total 170)
      
      const currentEndAngle = startAngle + (endAngle - startAngle) * visualProgress;
      
      if (visualProgress > 0) {
        if (this.level === 1) {
          // Lv.1: Rusty Dagger - Grey short arc
          ctx.beginPath();
          ctx.arc(0, 0, this.radius, startAngle, currentEndAngle);
          ctx.strokeStyle = `rgba(158, 158, 158, ${alpha})`;
          ctx.lineWidth = 4;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, this.radius, startAngle, currentEndAngle);
          ctx.fillStyle = `rgba(158, 158, 158, ${alpha * 0.2})`;
          ctx.fill();
        } else if (this.level === 2) {
          // Lv.2: Steel Longsword - Bright silver long arc
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 15;
          
          // Outer bright stroke
          ctx.beginPath();
          ctx.arc(0, 0, this.radius, startAngle, currentEndAngle);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 8;
          ctx.stroke();
          
          // Inner core stroke
          ctx.beginPath();
          ctx.arc(0, 0, this.radius - 2, startAngle, currentEndAngle);
          ctx.strokeStyle = `rgba(200, 220, 255, ${alpha})`;
          ctx.lineWidth = 3;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, this.radius, startAngle, currentEndAngle);
          ctx.fillStyle = `rgba(224, 230, 255, ${alpha * 0.25})`;
          ctx.fill();
          
          ctx.shadowBlur = 0;
        } else if (this.level === 3) {
          // Lv.3: Ice Greatsword - Wide blue sword aura, ice shatter
          ctx.shadowColor = '#00b0ff';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(0, 0, this.radius, startAngle, currentEndAngle);
          ctx.strokeStyle = `rgba(128, 216, 255, ${alpha})`;
          ctx.lineWidth = 15;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, this.radius, startAngle, currentEndAngle);
          ctx.fillStyle = `rgba(0, 176, 255, ${alpha * 0.4})`;
          ctx.fill();
          
          // Ice shards
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          for(let i=0; i<5; i++) {
            const shardAngle = startAngle + (endAngle - startAngle) * Math.random() * visualProgress;
            const dist = this.radius * (0.5 + Math.random() * 0.5);
            ctx.fillRect(Math.cos(shardAngle) * dist, Math.sin(shardAngle) * dist, 4, 4);
          }
          ctx.shadowBlur = 0;
        } else if (this.level === 4) {
          // Lv.4: Pulse Light Blade - Red high-energy particle fan
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 20;
          
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
          grad.addColorStop(0, `rgba(255, 0, 0, 0)`);
          grad.addColorStop(0.8, `rgba(255, 0, 0, ${alpha})`);
          grad.addColorStop(1, `rgba(255, 200, 0, ${alpha})`);
          
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, this.radius, startAngle, currentEndAngle);
          ctx.fillStyle = grad;
          ctx.fill();
          
          // Shockwave lines
          ctx.beginPath();
          ctx.arc(0, 0, this.radius, startAngle, currentEndAngle);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else if (this.level === 5) {
          // Lv.5: Mythic Judgment - Golden 360-degree blade
          ctx.shadowColor = '#ffd600';
          ctx.shadowBlur = 30;
          
          ctx.beginPath();
          ctx.arc(0, 0, this.radius, startAngle, currentEndAngle);
          ctx.strokeStyle = `rgba(255, 214, 0, ${alpha})`;
          ctx.lineWidth = 20 * alpha;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, this.radius, startAngle, currentEndAngle);
          ctx.fillStyle = `rgba(255, 234, 0, ${alpha * 0.3})`;
          ctx.fill();
          
          // Golden particles
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          for(let i=0; i<8; i++) {
            const pAngle = startAngle + (endAngle - startAngle) * Math.random() * visualProgress;
            const pDist = this.radius * Math.random();
            ctx.beginPath();
            ctx.arc(Math.cos(pAngle) * pDist, Math.sin(pAngle) * pDist, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
        }
        
        // Motion blur edge (white light stream)
        if (progress >= 0.2 && progress < 0.6) {
          ctx.beginPath();
          ctx.arc(0, 0, this.radius, currentEndAngle - 0.2, currentEndAngle);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 10;
          ctx.stroke();
        }
      }
    } else if (this.type === 'zombie_spit') {
      ctx.shadowColor = '#8bc34a';
      ctx.shadowBlur = 15;

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#9c27b0';
      ctx.fill();
      ctx.closePath();
      
      // Acid spots / bubbles
      const t = Date.now() / 100;
      ctx.fillStyle = '#8bc34a';
      ctx.beginPath(); ctx.arc(this.x - 3, this.y - 3 + Math.sin(t)*2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.x + 3, this.y + 2 + Math.cos(t)*2, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.x - 1, this.y + 4 + Math.sin(t+1)*2, 2, 0, Math.PI * 2); ctx.fill();

      // Trail effect
      ctx.beginPath();
      ctx.arc(this.x - this.vx * 0.05, this.y - this.vy * 0.05, this.radius * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(156, 39, 176, 0.5)';
      ctx.fill();
      ctx.closePath();

      ctx.shadowBlur = 0;
    }
    
    ctx.restore();
  }
}
