import { CONSTANTS } from './Constants';
import { Obstacle } from './map/Obstacle';
import { WEAPON_REGISTRY } from './entities/definitions/WeaponDefinitions';
import { drawPlayer } from './renderers/PlayerRenderer';

export interface WeaponSlot {
  id: string;
  type: 'sword' | 'gun';
  level: number;
  branch: 'A' | 'B' | null;
  lastAttackTime: number;
  aimAngle?: number; // 獨立索敵的當前鎖定角度
}

export interface OwnedItem {
  id: string;    // 唯一實例 ID（React key 用）
  defId: string; // ITEM_REGISTRY 的鍵值
}

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
  materials: number = 0;
  maxXp: number = 20;
  overdriveXpThreshold: number = 250;

  // ── 武器等級（與玩家等級分離，最高 8 級）────────────────────────────────
  weaponLevels: Record<'sword' | 'gun', number> = { sword: 1, gun: 1 };
  weaponBranches: Record<'sword' | 'gun', 'A' | 'B' | null> = { sword: null, gun: null };
  pendingLevelUp: boolean = false;   // true 時遊戲暫停顯示升級選擇

  // ── 競技場模式：6 把浮游武器 ──────────────────────────────────────────────
  isFloatingWeapons: boolean = false;
  weapons: WeaponSlot[] = [];

  // ── 基礎倍率（Prestige / 全局加成）──────────────────────────────────────
  damageMultiplier: number = 1.0;
  attackSpeedMultiplier: number = 1.0;
  pickupRadiusMultiplier: number = 1.0;

  // ── 競技場素質（Phase 1 選擇，模組化於 StatDefinitions.ts）───────────────
  armor: number = 0;               // 每點減少 1 點傷害
  knockback: number = 0;           // 擊退距離加成
  regenPerSecond: number = 0;      // 每秒回復 HP
  critChance: number = 0;          // 暴擊機率（0.0 ~ 1.0）
  gunDamageBonus: number = 0;      // 槍類傷害平加（配件）
  swordDamageBonus: number = 0;    // 劍類傷害平加（配件）
  statLevels: Record<string, number> = {};   // 各素質已升等數
  arenaStatPoints: number = 0;     // 可用素質點數（進商店時結算）

  // ── 競技場配件背包（Phase 2 購買，模組化於 ItemDefinitions.ts）────────────
  ownedItems: OwnedItem[] = [];

  kills: number = 0;
  lastMoveDir: { x: number, y: number } = { x: 1, y: 0 };
  lastDamageTime: number = 0;
  lastAttackTime: number = 0;
  aimAngle: number = 0;
  shield: boolean = false;
  shieldTimer: number = 0;
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
    // 初期初始化一個武器槽位
    this.weapons = [{
      id: Math.random().toString(36).substr(2, 9),
      type: this.weapon,
      level: 1,
      branch: null,
      lastAttackTime: 0,
      aimAngle: 0
    }];
  }

  addXp(amount: number) {
    if (this.pendingLevelUp) return; // 等待玩家選擇升級時不累積
    this.xp += amount;
    if (this.xp >= this.maxXp) {
      this.xp -= this.maxXp;
      this.level++;
      this.maxXp = Math.round(this.maxXp * 1.35); // 每級需求 ×1.35

      // 無限模式下，武器等級隨角色等級一同成長（最高 8 級）
      this.weaponLevels['sword'] = Math.min(8, this.level);
      this.weaponLevels['gun'] = Math.min(8, this.level);
      this.syncWeaponToSlot();

      this.pendingLevelUp = true;
    }
  }

  /**
   * ── 模組化：同步主武器狀態到懸浮武器槽位 ────────────────────────
   * 無限模式下只會有一個 Slot，此方法確保顯示與邏輯一致
   */
  syncWeaponToSlot() {
    if (!this.isFloatingWeapons) return;
    
    // 確保至少有一個槽位
    if (this.weapons.length === 0) {
      this.weapons.push({
        id: Math.random().toString(36).substr(2, 9),
        type: this.weapon,
        level: this.weaponLevels[this.weapon],
        branch: this.weaponBranches[this.weapon],
        lastAttackTime: 0,
        aimAngle: this.aimAngle
      });
    } else {
      // 同步第一個槽位（無限模式主武器）
      const mainSlot = this.weapons[0];
      mainSlot.type = this.weapon;
      mainSlot.level = this.weaponLevels[this.weapon];
      mainSlot.branch = this.weaponBranches[this.weapon];
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

  activateShield(durationMs: number = 2500) {
    this.shieldTimer = Math.max(this.shieldTimer, durationMs);
    this.shield = true;
  }

  takeDamage(amount: number, sourceTime: number = Date.now()): boolean {
    if (amount <= 0) return false;
    if (this.shieldTimer > 0 || this.shield) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.lastDamageTime = sourceTime;
    return true;
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
    if (this.speedBoostTimer > 0) {
      // 加速期間無視所有減速效果
      currentSpeed *= 1.5;
      this.speedBoostTimer -= dt;
      // 緩速計時器照樣遞減，但效果不發作
      if (this.slowDebuffTimer > 0) {
        this.slowDebuffTimer -= dt;
      }
    } else {
      if (this.slowDebuffTimer > 0) {
        currentSpeed *= 0.7; // 30% slow
        this.slowDebuffTimer -= dt;
      }
    }

    if (this.shieldTimer > 0) {
      this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    }
    this.shield = this.shieldTimer > 0;

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

    // 被動再生（regenPerSecond 素質/配件加成）
    if (this.regenPerSecond > 0 && this.hp < this.maxHp) {
      this.hp += this.regenPerSecond * (dt / 1000);
      this.hp = Math.min(this.hp, this.maxHp);
    }

    // Healing
    if (Date.now() - this.lastDamageTime > CONSTANTS.HEAL_DELAY && this.hp < this.maxHp) {
      this.hp += CONSTANTS.HEAL_RATE * (dt / 1000);
      this.hp = Math.min(this.hp, this.maxHp);
      this.isRegenerating = true;
    } else {
      this.isRegenerating = this.regenPerSecond > 0 && this.hp < this.maxHp;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    drawPlayer(this, ctx);
  }
}
