import { Player } from '../Player';

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
    else if (type === 'tombstone') this.maxHp = 150;
    else if (type === 'vending_machine') this.maxHp = 80;
    else this.maxHp = 1000000; // Indestructible
    
    this.hp = this.maxHp;
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
    this.hp -= amount;
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
    if (this.isDestroyed) {
      if (this.type !== 'explosive_barrel' && this.type !== 'vending_machine' && this.type !== 'tombstone') {
        // Draw rubble for destroyed objects
        this.drawRubble(ctx);
      }
      return;
    }
    
    ctx.save();
    
    // Shadow offset
    const shadowOffsetX = 8;
    const shadowOffsetY = 12;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const r = this.width / 2;

    if (this.type === 'sandbag') {
      this.drawSandbags(ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
    } else if (this.type === 'electric_fence') {
      this.drawElectricFence(ctx, shadowOffsetX, shadowOffsetY);
    } else if (this.type === 'explosive_barrel') {
      this.drawExplosiveBarrel(ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
    } else if (this.type === 'streetlight') {
      this.drawStreetlight(ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
    } else if (this.type === 'tombstone') {
      this.drawTombstone(ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
    } else if (this.type === 'vending_machine') {
      this.drawVendingMachine(ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
    } else if (this.type === 'container') {
      this.drawContainer(ctx, shadowOffsetX, shadowOffsetY);
    } else if (this.type === 'altar') {
      this.drawAltar(ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
    } else if (this.type === 'monolith') {
      this.drawMonolith(ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
    } else if (this.type === 'tree') {
      // Dead tree / Ruined structure
      const trunkRadius = r * 0.3;
      
      // Trunk shadow
      ctx.beginPath();
      ctx.arc(cx + shadowOffsetX * 0.5, cy + shadowOffsetY * 0.5, trunkRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fill();

      // Trunk
      ctx.beginPath();
      ctx.arc(cx, cy, trunkRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#3a3b3c'; // Dark grey
      ctx.fill();
      ctx.strokeStyle = '#1a1b1c';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dead branches (jagged lines)
      ctx.strokeStyle = '#2a2b2c';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + this.seed;
        const branchLen = r * 0.8 + Math.sin(this.seed * i) * r * 0.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx + Math.cos(angle) * branchLen, cy - 10 + Math.sin(angle) * branchLen);
        ctx.stroke();
      }
    } else if (this.type === 'rock' || this.type === 'pillar') {
      // Concrete Rubble
      // Draw shadow
      ctx.beginPath();
      ctx.arc(cx + shadowOffsetX, cy + shadowOffsetY, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fill();

      // Draw base (darker)
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#2a2c30'; // Dark concrete
      ctx.fill();
      ctx.strokeStyle = '#111214';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw top (lighter, 3D effect)
      ctx.beginPath();
      ctx.arc(cx, cy - 10, r, 0, Math.PI * 2);
      ctx.fillStyle = '#3a3d42';
      ctx.fill();
      ctx.strokeStyle = '#1a1c1f';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Highlight (Light grey edge)
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy - 10 - r * 0.3, r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();

      // Rebar sticking out
      if (this.type === 'pillar') {
        ctx.strokeStyle = '#5a3030'; // Rusted metal
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx + 10, cy - 25);
        ctx.moveTo(cx - 5, cy - 10);
        ctx.lineTo(cx - 15, cy - 20);
        ctx.stroke();
      }

    } else if (this.type === 'building') {
      // Ruined Bunker / Building
      // Draw shadow
      ctx.beginPath();
      ctx.arc(cx + shadowOffsetX * 1.5, cy + shadowOffsetY * 1.5, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fill();

      // Draw base (dark concrete)
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#2a2c30';
      ctx.fill();
      ctx.strokeStyle = '#111214';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Draw broken roof layers
      ctx.beginPath();
      ctx.arc(cx, cy - 15, r * 0.9, 0, Math.PI * 1.5); // Broken circle
      ctx.lineTo(cx, cy - 15);
      ctx.closePath();
      ctx.fillStyle = '#3a3d42';
      ctx.fill();
      ctx.strokeStyle = '#1a1c1f';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Inner roof detail (crater/hole)
      ctx.beginPath();
      ctx.arc(cx - 10, cy - 20, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#111214';
      ctx.fill();
      ctx.strokeStyle = '#2a2c30';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rebar sticking out
      ctx.strokeStyle = '#5a3030'; // Rusted metal
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + 10, cy - 10);
      ctx.lineTo(cx + 30, cy - 40);
      ctx.moveTo(cx + 20, cy - 5);
      ctx.lineTo(cx + 40, cy - 20);
      ctx.stroke();

    } else {
      // Concrete Barricade (Wall)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(this.x + shadowOffsetX, this.y + shadowOffsetY, this.width, this.height);

      // Draw base (darker)
      ctx.fillStyle = '#2a2c30';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.strokeStyle = '#111214';
      ctx.lineWidth = 3;
      ctx.strokeRect(this.x, this.y, this.width, this.height);

      // Draw top (lighter, 3D effect)
      ctx.fillStyle = '#3a3d42';
      ctx.fillRect(this.x, this.y - 15, this.width, this.height);
      ctx.strokeStyle = '#1a1c1f';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x, this.y - 15, this.width, this.height);

      // Hazard stripes on top
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.x, this.y - 15, this.width, this.height);
      ctx.clip();
      
      ctx.fillStyle = 'rgba(200, 160, 0, 0.6)'; // Faded yellow
      for (let i = -this.height; i < this.width + this.height; i += 30) {
        ctx.beginPath();
        ctx.moveTo(this.x + i, this.y - 15);
        ctx.lineTo(this.x + i + 15, this.y - 15);
        ctx.lineTo(this.x + i - this.height + 15, this.y - 15 + this.height);
        ctx.lineTo(this.x + i - this.height, this.y - 15 + this.height);
        ctx.fill();
      }
      ctx.restore();

      // Draw side connecting base and top
      ctx.fillStyle = '#1a1c1f';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x, this.y - 15);
      ctx.lineTo(this.x + this.width, this.y - 15);
      ctx.lineTo(this.x + this.width, this.y);
      ctx.fill();
      
      // Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(this.x + 2, this.y - 15 + 2, this.width - 4, 4);
    }
    ctx.restore();
  }

  private drawRubble(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.fillStyle = '#444';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const rx = (Math.sin(this.seed + i) * this.width) / 3;
      const ry = (Math.cos(this.seed + i * 2) * this.height) / 3;
      const size = 5 + Math.abs(Math.sin(this.seed + i * 3)) * 10;
      ctx.beginPath();
      ctx.rect(rx, ry, size, size);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSandbags(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sox: number, soy: number) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx + sox, cy + soy, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sandbags (Brown semi-circles)
    ctx.fillStyle = '#8d6e63';
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 3;
    
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * 15;
      const oy = (i % 2) * 5;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, 15, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      // Stitching
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + ox - 10, cy + oy - 5);
      ctx.lineTo(cx + ox + 10, cy + oy - 5);
      ctx.stroke();
      ctx.strokeStyle = '#3e2723';
      ctx.lineWidth = 3;
    }
  }

  private drawElectricFence(ctx: CanvasRenderingContext2D, sox: number, soy: number) {
    // Shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.x + sox, this.y + soy);
    ctx.lineTo(this.x + this.width + sox, this.y + this.height + soy);
    ctx.stroke();

    // Posts
    ctx.fillStyle = '#333';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - 5, this.y - 5, 10, 10);
    ctx.fillRect(this.x - 5, this.y - 5, 10, 10);
    ctx.strokeRect(this.x + this.width - 5, this.y + this.height - 5, 10, 10);
    ctx.fillRect(this.x + this.width - 5, this.y + this.height - 5, 10, 10);

    // Neon Blue Line
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.width, this.y + this.height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Sparks
    if (Date.now() % 2000 < 200) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      const tx = this.x + (this.width * (Date.now() % 200)) / 200;
      const ty = this.y + (this.height * (Date.now() % 200)) / 200;
      ctx.beginPath();
      ctx.moveTo(tx - 5, ty - 5);
      ctx.lineTo(tx + 5, ty + 5);
      ctx.moveTo(tx + 5, ty - 5);
      ctx.lineTo(tx - 5, ty + 5);
      ctx.stroke();
    }
  }

  private drawExplosiveBarrel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sox: number, soy: number) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(cx + sox, cy + soy, r, 0, Math.PI * 2);
    ctx.fill();

    // Barrel (Red)
    if (this.isTriggered) {
      // Flashing red effect
      const flash = Math.sin(Date.now() / 30) > 0;
      ctx.fillStyle = flash ? '#ff0000' : '#d32f2f';
      const scale = 1 + Math.sin(Date.now() / 30) * 0.15;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = '#d32f2f';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;

    // Rings
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
    ctx.stroke();

    // Skull Symbol
    ctx.fillStyle = '#ffeb3b';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('☠', cx, cy + 5);
  }

  private drawStreetlight(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sox: number, soy: number) {
    // A. 繪製治療柔光圈 (呼吸燈效果)
    const auraRadius = 150;
    const pulse = Math.sin(Date.now() / 600) * 0.15 + 0.85; // 0.7 ~ 1.0 的縮放感
    const gradient = ctx.createRadialGradient(
        cx, cy, 10,
        cx, cy, auraRadius * pulse
    );
    gradient.addColorStop(0, 'rgba(100, 255, 100, 0.3)'); // 內圈亮綠
    gradient.addColorStop(1, 'rgba(100, 255, 100, 0)');   // 外圈透明

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRadius * pulse, 0, Math.PI * 2);
    ctx.fill();

    // B. 繪製路燈底座 (黑色圓柱)
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#1a1a1a'; // 黑色底座
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // C. 燈芯裝飾
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
  }

  private drawTombstone(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sox: number, soy: number) {
    if (this.isTriggered) {
      const scale = 1 + Math.sin(Date.now() / 20) * 0.3;
      ctx.scale(scale, scale);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(this.x + sox, this.y + soy, this.width, this.height);

    // Stone (Dark grey cross)
    ctx.fillStyle = '#455a64';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    
    // Vertical
    ctx.fillRect(cx - 10, cy - 25, 20, 50);
    ctx.strokeRect(cx - 10, cy - 25, 20, 50);
    // Horizontal
    ctx.fillRect(cx - 20, cy - 15, 40, 15);
    ctx.strokeRect(cx - 20, cy - 15, 40, 15);

    // Purple Mist
    ctx.fillStyle = 'rgba(156, 39, 176, 0.2)';
    for (let i = 0; i < 3; i++) {
      const ox = Math.sin(Date.now() / 500 + i) * 20;
      const oy = Math.cos(Date.now() / 700 + i) * 10;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + 20 + oy, 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawVendingMachine(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sox: number, soy: number) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(this.x + sox, this.y + soy, this.width, this.height);

    // Body (Red)
    ctx.fillStyle = '#c62828';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Glass / Screen
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(this.x + 5, this.y + 5, this.width - 10, this.height / 2);
    
    // Cracks
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x + 10, this.y + 10);
    ctx.lineTo(this.x + 30, this.y + 30);
    ctx.moveTo(this.x + 25, this.y + 10);
    ctx.lineTo(this.x + 15, this.y + 25);
    ctx.stroke();

    // Buttons
    ctx.fillStyle = '#ffeb3b';
    ctx.fillRect(this.x + 5, this.y + this.height - 15, 10, 10);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(this.x + 20, this.y + this.height - 15, 10, 10);
  }

  private drawContainer(ctx: CanvasRenderingContext2D, sox: number, soy: number) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.x + sox, this.y + soy, this.width, this.height);

    // Body (Dark Blue)
    ctx.fillStyle = '#1a237e';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Stripes
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2;
    for (let i = 10; i < this.width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(this.x + i, this.y);
      ctx.lineTo(this.x + i, this.y + this.height);
      ctx.stroke();
    }
  }

  private drawAltar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sox: number, soy: number) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(cx + sox, cy + soy, r, 0, Math.PI * 2);
    ctx.fill();

    // Base (Red Pedestal)
    ctx.fillStyle = '#b71c1c';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Blood Pool
    ctx.fillStyle = '#d32f2f';
    const time = Date.now() / 1000;
    const pulse = Math.sin(time * 2) * 5;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.7 + pulse, 0, Math.PI * 2);
    ctx.fill();
    
    // Swirl effect
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.4, time, time + Math.PI);
    ctx.stroke();
  }

  private drawMonolith(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sox: number, soy: number) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(cx + sox - r, cy + soy);
    ctx.lineTo(cx + sox, cy + soy - r);
    ctx.lineTo(cx + sox + r, cy + soy);
    ctx.lineTo(cx + sox, cy + soy + r);
    ctx.closePath();
    ctx.fill();

    // Body (Dark Polygon)
    ctx.fillStyle = '#263238';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Runes
    ctx.strokeStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 10);
    ctx.lineTo(cx + 10, cy + 10);
    ctx.moveTo(cx + 10, cy - 10);
    ctx.lineTo(cx - 10, cy + 10);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  collidesWithCircle(cx: number, cy: number, r: number): boolean {
    if (this.isDestroyed && this.type !== 'explosive_barrel' && this.type !== 'vending_machine' && this.type !== 'tombstone') return false;

    if (this.type === 'pillar' || this.type === 'rock' || this.type === 'building' || 
        this.type === 'sandbag' || this.type === 'explosive_barrel' || this.type === 'streetlight' || 
        this.type === 'altar' || this.type === 'monolith' || this.type === 'tombstone') {
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
        this.type === 'altar' || this.type === 'monolith' || this.type === 'tombstone') {
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
