import { CONSTANTS } from './Constants';
import { Obstacle } from './map/Obstacle';
import { WEAPON_REGISTRY } from './entities/definitions/WeaponDefinitions';
import { drawPlayer } from './renderers/PlayerRenderer';

export class Player {
  id: number;
  x: number;
  y: number;
  radius: number = 15;
  hp: number = CONSTANTS.PLAYER_MAX_HP;
  maxHp: number = CONSTANTS.PLAYER_MAX_HP;
  speed: number = CONSTANTS.PLAYER_SPEED;
  weapon: 'sword' | 'gun';
  level: number = 1;           // 玩家等級（XP 升級，無上限）
  prestigeLevel: number = 0;
  xp: number = 0;
  maxXp: number = 20;
  overdriveXpThreshold: number = 250;

  // ── 武器等級（與玩家等級分離，最高 8 級）────────────────────────────────
  weaponLevels: Record<'sword' | 'gun', number> = { sword: 1, gun: 1 };
  weaponBranches: Record<'sword' | 'gun', 'A' | 'B' | null> = { sword: null, gun: null };
  pendingLevelUp: boolean = false;   // true 時遊戲暫停顯示升級選擇

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
    if (this.pendingLevelUp) return; // 等待玩家選擇升級時不累積
    this.xp += amount;
    if (this.xp >= this.maxXp) {
      this.xp -= this.maxXp;
      this.level++;
      this.maxXp = Math.round(this.maxXp * 1.35); // 每級需求 ×1.35
      this.pendingLevelUp = true;
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
    drawPlayer(this, ctx);
  }
}
