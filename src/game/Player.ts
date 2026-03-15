import { CONSTANTS } from './Constants';
import { Obstacle } from './map/Obstacle';

export class Player {
  id: number;
  x: number;
  y: number;
  radius: number = 15;
  hp: number = CONSTANTS.PLAYER_MAX_HP;
  maxHp: number = CONSTANTS.PLAYER_MAX_HP;
  speed: number = CONSTANTS.PLAYER_SPEED;
  weapon: 'sword' | 'gun';
  level: number = 1;
  prestigeLevel: number = 0;
  xp: number = 0;
  maxXp: number = 20;
  overdriveXpThreshold: number = 250;
  
  // Prestige Stats
  damageMultiplier: number = 1.0;
  attackSpeedMultiplier: number = 1.0;
  pickupRadiusMultiplier: number = 1.0;

  kills: number = 0;
  lastMoveDir: { x: number, y: number } = { x: 1, y: 0 };
  lastDamageTime: number = 0;
  lastAttackTime: number = 0;
  aimAngle: number = 0;
  shield: boolean = false;
  speedBoostTimer: number = 0;
  slowDebuffTimer: number = 0;
  color: string;
  weaponSwitchTimer: number = 0;
  weaponSwitchType: 'sword' | 'gun' | null = null;
  isInfiniteGlow: boolean = false;
  isInsideContainer: boolean = false;
  isAtAltar: boolean = false;
  isRegenerating: boolean = false;
  lastRegenVfxTime: number = 0;

  constructor(id: number, x: number, y: number, color: string) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.color = color;
    this.weapon = Math.random() > 0.5 ? 'sword' : 'gun';
  }

  addXp(amount: number) {
    this.xp += amount;
    
    if (this.level < 5) {
      while (this.xp >= this.maxXp && this.level < 5) {
        this.xp -= this.maxXp;
        this.level++;
        if (this.level === 2) this.maxXp = 50;
        else if (this.level === 3) this.maxXp = 100;
        else if (this.level === 4) this.maxXp = 200;
        
        if (this.level === 5) {
          this.maxXp = this.overdriveXpThreshold;
        }
      }
    } else {
      // Overdrive / Prestige logic
      while (this.xp >= this.overdriveXpThreshold) {
        this.xp -= this.overdriveXpThreshold;
        this.prestigeLevel++;
        this.applyRandomOverdriveUpgrade();
      }
    }
  }

  applyRandomOverdriveUpgrade() {
    const upgrades = ['power', 'haste', 'agility', 'vitality', 'magnet'];
    const choice = upgrades[Math.floor(Math.random() * upgrades.length)];
    
    switch (choice) {
      case 'power':
        this.damageMultiplier += 0.10;
        break;
      case 'haste':
        this.attackSpeedMultiplier += 0.10;
        break;
      case 'agility':
        this.speed += CONSTANTS.PLAYER_SPEED * 0.05;
        break;
      case 'vitality':
        this.maxHp += 10;
        this.hp = Math.min(this.hp + 20, this.maxHp);
        break;
      case 'magnet':
        this.pickupRadiusMultiplier += 0.20;
        break;
    }
  }

  update(dt: number, keys: Record<string, boolean>, obstacles: Obstacle[], externalInput?: { x: number, y: number }, onHeal?: () => void) {
    let dx = 0;
    let dy = 0;

    if (externalInput) {
      dx = externalInput.x;
      dy = externalInput.y;
    } else if (this.id === 1) {
      if (keys['w'] || keys['W']) dy -= 1;
      if (keys['s'] || keys['S']) dy += 1;
      if (keys['a'] || keys['A']) dx -= 1;
      if (keys['d'] || keys['D']) dx += 1;
    } else {
      if (keys['ArrowUp']) dy -= 1;
      if (keys['ArrowDown']) dy += 1;
      if (keys['ArrowLeft']) dx -= 1;
      if (keys['ArrowRight']) dx += 1;
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
      this.lastMoveDir = { x: dx, y: dy };
    }

    let currentSpeed = this.speed;
    if (this.slowDebuffTimer > 0) {
      currentSpeed *= 0.7; // 30% slow
      this.slowDebuffTimer -= dt;
    }
    if (this.speedBoostTimer > 0) {
      currentSpeed *= 1.5;
      this.speedBoostTimer -= dt;
    }
    
    if (this.weaponSwitchTimer > 0) {
      this.weaponSwitchTimer -= dt;
    }

    this.x += dx * currentSpeed * (dt / 16);
    this.y += dy * currentSpeed * (dt / 16);

    // Obstacle collision
    for (const obs of obstacles) {
      const resolved = obs.resolveCircleCollision(this.x, this.y, this.radius);
      if (resolved) {
        this.x = resolved.x;
        this.y = resolved.y;
      }
    }

    // Healing
    if (Date.now() - this.lastDamageTime > CONSTANTS.HEAL_DELAY && this.hp < this.maxHp) {
      this.hp += CONSTANTS.HEAL_RATE * (dt / 1000);
      this.hp = Math.min(this.hp, this.maxHp);
      this.isRegenerating = true;
    } else {
      this.isRegenerating = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.hp <= 0) return;

    const angle = this.aimAngle;

    ctx.save();
    if (this.isInsideContainer) {
      ctx.globalAlpha = 0.4;
    }
    ctx.translate(this.x, this.y);

    // Infinite mode glow
    if (this.level >= 5 || this.isInfiniteGlow) {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 15;
    }
    if (this.weaponSwitchTimer > 0) {
      const progress = 1 - (this.weaponSwitchTimer / 500); // 0 to 1 over 0.5s
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + progress * 40, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`;
      ctx.lineWidth = 4 * (1 - progress);
      ctx.stroke();
    }

    // Draw shadow
    ctx.beginPath();
    ctx.arc(4, 6, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();
    ctx.closePath();

    // Draw weapon
    ctx.save();
    ctx.rotate(angle);
    
    // Weapon glow if recently switched
    if (this.weaponSwitchTimer > 0) {
      ctx.shadowColor = 'white';
      ctx.shadowBlur = 10;
    }
    
    // Weapon positioning offset
    const weaponX = 15;
    const weaponY = 10;

    if (this.weapon === 'sword') {
      ctx.translate(weaponX, weaponY);
      // Sword swing animation based on attack time
      const timeSinceAttack = Date.now() - this.lastAttackTime;
      const attackDuration = 200;
      if (timeSinceAttack < attackDuration) {
        const swingProgress = timeSinceAttack / attackDuration;
        ctx.rotate(-Math.PI / 2 + swingProgress * Math.PI);
      } else {
        ctx.rotate(-Math.PI / 4); // Idle pose
      }

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#222';

      if (this.level === 1) {
        // Lv 1: Survival Machete
        ctx.fillStyle = '#9e9e9e'; // Steel blade
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(18, -3);
        ctx.lineTo(22, 0);
        ctx.lineTo(18, 3);
        ctx.lineTo(0, 3);
        ctx.fill();
        ctx.stroke();
        // Blood stain on tip
        ctx.fillStyle = 'rgba(139, 0, 0, 0.6)';
        ctx.beginPath(); ctx.moveTo(15, -2); ctx.lineTo(21, 0); ctx.lineTo(15, 2); ctx.fill();
        // Handle
        ctx.fillStyle = '#3e2723'; // Dark wood/tape
        ctx.fillRect(-6, -2, 6, 4);
        ctx.strokeRect(-6, -2, 6, 4);

      } else if (this.level === 2) {
        // Lv 2: Knight's Longsword
        ctx.fillStyle = '#cfd8dc'; // Polished steel
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(28, -2);
        ctx.lineTo(32, 0);
        ctx.lineTo(28, 2);
        ctx.lineTo(0, 4);
        ctx.fill();
        ctx.stroke();
        // Fuller (blood groove)
        ctx.fillStyle = '#90a4ae';
        ctx.fillRect(2, -1, 20, 2);
        // Crossguard
        ctx.fillStyle = '#ffb300'; // Brass
        ctx.fillRect(-2, -8, 4, 16);
        ctx.strokeRect(-2, -8, 4, 16);
        // Handle & Pommel
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-8, -2, 6, 4);
        ctx.fillStyle = '#ffb300';
        ctx.beginPath(); ctx.arc(-9, 0, 3, 0, Math.PI*2); ctx.fill(); ctx.stroke();

      } else if (this.level === 3) {
        // Lv 3: Master Katana
        ctx.fillStyle = '#eceff1'; // Bright steel
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.quadraticCurveTo(15, -6, 35, -2); // Curved back
        ctx.lineTo(38, 2); // Tip
        ctx.quadraticCurveTo(15, 0, 0, 2); // Curved edge
        ctx.fill();
        ctx.stroke();
        // Hamon (temper line)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(15, -2, 32, 0); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#222';
        // Tsuba (Guard)
        ctx.fillStyle = '#212121';
        ctx.fillRect(-2, -5, 3, 10);
        // Tsuka (Wrapped Handle)
        ctx.fillStyle = '#b71c1c'; // Red wrap
        ctx.fillRect(-10, -2, 8, 4);
        ctx.fillStyle = '#000';
        for(let i=-9; i<-2; i+=3) { ctx.fillRect(i, -2, 1, 4); } // Diamond pattern hint

      } else if (this.level === 4) {
        // Lv 4: Demonic Broadsword
        ctx.fillStyle = '#37474f'; // Dark metal
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(35, -6);
        ctx.lineTo(45, 0);
        ctx.lineTo(35, 6);
        ctx.lineTo(0, 8);
        ctx.fill();
        ctx.stroke();
        // Glowing Runes
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ff1744';
        ctx.font = '10px Arial';
        ctx.fillText('▼▲▼', 15, 3);
        ctx.shadowBlur = 0;
        // Heavy Guard
        ctx.fillStyle = '#263238';
        ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(2, -8); ctx.lineTo(2, 8); ctx.lineTo(-4, 12); ctx.fill(); ctx.stroke();
        // Handle
        ctx.fillStyle = '#111';
        ctx.fillRect(-12, -3, 8, 6);

      } else {
        // Lv 5: Plasma Energy Sword
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 15;
        // Energy Blade
        ctx.fillStyle = '#e0ffff';
        ctx.beginPath();
        ctx.moveTo(2, -4);
        ctx.lineTo(45, -2);
        ctx.lineTo(55, 0);
        ctx.lineTo(45, 2);
        ctx.lineTo(2, 4);
        ctx.fill();
        // Core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(4, -1); ctx.lineTo(40, 0); ctx.lineTo(4, 1); ctx.fill();
        ctx.shadowBlur = 0;
        // High-tech Hilt
        ctx.fillStyle = '#212121';
        ctx.fillRect(-10, -5, 12, 10);
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(-6, -3, 4, 6); // Power cell
      }
    } else {
      // Gun
      ctx.translate(weaponX, weaponY);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#111';

      if (this.level === 1) {
        // Lv 1: 9mm Tactical Pistol
        ctx.fillStyle = '#424242'; // Slide
        ctx.fillRect(0, -4, 16, 5);
        ctx.strokeRect(0, -4, 16, 5);
        ctx.fillStyle = '#212121'; // Frame/Grip
        ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(12, 1); ctx.lineTo(12, 3); ctx.lineTo(0, 3); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-2, 1); ctx.lineTo(4, 1); ctx.lineTo(2, 10); ctx.lineTo(-4, 10); ctx.fill();
        // Details
        ctx.fillStyle = '#757575'; ctx.fillRect(12, -3, 2, 2); // Ejection port

      } else if (this.level === 2) {
        // Lv 2: Submachine Gun (SMG)
        ctx.fillStyle = '#333';
        ctx.fillRect(0, -5, 22, 7); // Receiver
        ctx.strokeRect(0, -5, 22, 7);
        ctx.fillStyle = '#111';
        ctx.fillRect(22, -3, 8, 3); // Barrel
        ctx.fillRect(8, 2, 4, 12); // Extended Magazine
        ctx.beginPath(); ctx.moveTo(-2, 2); ctx.lineTo(4, 2); ctx.lineTo(2, 10); ctx.lineTo(-4, 10); ctx.fill(); // Grip
        ctx.strokeStyle = '#555'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-10, -2); ctx.lineTo(-10, 8); ctx.stroke(); // Wire stock

      } else if (this.level === 3) {
        // Lv 3: Assault Rifle with Holo Sight
        ctx.fillStyle = '#2c3e50'; // Dark blue-grey
        ctx.fillRect(0, -5, 30, 8); // Body
        ctx.strokeRect(0, -5, 30, 8);
        ctx.fillStyle = '#111';
        ctx.fillRect(30, -3, 12, 4); // Barrel
        ctx.fillRect(10, 3, 6, 10); // Mag
        ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(6, 3); ctx.lineTo(4, 12); ctx.lineTo(-2, 12); ctx.fill(); // Grip
        ctx.fillRect(-12, -4, 12, 6); // Solid stock
        // Holo Sight
        ctx.fillStyle = '#222'; ctx.fillRect(8, -9, 8, 4);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; ctx.fillRect(10, -8, 4, 2); // Red dot lens

      } else if (this.level === 4) {
        // Lv 4: Heavy Combat Shotgun
        ctx.fillStyle = '#3e2723'; // Wood furniture
        ctx.fillRect(-10, -3, 10, 6); // Stock
        ctx.fillRect(15, 1, 12, 4); // Pump
        ctx.fillStyle = '#212121'; // Metal
        ctx.fillRect(0, -4, 35, 5); // Receiver + Barrel
        ctx.fillRect(0, 1, 32, 3); // Tube magazine
        ctx.strokeRect(0, -4, 35, 5);
        ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(6, 4); ctx.lineTo(4, 12); ctx.lineTo(-2, 12); ctx.fill(); // Grip

      } else {
        // Lv 5: Plasma Cannon
        ctx.fillStyle = '#1a237e'; // Deep blue high-tech casing
        ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(25, -8); ctx.lineTo(35, -4); ctx.lineTo(35, 4); ctx.lineTo(25, 8); ctx.lineTo(-5, 8); ctx.fill(); ctx.stroke();
        
        // Glowing Coils
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#00e5ff';
        for(let i=5; i<25; i+=6) {
          ctx.fillRect(i, -6, 3, 12);
        }
        // Plasma Muzzle
        ctx.beginPath(); ctx.arc(35, 0, 6, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        
        // Grip & Stock
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(8, 8); ctx.lineTo(4, 16); ctx.lineTo(-4, 16); ctx.fill();
        ctx.fillRect(-15, -4, 10, 8);
      }
    }
    ctx.restore();

    // Draw hands
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = '#ffccaa'; // Skin color (can be adjusted or match player color)
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    
    // Left hand
    ctx.beginPath();
    ctx.arc(10, -10, 5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    
    // Right hand (holding weapon)
    ctx.beginPath();
    ctx.arc(15, 10, 5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Draw main body
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#222';
    ctx.stroke();
    ctx.closePath();

    if (this.shield) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'cyan';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.closePath();
    }

    if (this.slowDebuffTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(139, 195, 74, 0.8)'; // Slime green
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.closePath();
    }

    ctx.restore(); // Restore translation

    // HP Bar
    const hpRatio = this.hp / this.maxHp;
    ctx.fillStyle = 'red';
    ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
    ctx.fillStyle = 'green';
    ctx.fillRect(this.x - 15, this.y - 25, 30 * hpRatio, 4);

    // Level indicator
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    let levelText = `Lv.${this.level}`;
    if (this.prestigeLevel > 0) {
      levelText += ` (+${this.prestigeLevel})`;
      ctx.fillStyle = '#ffd700'; // Gold for prestige
    }
    ctx.fillText(levelText, this.x, this.y - 30);
  }
}
