// ?? ZombieDefinitions.ts ????????????????????????????????????????????????????
// 畾剖???駁?銵剁?Registry Pattern / Open-Closed Principle嚗?
//
// ?啣?畾剖??孵?嚗?
//   1. ??types.ts ??ZombieType ??啣??亙?
//   2. ??ZOMBIE_REGISTRY ????entry嚗?舫????Hook嚗?
//   3. ??ZombieRenderer.ts ???? draw case
//   ??Zombie.ts / Game.ts 銝駁?頛舫靽格
// ????????????????????????????????????????????????????????????????????????????
import { ZombieType } from '../../types';
import { CONSTANTS } from '../../Constants';
import { Projectile } from '../../Projectile';
import type { Player } from '../../Player';
import type { Obstacle } from '../../map/Obstacle';
import type { Zombie } from '../../Zombie';

// ?? ??甇颱滿閬嚗lime ??2 slime_small嚗????????????????????????????????????
export interface ZombieSpawnSpec {
  type: ZombieType;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// ?? 銵 Hook ??銝?? ????????????????????????????????????????????????????
export interface ZombieBehaviorCtx {
  dt: number;
  nearest: Player | null;
  nearestDist: number;
  players: Player[];
  obstacles: Obstacle[];
  projectiles: Projectile[];
  slimeTrails: { x: number; y: number; radius: number; lifetime: number; maxLifetime: number }[];
  debugHpLocked?: boolean;
}

// ?? 畾剖?摰儔隞 ?????????????????????????????????????????????????????????????
export interface IZombieDefinition {
  readonly radius: number;
  readonly baseHp: number;
  readonly baseSpeed: number;
  // XP ?
  readonly orbCount: number;
  readonly orbColor: string;
  readonly orbValue: number;
  // ??餃?蝑? 0~10嚗?=?⊿??/ 10=摰?嚗底閬?KNOCKBACK_SPEC.md
  readonly knockbackResistLevel?: number;
  /** @deprecated 隢??knockbackResistLevel: 10 */
  readonly immuneToKnockback?: boolean;
  readonly leavesTrail?: boolean;        // 蝘餃???暺雯??slime 憿?
  // 銵 Hook嚗身摰?摰?誨?身?蕭??餈摰嗚?頛?
  readonly updateBehavior?: (self: Zombie, ctx: ZombieBehaviorCtx) => void;
  // ???拍１??Hook嚗閫??蝣唳???恬?
  readonly onObstacleCollide?: (self: Zombie, obs: Obstacle) => void;
  // 甇颱滿??憭???slime ??嚗?
  readonly splitOnDeath?: (x: number, y: number) => ZombieSpawnSpec[];
}

// ????????????????????????????????????????????????????????????????????????????
// ?? 銵?賢? ????????????????????????????????????????????????????????????????
// ????????????????????????????????????????????????????????????????????????????

// ?? Spitter嚗?????+ ?豢雯敶??????????????????????????????????????????????
function spitterBehavior(self: Zombie, ctx: ZombieBehaviorCtx): void {
  const { dt, nearest, nearestDist, obstacles, projectiles } = ctx;
  if (!nearest) { self.isCloseToPlayer = false; return; }

  const dx = nearest.x - self.x;
  const dy = nearest.y - self.y;

  if (nearestDist < 200) {
    // 憭芾? ??敺
    self.x -= (dx / nearestDist) * self.speed * (dt / 16);
    self.y -= (dy / nearestDist) * self.speed * (dt / 16);
  } else if (nearestDist > 300) {
    // 憭芷? ????
    self.angle = Math.atan2(dy, dx);
    self.x += (dx / nearestDist) * self.speed * (dt / 16);
    self.y += (dy / nearestDist) * self.speed * (dt / 16);
  }

  if (nearestDist > 0) self.angle = Math.atan2(dy, dx);

  // 閬??文?
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

// ?? slime ???賢? ???????????????????????????????????????????????????????????
function slimeSplit(x: number, y: number): ZombieSpawnSpec[] {
  const angle1 = Math.random() * Math.PI * 2;
  const angle2 = angle1 + Math.PI;
  return [
    { type: 'slime_small', x: x + Math.cos(angle1) * 3, y: y + Math.sin(angle1) * 3, vx: Math.cos(angle1) * 16, vy: Math.sin(angle1) * 16 },
    { type: 'slime_small', x: x + Math.cos(angle2) * 3, y: y + Math.sin(angle2) * 3, vx: Math.cos(angle2) * 16, vy: Math.sin(angle2) * 16 },
  ];
}

// ?? 撅井撌函嚗???+ ?澆 + ? ??????????????????????????????????????????
// extraState ??
//   phase:       'walk'|'pre_charge'|'charging'|'slam_windup'|'slamming'|'recovery'
//   phaseEnd:    self.time when to exit current phase
//   slamCDEnd:   self.time when slam is available
//   chargeCDEnd: self.time when charge is available
//   chargeDX/DY: normalized charge direction (locked)
//   slamRadius:  shockwave ring radius (renderer animation)
function butcherBehavior(self: Zombie, ctx: ZombieBehaviorCtx): void {
  const { dt, nearest, nearestDist, players, debugHpLocked } = ctx;

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

      // ?芸??岫?澆嚗?頝嚗?
      if (nearestDist < 180 && now >= slamCDEnd) {
        self.extraState.set('phase', 'slam_windup');
        self.extraState.set('phaseEnd', now + 500);
        self.extraState.set('slamCDEnd', now + 7000);
        break;
      }
      // ?岫銵?嚗葉頝嚗?
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
      // 蝺拇蝘餃?
      if (nearestDist > 0) {
        self.angle = Math.atan2(dy, dx);
        self.x += (dx / nearestDist) * self.speed * (dt / 16);
        self.y += (dy / nearestDist) * self.speed * (dt / 16);
      }
      self.isCloseToPlayer = nearestDist < self.radius + 50;
      break;
    }

    case 'pre_charge': {
      // 餈質馱??嚗?敺?300ms ???孵?嚗?
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
            if (!debugHpLocked && p.takeDamage(40)) {
              p.x += chargeDX * 35;
              p.y += chargeDY * 35;
              self.lastDamageTime.set(p.id, now);
            }
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
            if (!debugHpLocked) p.takeDamage(50);
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

// ????????????????????????????????????????????????????????????????????????????
// ?? 畾剖??駁?銵?????????????????????????????????????????????????????????????????
// ????????????????????????????????????????????????????????????????????????????
export const ZOMBIE_REGISTRY: Record<ZombieType, IZombieDefinition> = {
  normal: {
    radius: 12,
    baseHp: CONSTANTS.ZOMBIE_HP,
    baseSpeed: CONSTANTS.ZOMBIE_SPEED,
    orbCount: 1,
    orbColor: '#2196f3',
    orbValue: 1,
    knockbackResistLevel: 1,   // 璅?撠迎?撟曆??⊿??
  },

  big: {
    radius: 30,
    baseHp: CONSTANTS.BIG_ZOMBIE_HP,
    baseSpeed: CONSTANTS.BIG_ZOMBIE_SPEED,
    orbCount: 4,
    orbColor: '#9c27b0',
    orbValue: 2,
    knockbackResistLevel: 6,   // 憭批?嚗葉撘琿???芾◤??40%嚗?
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
    knockbackResistLevel: 1,   // ??normal
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
    knockbackResistLevel: 0,   // ?頛?摰?⊿??
    leavesTrail: true,
  },

  spitter: {
    radius: 18,
    baseHp: 20,
    baseSpeed: CONSTANTS.ZOMBIE_SPEED * 0.6,
    orbCount: 2,
    orbColor: '#4caf50',
    orbValue: 1,
    knockbackResistLevel: 1,   // ??normal
    updateBehavior: spitterBehavior,
  },

  ghost: {
    radius: 14,
    baseHp: 3,
    baseSpeed: CONSTANTS.ZOMBIE_SPEED * 1.18,
    orbCount: 2,
    orbColor: '#c4b5fd',
    orbValue: 1,
    knockbackResistLevel: 1,
  },

  butcher: {
    radius: 40,
    baseHp: 50,
    baseSpeed: 0.7,
    orbCount: 15,
    orbColor: '#f44336',
    orbValue: 8,
    knockbackResistLevel: 7,   // ??嚗撥?餃?嚗鋡急 30%嚗?
    updateBehavior: butcherBehavior,
  },
};

