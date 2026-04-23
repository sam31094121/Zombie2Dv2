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
  readonly weight: number;
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
const SPITTER_MIN_RANGE = 200;
const SPITTER_MAX_RANGE = 300;
const SPITTER_SHOT_COOLDOWN_MS = 2500;
const SPITTER_AIM_MS = 360;
const SPITTER_REPOSITION_MIN_MS = 800;
const SPITTER_REPOSITION_MAX_MS = 1500;
const SPITTER_REPOSITION_SPEED_MULTIPLIER = 1.25;
const SPITTER_BLOCKED_URGENCY_MS = 4000;

function hasLineOfSight(self: Zombie, target: Player, obstacles: Obstacle[]): boolean {
  for (const obs of obstacles) {
    if (obs.isLineBlocked(self.x, self.y, target.x, target.y)) return false;
  }
  return true;
}

function moveSpitter(self: Zombie, dx: number, dy: number, dt: number, speedMultiplier = 1): void {
  const len = Math.hypot(dx, dy);
  if (len <= 0.0001) return;

  self.x += (dx / len) * self.speed * speedMultiplier * (dt / 16);
  self.y += (dy / len) * self.speed * speedMultiplier * (dt / 16);
}

function chooseSpitterReposition(self: Zombie, toPlayerX: number, toPlayerY: number, nearestDist: number): void {
  const len = Math.hypot(toPlayerX, toPlayerY);
  if (len <= 0.0001) return;

  const towardX = toPlayerX / len;
  const towardY = toPlayerY / len;
  const side = Math.random() < 0.5 ? -1 : 1;
  const strafeX = -towardY * side;
  const strafeY = towardX * side;
  const rangeBias = nearestDist > SPITTER_MAX_RANGE
    ? 0.28
    : nearestDist < SPITTER_MIN_RANGE
      ? -0.35
      : (Math.random() - 0.5) * 0.18;

  const jitterAngle = Math.random() * Math.PI * 2;
  const moveX = strafeX * (0.9 + Math.random() * 0.35) + towardX * rangeBias + Math.cos(jitterAngle) * 0.12;
  const moveY = strafeY * (0.9 + Math.random() * 0.35) + towardY * rangeBias + Math.sin(jitterAngle) * 0.12;
  const moveLen = Math.hypot(moveX, moveY);
  if (moveLen <= 0.0001) return;

  self.extraState.set('spitterRepositionDX', moveX / moveLen);
  self.extraState.set('spitterRepositionDY', moveY / moveLen);
  self.extraState.set(
    'spitterRepositionUntil',
    self.time + SPITTER_REPOSITION_MIN_MS + Math.random() * (SPITTER_REPOSITION_MAX_MS - SPITTER_REPOSITION_MIN_MS),
  );
}

function clearSpitterReposition(self: Zombie): void {
  self.extraState.delete('spitterBlockedSince');
  self.extraState.delete('spitterRepositionDX');
  self.extraState.delete('spitterRepositionDY');
  self.extraState.delete('spitterRepositionUntil');
}

function spitterBehavior(self: Zombie, ctx: ZombieBehaviorCtx): void {
  const { dt, nearest, nearestDist, obstacles, projectiles } = ctx;
  if (!nearest) { self.isCloseToPlayer = false; return; }

  const dx = nearest.x - self.x;
  const dy = nearest.y - self.y;
  if (nearestDist <= 0.0001) { self.isCloseToPlayer = true; return; }

  self.angle = Math.atan2(dy, dx);

  if (!hasLineOfSight(self, nearest, obstacles)) {
    const blockedSince = (self.extraState.get('spitterBlockedSince') as number | undefined) ?? self.time;
    const repositionUntil = (self.extraState.get('spitterRepositionUntil') as number | undefined) ?? 0;
    let repositionDX = (self.extraState.get('spitterRepositionDX') as number | undefined) ?? 0;
    let repositionDY = (self.extraState.get('spitterRepositionDY') as number | undefined) ?? 0;

    self.extraState.set('spitterBlockedSince', blockedSince);
    self.extraState.delete('spitterAimUntil');

    if (self.time >= repositionUntil || Math.hypot(repositionDX, repositionDY) <= 0.0001) {
      chooseSpitterReposition(self, dx, dy, nearestDist);
      repositionDX = (self.extraState.get('spitterRepositionDX') as number | undefined) ?? 0;
      repositionDY = (self.extraState.get('spitterRepositionDY') as number | undefined) ?? 0;
    }

    const blockedDuration = self.time - blockedSince;
    const urgency = blockedDuration > SPITTER_BLOCKED_URGENCY_MS ? 0.35 : 0;
    moveSpitter(
      self,
      repositionDX + (dx / nearestDist) * urgency,
      repositionDY + (dy / nearestDist) * urgency,
      dt,
      SPITTER_REPOSITION_SPEED_MULTIPLIER,
    );
    self.isCloseToPlayer = nearestDist < self.radius + 50;
    return;
  }

  clearSpitterReposition(self);

  if (nearestDist < SPITTER_MIN_RANGE) {
    // ?剛? ???綽??
    moveSpitter(self, -dx, -dy, dt);
  } else if (nearestDist > SPITTER_MAX_RANGE) {
    // ?剛? ???蹎?
    moveSpitter(self, dx, dy, dt);
  }

  if (!hasLineOfSight(self, nearest, obstacles)) {
    self.extraState.delete('spitterAimUntil');
    self.isCloseToPlayer = nearestDist < self.radius + 50;
    return;
  }

  if (self.time - self.lastSpitTime > SPITTER_SHOT_COOLDOWN_MS) {
    const aimUntil = (self.extraState.get('spitterAimUntil') as number | undefined) ?? 0;
    if (aimUntil <= 0) {
      self.extraState.set('spitterAimUntil', self.time + SPITTER_AIM_MS);
      self.isCloseToPlayer = nearestDist < self.radius + 50;
      return;
    }

    if (self.time < aimUntil) {
      self.isCloseToPlayer = nearestDist < self.radius + 50;
      return;
    }

    self.lastSpitTime = self.time;
    self.extraState.delete('spitterAimUntil');
    const shotDX = nearest.x - self.x;
    const shotDY = nearest.y - self.y;
    const angle = Math.atan2(shotDY, shotDX);
    projectiles.push(new Projectile(
      -1, self.x, self.y,
      Math.cos(angle) * 5, Math.sin(angle) * 5,
      10, 1, 3000, 'zombie_spit', 12, true, 1, true,
    ));
  } else {
    self.extraState.delete('spitterAimUntil');
  }

  self.isCloseToPlayer = nearestDist < self.radius + 50;
}

/*
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
*/
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
    weight: 1,
    knockbackResistLevel: 1,   // 璅?撠迎?撟曆??⊿??
  },

  big: {
    radius: 30,
    baseHp: CONSTANTS.BIG_ZOMBIE_HP,
    baseSpeed: CONSTANTS.BIG_ZOMBIE_SPEED,
    orbCount: 4,
    orbColor: '#9c27b0',
    orbValue: 2,
    weight: 6,
    knockbackResistLevel: 6,   // 憭批?嚗葉撘琿???芾◤??40%嚗?
    onObstacleCollide: (_self, obs) => {
      if (obs.type === 'sandbag') obs.takeDamage(0.5);
    },
  },

  slime: {
    radius: 16,
    baseHp: 10,
    baseSpeed: CONSTANTS.ZOMBIE_SPEED * 1.2,
    orbCount: 2,
    orbColor: '#4caf50',
    orbValue: 1,
    weight: 2,
    knockbackResistLevel: 1,   // ??normal
    leavesTrail: true,
    splitOnDeath: slimeSplit,
  },

  slime_small: {
    radius: 10,
    baseHp: 3,
    baseSpeed: 1.95,
    orbCount: 1,
    orbColor: '#4caf50',
    orbValue: 1,
    weight: 1,
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
    weight: 3,
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
    weight: 2,
    knockbackResistLevel: 1,
  },

  butcher: {
    radius: 40,
    baseHp: 50,
    baseSpeed: 0.7,
    orbCount: 15,
    orbColor: '#f44336',
    orbValue: 8,
    weight: 500,
    knockbackResistLevel: 7,   // ??嚗撥?餃?嚗鋡急 30%嚗?
    updateBehavior: butcherBehavior,
  },
};
