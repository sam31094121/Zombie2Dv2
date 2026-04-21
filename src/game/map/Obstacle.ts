import { Player } from '../Player';
import { drawObstacle } from '../renderers/ObstacleRenderer';

export type ObstacleType = 
  | 'wall' | 'pillar' | 'tree' | 'rock' | 'building'
  | 'sandbag' | 'electric_fence' | 'explosive_barrel' | 'streetlight' 
  | 'tombstone' | 'vending_machine' | 'container' | 'altar' | 'monolith';

export class Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: ObstacleType;
  seed: number; // For randomizing visuals
  hp: number;
  maxHp: number;
  isDestroyed: boolean = false;
  lastEffectTime: number = 0;
  isTriggered: boolean = false; // For explosive barrels or vending machines
  triggerTimer: number = 0;
  respawnTimer: number = 0;
  lastHealTick: number = 0; // For streetlight healing
  tombstoneSummonTimer: number = 3000;
  tombstoneMaxHits: number = 0;
  isArenaWaveObstacle: boolean = false;

  constructor(x: number, y: number, width: number, height: number, type: ObstacleType) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;
    this.seed = Math.random() * 10000;
    
    // Set HP for destructible objects
    if (type === 'sandbag') this.maxHp = 100;
    else if (type === 'explosive_barrel') this.maxHp = 20;
    else if (type === 'tombstone') this.maxHp = 10;
    else if (type === 'vending_machine') this.maxHp = 80;
    else this.maxHp = 1000000; // Indestructible
    
    this.hp = this.maxHp;
    if (type === 'tombstone') {
      this.tombstoneMaxHits = 10;
      this.tombstoneSummonTimer = 3000;
    }
  }

  update(dt: number, players?: Player[], onHealCallback?: (p: Player) => void) {
    if (this.isDestroyed && this.type === 'explosive_barrel') {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.isDestroyed = false;
        this.isTriggered = false;
        this.hp = this.maxHp;
        this.respawnTimer = 0;
      }
    }

    if (this.type === 'streetlight' && !this.isDestroyed && players && onHealCallback) {
      const now = Date.now();
      if (now - this.lastHealTick >= 1000) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const auraRadius = 150;
        const healAmount = 5;

        players.forEach(player => {
          const dx = player.x - cx;
          const dy = player.y - cy;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < auraRadius && player.hp > 0) {
            if (player.hp < player.maxHp) {
              player.hp = Math.min(player.maxHp, player.hp + healAmount);
              onHealCallback(player);
            }
          }
        });
        this.lastHealTick = now;
      }
    }
  }

  takeDamage(amount: number) {
    if (this.isDestroyed) return;
    if (this.type === 'tombstone') {
      this.hp -= 1;
    } else {
      this.hp -= amount;
    }
    if (this.hp <= 0 || this.type === 'explosive_barrel') {
      this.isDestroyed = true;
      if (this.type === 'explosive_barrel') {
        this.isTriggered = true;
        this.triggerTimer = 1; // Explode immediately
        this.respawnTimer = 10000; // 10 seconds
      } else if (this.type === 'vending_machine' || this.type === 'tombstone') {
        this.isTriggered = true;
        this.triggerTimer = 100; // Trigger immediately
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, players?: Player[]) {
    drawObstacle(this, ctx, players);
  }

  collidesWithCircle(cx: number, cy: number, r: number): boolean {
    if (this.isDestroyed && this.type !== 'explosive_barrel' && this.type !== 'vending_machine') return false;

    if (this.type === 'pillar' || this.type === 'rock' || this.type === 'building' || 
        this.type === 'sandbag' || this.type === 'explosive_barrel' || this.type === 'streetlight' || 
        this.type === 'monolith') {
      const px = this.x + this.width / 2;
      const py = this.y + this.height / 2;
      const dist = Math.hypot(cx - px, cy - py);
      const obstacleRadius = this.type === 'streetlight' ? 10 : this.width / 2;
      return dist < (obstacleRadius + r);
    } else if (this.type === 'tree') {
      const px = this.x + this.width / 2;
      const py = this.y + this.height / 2;
      const dist = Math.hypot(cx - px, cy - py);
      const trunkRadius = (this.width / 2) * 0.3;
      return dist < (trunkRadius + r);
    } else if (this.type === 'electric_fence') {
      // Line segment collision
      return this.distToSegment(cx, cy, this.x, this.y, this.x + this.width, this.y + this.height) < r + 5;
    } else {
      const testX = cx < this.x ? this.x : (cx > this.x + this.width ? this.x + this.width : cx);
      const testY = cy < this.y ? this.y : (cy > this.y + this.height ? this.y + this.height : cy);
      const dist = Math.hypot(cx - testX, cy - testY);
      return dist <= r;
    }
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  resolveCircleCollision(cx: number, cy: number, r: number): { x: number, y: number } | null {
    if (!this.collidesWithCircle(cx, cy, r)) return null;

    if (this.type === 'pillar' || this.type === 'rock' || this.type === 'building' || 
        this.type === 'sandbag' || this.type === 'explosive_barrel' || this.type === 'streetlight' || 
        this.type === 'monolith') {
      const px = this.x + this.width / 2;
      const py = this.y + this.height / 2;
      const dist = Math.hypot(cx - px, cy - py);
      const obstacleRadius = this.type === 'streetlight' ? 10 : this.width / 2;
      const overlap = (obstacleRadius + r) - dist;
      if (overlap > 0 && dist > 0) {
        return {
          x: cx + (cx - px) / dist * overlap,
          y: cy + (cy - py) / dist * overlap
        };
      }
    } else if (this.type === 'tree') {
      const px = this.x + this.width / 2;
      const py = this.y + this.height / 2;
      const dist = Math.hypot(cx - px, cy - py);
      const trunkRadius = (this.width / 2) * 0.3;
      const overlap = (trunkRadius + r) - dist;
      if (overlap > 0 && dist > 0) {
        return {
          x: cx + (cx - px) / dist * overlap,
          y: cy + (cy - py) / dist * overlap
        };
      }
    } else if (this.type === 'electric_fence') {
      // For electric fence, we just push away from the segment
      const x1 = this.x, y1 = this.y, x2 = this.x + this.width, y2 = this.y + this.height;
      const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
      let t = ((cx - x1) * (x2 - x1) + (cy - y1) * (y2 - y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      const nearestX = x1 + t * (x2 - x1);
      const nearestY = y1 + t * (y2 - y1);
      const dist = Math.hypot(cx - nearestX, cy - nearestY);
      const overlap = (r + 5) - dist;
      if (overlap > 0 && dist > 0) {
        return {
          x: cx + (cx - nearestX) / dist * overlap,
          y: cy + (cy - nearestY) / dist * overlap
        };
      }
    } else {
      const testX = cx < this.x ? this.x : (cx > this.x + this.width ? this.x + this.width : cx);
      const testY = cy < this.y ? this.y : (cy > this.y + this.height ? this.y + this.height : cy);
      const dist = Math.hypot(cx - testX, cy - testY);
      const overlap = r - dist;
      if (overlap > 0 && dist > 0) {
        return {
          x: cx + (cx - testX) / dist * overlap,
          y: cy + (cy - testY) / dist * overlap
        };
      } else if (dist === 0) {
        // Center of circle is inside rectangle
        return { x: cx, y: cy - r }; // Simple push up
      }
    }
    return null;
  }

  isLineBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
    // Simple line-rectangle intersection check
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      if (this.collidesWithCircle(x, y, 0)) return true;
    }
    return false;
  }
}
