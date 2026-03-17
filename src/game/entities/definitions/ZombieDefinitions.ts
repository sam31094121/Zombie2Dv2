// ── ZombieDefinitions.ts ────────────────────────────────────────────────────
// 殭屍型別登錄表（Registry Pattern / Open-Closed Principle）
//
// 新增殭屍方式：
//   1. 在 types.ts 的 ZombieType 加入新型別名
//   2. 在 ZOMBIE_REGISTRY 加一個 entry（含可選的行為 Hook）
//   3. 在 ZombieRenderer.ts 加對應的 draw case
//   ✅ Zombie.ts / Game.ts 主邏輯零修改
// ────────────────────────────────────────────────────────────────────────────
import { ZombieType } from '../../types';
import { CONSTANTS } from '../../Constants';
import { Projectile } from '../../Projectile';
import type { Player } from '../../Player';
import type { Obstacle } from '../../map/Obstacle';
import type { Zombie } from '../../Zombie';

// ── 分裂死亡規格（slime → 2 slime_small）────────────────────────────────────
export interface ZombieSpawnSpec {
  type: ZombieType;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// ── 行為 Hook 的上下文參數 ────────────────────────────────────────────────────
export interface ZombieBehaviorCtx {
  dt: number;
  nearest: Player | null;
  nearestDist: number;
  players: Player[];
  obstacles: Obstacle[];
  projectiles: Projectile[];
  slimeTrails: { x: number; y: number; radius: number; lifetime: number; maxLifetime: number }[];
}

// ── 殭屍定義介面 ─────────────────────────────────────────────────────────────
export interface IZombieDefinition {
  readonly radius: number;
  readonly baseHp: number;
  readonly baseSpeed: number;
  // XP 掉落
  readonly orbCount: number;
  readonly orbColor: string;
  readonly orbValue: number;
  // 行為旗標
  readonly immuneToKnockback?: boolean;  // 免疫擊退（屠夫）
  readonly leavesTrail?: boolean;        // 移動時留黏液痕（slime 類）
  // 行為 Hook：設定後完全取代預設「追向最近玩家」邏輯
  readonly updateBehavior?: (self: Zombie, ctx: ZombieBehaviorCtx) => void;
  // 障礙物碰撞 Hook（在解析碰撞前呼叫）
  readonly onObstacleCollide?: (self: Zombie, obs: Obstacle) => void;
  // 死亡時額外生成（slime 分裂）
  readonly splitOnDeath?: (x: number, y: number) => ZombieSpawnSpec[];
}

// ────────────────────────────────────────────────────────────────────────────
// ── 行為函式 ────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────

// ── Spitter：保持距離 + 酸液彈 ─────────────────────────────────────────────
function spitterBehavior(self: Zombie, ctx: ZombieBehaviorCtx): void {
  const { dt, nearest, nearestDist, obstacles, projectiles } = ctx;
  if (!nearest) { self.isCloseToPlayer = false; return; }

  const dx = nearest.x - self.x;
  const dy = nearest.y - self.y;

  if (nearestDist < 200) {
    // 太近 → 後退
    self.x -= (dx / nearestDist) * self.speed * (dt / 16);
    self.y -= (dy / nearestDist) * self.speed * (dt / 16);
  } else if (nearestDist > 300) {
    // 太遠 → 靠近
    self.angle = Math.atan2(dy, dx);
    self.x += (dx / nearestDist) * self.speed * (dt / 16);
    self.y += (dy / nearestDist) * self.speed * (dt / 16);
  }

  if (nearestDist > 0) self.angle = Math.atan2(dy, dx);

  // 視線判定
  let hasLOS = true;
  for (const obs of obstacles) {
    if (obs.isLineBlocked(self.x, self.y, nearest.x, nearest.y)) {
      hasLOS = false;
      break;
    }
  }

  if (hasLOS && self.time - self.lastSpitTime > 2500) {
    self.lastSpitTime = self.time;
    const angle = Math.atan2(dy, dx);
    projectiles.push(new Projectile(
      -1, self.x, self.y,
      Math.cos(angle) * 5, Math.sin(angle) * 5,
      10, 1, 3000, 'zombie_spit', 12, true, 1, true,
    ));
  }

  self.isCloseToPlayer = nearestDist < self.radius + 50;
}

// ── slime 分裂函式 ───────────────────────────────────────────────────────────
function slimeSplit(x: number, y: number): ZombieSpawnSpec[] {
  const angle1 = Math.random() * Math.PI * 2;
  const angle2 = angle1 + Math.PI;
  return [
    { type: 'slime_small', x: x + Math.cos(angle1) * 3, y: y + Math.sin(angle1) * 3, vx: Math.cos(angle1) * 16, vy: Math.sin(angle1) * 16 },
    { type: 'slime_small', x: x + Math.cos(angle2) * 3, y: y + Math.sin(angle2) * 3, vx: Math.cos(angle2) * 16, vy: Math.sin(angle2) * 16 },
  ];
}

// ── 屠夫巨獸：衝撞 + 撼地 + 狂暴 ──────────────────────────────────────────
// extraState 鍵:
//   phase:       'walk'|'pre_charge'|'charging'|'slam_windup'|'slamming'|'recovery'
//   phaseEnd:    self.time when to exit current phase
//   slamCDEnd:   self.time when slam is available
//   chargeCDEnd: self.time when charge is available
//   chargeDX/DY: normalized charge direction (locked)
//   slamRadius:  shockwave ring radius (renderer animation)
function butcherBehavior(self: Zombie, ctx: ZombieBehaviorCtx): void {
  const { dt, nearest, nearestDist, players } = ctx;

  const phase      = (self.extraState.get('phase')       ?? 'walk') as string;
  const phaseEnd   = (self.extraState.get('phaseEnd')    ?? 0)      as number;
  const slamCDEnd  = (self.extraState.get('slamCDEnd')   ?? 0)      as number;
  const chargeCDEnd= (self.extraState.get('chargeCDEnd') ?? 0)      as number;
  const chargeDX   = (self.extraState.get('chargeDX')    ?? 0)      as number;
  const chargeDY   = (self.extraState.get('chargeDY')    ?? 0)      as number;

  const now = self.time;
  const isEnraged = self.hp / self.maxHp < 0.3;

  switch (phase) {
    case 'walk': {
      if (!nearest) { self.isCloseToPlayer = false; break; }
      const dx = nearest.x - self.x;
      const dy = nearest.y - self.y;

      // 優先嘗試撼地（近距離）
      if (nearestDist < 180 && now >= slamCDEnd) {
        self.extraState.set('phase', 'slam_windup');
        self.extraState.set('phaseEnd', now + 500);
        self.extraState.set('slamCDEnd', now + 7000);
        break;
      }
      // 嘗試衝撞（中距離）
      if (nearestDist > 80 && nearestDist < 420 && now >= chargeCDEnd) {
        const len = Math.hypot(dx, dy);
        const windup = isEnraged ? 750 : 1500;
        self.extraState.set('phase', 'pre_charge');
        self.extraState.set('phaseEnd', now + windup);
        self.extraState.set('chargeCDEnd', now + 5000 + windup);
        self.extraState.set('chargeDX', dx / len);
        self.extraState.set('chargeDY', dy / len);
        break;
      }
      // 緩慢移動
      if (nearestDist > 0) {
        self.angle = Math.atan2(dy, dx);
        self.x += (dx / nearestDist) * self.speed * (dt / 16);
        self.y += (dy / nearestDist) * self.speed * (dt / 16);
      }
      self.isCloseToPlayer = nearestDist < self.radius + 50;
      break;
    }

    case 'pre_charge': {
      // 追蹤瞄準（最後 300ms 鎖定方向）
      if (nearest && now < phaseEnd - 300) {
        const len = Math.hypot(nearest.x - self.x, nearest.y - self.y);
        if (len > 0) {
          self.extraState.set('chargeDX', (nearest.x - self.x) / len);
          self.extraState.set('chargeDY', (nearest.y - self.y) / len);
          self.angle = Math.atan2(nearest.y - self.y, nearest.x - self.x);
        }
      }
      self.isCloseToPlayer = false;
      if (now >= phaseEnd) {
        self.extraState.set('phase', 'charging');
        self.extraState.set('phaseEnd', now + 600);
      }
      break;
    }

    case 'charging': {
      self.x += chargeDX * 14 * (dt / 16);
      self.y += chargeDY * 14 * (dt / 16);
      self.angle = Math.atan2(chargeDY, chargeDX);

      for (const p of players) {
        if (p.hp <= 0) continue;
        const dist = Math.hypot(p.x - self.x, p.y - self.y);
        if (dist < self.radius + p.radius + 5) {
          const lastDmg = self.lastDamageTime.get(p.id) ?? 0;
          if (now - lastDmg > 400) {
            p.hp = Math.max(0, p.hp - 40);
            p.x += chargeDX * 35;
            p.y += chargeDY * 35;
            self.lastDamageTime.set(p.id, now);
          }
        }
      }

      self.isCloseToPlayer = false;
      if (now >= phaseEnd) {
        self.extraState.set('phase', 'recovery');
        self.extraState.set('phaseEnd', now + 600);
      }
      break;
    }

    case 'slam_windup': {
      self.isCloseToPlayer = false;
      if (now >= phaseEnd) {
        for (const p of players) {
          if (p.hp <= 0) continue;
          if (Math.hypot(p.x - self.x, p.y - self.y) < 150) {
            p.hp = Math.max(0, p.hp - 50);
          }
        }
        self.extraState.set('phase', 'slamming');
        self.extraState.set('phaseEnd', now + 400);
        self.extraState.set('slamRadius', 0);
      }
      break;
    }

    case 'slamming': {
      const elapsed = 400 - Math.max(0, phaseEnd - now);
      self.extraState.set('slamRadius', (elapsed / 400) * 180);
      self.isCloseToPlayer = false;
      if (now >= phaseEnd) {
        self.extraState.set('phase', 'recovery');
        self.extraState.set('phaseEnd', now + 500);
        self.extraState.set('slamRadius', 0);
      }
      break;
    }

    case 'recovery': {
      self.isCloseToPlayer = false;
      if (now >= phaseEnd) self.extraState.set('phase', 'walk');
      break;
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// ── 殭屍登錄表 ────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
export const ZOMBIE_REGISTRY: Record<ZombieType, IZombieDefinition> = {
  normal: {
    radius: 12,
    baseHp: CONSTANTS.ZOMBIE_HP,
    baseSpeed: CONSTANTS.ZOMBIE_SPEED,
    orbCount: 1,
    orbColor: '#2196f3',
    orbValue: 1,
  },

  big: {
    radius: 30,
    baseHp: CONSTANTS.BIG_ZOMBIE_HP,
    baseSpeed: CONSTANTS.BIG_ZOMBIE_SPEED,
    orbCount: 4,
    orbColor: '#9c27b0',
    orbValue: 2,
    onObstacleCollide: (_self, obs) => {
      if (obs.type === 'sandbag') obs.takeDamage(0.5);
    },
  },

  slime: {
    radius: 16,
    baseHp: 10,
    baseSpeed: CONSTANTS.ZOMBIE_SPEED * 1.5,
    orbCount: 2,
    orbColor: '#4caf50',
    orbValue: 1,
    leavesTrail: true,
    splitOnDeath: slimeSplit,
  },

  slime_small: {
    radius: 10,
    baseHp: 3,
    baseSpeed: 2.7,
    orbCount: 1,
    orbColor: '#4caf50',
    orbValue: 1,
    leavesTrail: true,
  },

  spitter: {
    radius: 18,
    baseHp: 20,
    baseSpeed: CONSTANTS.ZOMBIE_SPEED * 0.6,
    orbCount: 2,
    orbColor: '#4caf50',
    orbValue: 1,
    updateBehavior: spitterBehavior,
  },

  butcher: {
    radius: 40,
    baseHp: 500,
    baseSpeed: 0.7,
    orbCount: 15,
    orbColor: '#f44336',
    orbValue: 8,
    immuneToKnockback: true,
    updateBehavior: butcherBehavior,
  },
};
