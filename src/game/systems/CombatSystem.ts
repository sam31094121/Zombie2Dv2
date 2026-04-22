// ?�?�?CombatSystem.ts ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?
// ?��??��??�、玩家攻?�觸?�、�?礙物?�炸/?��?販賣機�?�?Game.ts ?�離�?// ?��??��??��??��???handleObstacleInteractions() ??case，Game.ts ?�修??// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?
import type { Game } from '../Game';
import { Player } from '../Player';
import { Obstacle } from '../map/Obstacle';
import { Item } from '../Item';
import { Projectile } from '../Projectile';
import { SwordProjectile } from '../entities/SwordProjectile';
import { MissileProjectile } from '../entities/MissileProjectile';
import { WEAPON_REGISTRY, getWeaponKey } from '../entities/definitions/WeaponDefinitions';
import { findNearestTombstoneTarget } from './TombstoneSystem';

type AutoTarget =
  | { kind: 'zombie'; x: number; y: number }
  | { kind: 'tombstone'; x: number; y: number; obstacle: Obstacle }
  | { kind: 'obstacle'; x: number; y: number; obstacle: Obstacle };

export function handleObstacleInteractions(game: Game, dt: number): void {
  const obstacleSet = new Set<Obstacle>();
  for (const player of game.players) {
    if (player.hp > 0) {
      const nearby = game.mapManager.getNearbyObstacles(player.x, player.y);
      nearby.forEach(obs => obstacleSet.add(obs));
    }
  }
  const allObstacles = Array.from(obstacleSet);

  for (const player of game.players) {
    if (player.hp <= 0) continue;
    player.isInsideContainer = false;
    player.isAtAltar = false;
  }
  for (const zombie of game.zombies) {
    zombie.isInsideContainer = false;
  }

  for (const obs of allObstacles) {
    obs.update(dt, game.players, (p) => {
      game.healVFX.push({
        x: (Math.random() - 0.5) * 15,
        y: 0,
        alpha: 1.0,
        startTime: Date.now(),
        ownerId: p.id,
      });
    });

    if (obs.isDestroyed && !obs.isTriggered) continue;

    if (obs.isTriggered && obs.triggerTimer > 0) {
      obs.triggerTimer -= dt;
      if (obs.triggerTimer <= 0) {
        if (obs.type === 'explosive_barrel') {
          explodeObstacle(game, obs);
        } else if (obs.type === 'vending_machine') {
          dropVendingMachineItems(game, obs);
        } else if (obs.type === 'tombstone') {
          game.score += 500;
          game.hitEffects.push({ x: obs.x + obs.width / 2, y: obs.y + obs.height / 2, type: 'purple_particles', lifetime: 500, maxLifetime: 500 });
        }
      }
    }

    // Sandbags: Destroyed by big zombies
    if (obs.type === 'sandbag' && !obs.isDestroyed) {
      for (const zombie of game.zombies) {
        if (zombie.type === 'big' && obs.collidesWithCircle(zombie.x, zombie.y, zombie.radius)) {
          obs.takeDamage(100);
          game.hitEffects.push({ x: obs.x, y: obs.y, type: 'grey_sparks', lifetime: 300, maxLifetime: 300 });
        }
      }
    }

    // Electric Fence — player and zombie use separate cooldown timers
    if (obs.type === 'electric_fence') {
      const now = Date.now();
      for (const player of game.players) {
        if (player.hp > 0 && obs.collidesWithCircle(player.x, player.y, player.radius)) {
          if (now - obs.lastPlayerEffectTime > 1000) {
            player.slowDebuffTimer = 500;
            obs.lastPlayerEffectTime = now;
            game.hitEffects.push({ x: player.x, y: player.y, type: 'green_electricity', lifetime: 250, maxLifetime: 250 });
          }
        }
      }
      for (const zombie of game.zombies) {
        if (obs.collidesWithCircle(zombie.x, zombie.y, zombie.radius)) {
          if (now - obs.lastEffectTime > 1000) {
            zombie.hp -= 5;
            zombie.paralysisTimer = 500;
            game.queueZombieDeath(zombie, null, 1);
            obs.lastEffectTime = now;
            game.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'green_electricity', lifetime: 300, maxLifetime: 300 });
          }
        }
      }
    }

    // Container: Transparency
    if (obs.type === 'container') {
      for (const player of game.players) {
        if (player.hp > 0 && obs.collidesWithCircle(player.x, player.y, player.radius)) {
          player.isInsideContainer = true;
        }
      }
      for (const zombie of game.zombies) {
        if (obs.collidesWithCircle(zombie.x, zombie.y, zombie.radius)) {
          zombie.isInsideContainer = true;
        }
      }
    }

    // Altar (Fire Totem): range-based, no collision — just set isAtAltar flag
    if (obs.type === 'altar' && !obs.isDestroyed) {
      const cx = obs.x + obs.width / 2;
      const cy = obs.y + obs.height / 2;
      const ALTAR_RANGE = 120;
      for (const player of game.players) {
        if (player.hp > 0 && Math.hypot(player.x - cx, player.y - cy) < ALTAR_RANGE) {
          player.isAtAltar = true;
        }
      }
    }

    if (obs.type === 'monolith' && !obs.isDestroyed) {
      _updateMonolithTurret(game, obs);
    }
  }
}

export function handlePlayerAttacks(game: Game, player: Player, dt: number = 16): void {
  const activeWeapons = player.isFloatingWeapons
    ? player.weapons
    : [{ id: 'main', type: player.weapon, level: player.weaponLevels[player.weapon] || 1, lastAttackTime: player.lastAttackTime, branch: player.weaponBranches[player.weapon] }];

  const now = Date.now();
  const dmgMult = player.damageMultiplier;

  // ?�系：只?��???1 ?�「主武器?��??��?（無?�模式�?
  // 競�??�模式�?許�?�???��?不�? _swordOut ?��?
  if (!player.isFloatingWeapons && player.weapon === 'sword' && (player as any)._swordOut) return;

  for (let i = 0; i < activeWeapons.length; i++) {
    const slot = activeWeapons[i];
    const wType = slot.type;
    const wLv = slot.level;
    const wBranch = (slot as any).branch || null;

    const wKey = getWeaponKey(wType, wLv, wBranch);
    const weaponDef = WEAPON_REGISTRY[wType]?.[wKey];
    if (!weaponDef) continue;

    const attackInterval = weaponDef.attackInterval / player.attackSpeedMultiplier;
    // 射�?：未設�???sword=150px, gun=300px
    const attackRange = weaponDef.attackRange ?? (wType === 'sword' ? 150 : 300);

    if (player.isFloatingWeapons) {
      // ?�?�?浮空武器：使?��? PlayerRenderer ?��??�固�?6 槽�?佈�? ?�?�?
      const SLOT_POSITIONS = [
        {  rx:  44, ry:   0 }, // 0: ?�中 (1)
        {  rx: -44, ry:   0 }, // 1: 左中 (2)
        {  rx: -44, ry: -26 }, // 2: 左�? (3)
        {  rx:  44, ry: -26 }, // 3: ?��? (4)
        {  rx: -44, ry:  26 }, // 4: 左�? (5)
        {  rx:  44, ry:  26 }, // 5: ?��? (6)
      ];
      const slotPos = SLOT_POSITIONS[i % SLOT_POSITIONS.length];
      const bob = Math.sin(now / 300 + i) * 6;
      const bx = player.x + slotPos.rx;
      const by = player.y + slotPos.ry + bob;

      // 1. Search for a nearby target and snap the weapon to it instantly.
      const aimTarget = findNearestAutoTarget(game, bx, by, 700);
      if (aimTarget) {
        const targetAngle = Math.atan2(aimTarget.y - by, aimTarget.x - bx);
        let aDiff = targetAngle - (slot.aimAngle ?? player.aimAngle);
        while (aDiff > Math.PI) aDiff -= Math.PI * 2;
        while (aDiff < -Math.PI) aDiff += Math.PI * 2;
        const maxRot = 8 * (dt / 1000);
        slot.aimAngle = Math.abs(aDiff) <= maxRot
          ? targetAngle
          : (slot.aimAngle ?? player.aimAngle) + Math.sign(aDiff) * maxRot;
      }

      // 2. Fire only when the target is inside the weapon's attack range.
      const inRange = aimTarget && Math.hypot(aimTarget.x - bx, aimTarget.y - by) <= attackRange;
      if (!inRange || now - slot.lastAttackTime <= attackInterval) continue;

      slot.lastAttackTime = now;
      const origin = { x: bx, y: by, aimAngle: slot.aimAngle ?? player.aimAngle };

      const fireOnce = () => {
        if (player.hp <= 0) return;
        if (weaponDef.fireDirect) {
          weaponDef.fireDirect(game, player, dmgMult, origin);
        } else {
          const specs = weaponDef.fire(player, dmgMult, origin);
          _dispatchSpecs(game, specs, player, dmgMult, origin, weaponDef.attackInterval);
        }
      };

      fireOnce();
      if (weaponDef.burstCount && weaponDef.burstCount > 1) {
        let fired = 1;
        const burstInterval = setInterval(() => {
          if (fired >= (weaponDef.burstCount ?? 1) || player.hp <= 0) { clearInterval(burstInterval); return; }
          fireOnce(); fired++;
        }, weaponDef.burstDelay ?? 150);
      }

    } else {
      // ?�?�?主武?��??�盡模�?）�?射�?檢查，在範�??��??�火 ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?
      if (now - slot.lastAttackTime <= attackInterval) continue;

      const nearest = findNearestAutoTarget(game, player.x, player.y, attackRange);
      if (!nearest) continue; // 射�??�無?�物，�??�火

      slot.lastAttackTime = now;
      if (!player.isFloatingWeapons) player.lastAttackTime = now;

      const fireOnce = () => {
        if (player.hp <= 0) return;
        if (weaponDef.fireDirect) {
          weaponDef.fireDirect(game, player, dmgMult, undefined);
        } else {
          const specs = weaponDef.fire(player, dmgMult, undefined);
          _dispatchSpecs(game, specs, player, dmgMult, undefined, weaponDef.attackInterval);
        }
      };

      fireOnce();
      if (weaponDef.burstCount && weaponDef.burstCount > 1) {
        let fired = 1;
        const burstInterval = setInterval(() => {
          if (fired >= (weaponDef.burstCount ?? 1) || player.hp <= 0) { clearInterval(burstInterval); return; }
          fireOnce(); fired++;
        }, weaponDef.burstDelay ?? 150);
      }
    }
  }
}

function _dispatchSpecs(
  game: Game, specs: import('../types').ProjectileSpec[], player: Player,
  dmgMult: number, origin: {x:number,y:number,aimAngle:number} | undefined,
  attackInterval: number,
): void {
  for (const s of specs) {
    if (s.type === 'slash') {
      game.swordProjectiles.push(new SwordProjectile({
        branch: 'base', level: s.level, ownerId: s.ownerId,
        x: s.x, y: s.y, angle: origin?.aimAngle ?? player.aimAngle, dmgMult,
        passRadius: 12, damage: Math.floor(s.damage / dmgMult),
        speed: 0.42, maxRange: 200, attackInterval,
        spinRadius: 0, spinDamage: 0, spinDuration: 0, spinTickMs: 0,
        embedDuration: 0, explodeDamage: 0, explodeRadius: 0,
      }));
    } else {
      game.projectiles.push(new Projectile(
        s.ownerId, s.x, s.y, s.vx, s.vy,
        s.damage, s.pierce, s.lifetime, s.type, s.radius, s.knockback, s.level, false,
        s.bulletType ?? 'blue_ellipse',
      ));
    }
  }
}

export function findNearestZombie(game: Game, x: number, y: number, maxDist: number) {
  let nearest = null;
  let minDist = maxDist;
  for (const zombie of game.zombies) {
    if (zombie.hp <= 0) continue;
    const dist = Math.hypot(zombie.x - x, zombie.y - y);
    if (dist < minDist) {
      minDist = dist;
      nearest = zombie;
    }
  }
  return nearest;
}

export function findNearestAutoTarget(game: Game, x: number, y: number, maxDist: number): AutoTarget | null {
  const zombie = findNearestZombie(game, x, y, maxDist);
  const zombieDist = zombie ? Math.hypot(zombie.x - x, zombie.y - y) : Infinity;
  const tombstone = findNearestTombstoneTarget(game, x, y, maxDist);
  const tombstoneDist = tombstone ? Math.hypot(tombstone.x - x, tombstone.y - y) : Infinity;

  // Also consider explosive_barrel and vending_machine as targetable
  let nearestObs: Obstacle | null = null;
  let nearestObsDist = Math.min(zombieDist, tombstoneDist);
  for (const chunkObs of game.mapManager.obstacles.values()) {
    for (const obs of chunkObs) {
      if (obs.isDestroyed) continue;
      if (obs.type !== 'explosive_barrel' && obs.type !== 'vending_machine' && obs.type !== 'monolith') continue;
      const d = Math.hypot((obs.x + obs.width / 2) - x, (obs.y + obs.height / 2) - y);
      if (d < maxDist && d < nearestObsDist) { nearestObsDist = d; nearestObs = obs; }
    }
  }

  if (nearestObs && nearestObsDist <= zombieDist && nearestObsDist <= tombstoneDist) {
    return { kind: 'obstacle', x: nearestObs.x + nearestObs.width / 2, y: nearestObs.y + nearestObs.height / 2, obstacle: nearestObs };
  }
  if (!zombie && !tombstone) return null;
  if (tombstoneDist < zombieDist && tombstone) {
    return { kind: 'tombstone', x: tombstone.x, y: tombstone.y, obstacle: tombstone.obstacle };
  }
  return zombie ? { kind: 'zombie', x: zombie.x, y: zombie.y } : null;
}

export function explodeObstacle(game: Game, obs: Obstacle): void {
  const explosionRadius = 150;
  const damage = 50;

  game.hitEffects.push({
    x: obs.x + obs.width / 2,
    y: obs.y + obs.height / 2,
    type: 'orange_explosion',
    lifetime: 400,
    startTime: Date.now(),
    maxLifetime: 400
  });

  for (const chunkObstacles of game.mapManager.obstacles.values()) {
    for (const otherObs of chunkObstacles) {
      if (otherObs.type === 'explosive_barrel' && !otherObs.isDestroyed && otherObs !== obs) {
        const dist = Math.hypot(
          otherObs.x + otherObs.width / 2 - (obs.x + obs.width / 2),
          otherObs.y + otherObs.height / 2 - (obs.y + obs.height / 2)
        );
        if (dist < explosionRadius) {
          otherObs.takeDamage(100);
        }
      }
    }
  }

  for (const player of game.players) {
    if (player.hp > 0) {
      const dist = Math.hypot(player.x - (obs.x + obs.width / 2), player.y - (obs.y + obs.height / 2));
      if (dist < explosionRadius) {
        player.takeDamage(damage * (1 - dist / explosionRadius));
      }
    }
  }
  for (const zombie of game.zombies) {
    const dist = Math.hypot(zombie.x - (obs.x + obs.width / 2), zombie.y - (obs.y + obs.height / 2));
    if (dist < explosionRadius) {
      zombie.hp -= damage * 2 * (1 - dist / explosionRadius);
      zombie.vx += (zombie.x - (obs.x + obs.width / 2)) / dist * 10;
      zombie.vy += (zombie.y - (obs.y + obs.height / 2)) / dist * 10;
      game.queueZombieDeath(zombie, null, 1);
    }
  }
  obs.isDestroyed = true;
  obs.isTriggered = false;
}

function _updateMonolithTurret(game: Game, obs: Obstacle): void {
  const cx = obs.x + obs.width / 2;
  const cy = obs.y + obs.height / 2;
  const target = findNearestZombie(game, cx, cy, 900);

  if (target) {
    obs.monolithTargetX = target.x;
    obs.monolithTargetY = target.y;
    obs.monolithFacingAngle = Math.atan2(target.y - cy, target.x - cx);
  }

  if (obs.monolithVolleyShotsRemaining <= 0 || obs.monolithShotCooldown > 0) return;

  const launchAngle = target
    ? Math.atan2(target.y - cy, target.x - cx)
    : obs.monolithFacingAngle;
  obs.monolithFacingAngle = launchAngle;

  const muzzleDistance = obs.width * 0.58;
  const muzzleX = cx + Math.cos(launchAngle) * muzzleDistance;
  const muzzleY = cy + Math.sin(launchAngle) * muzzleDistance;

  game.missiles.push(new MissileProjectile({
    ownerId: obs.monolithVolleyOwnerId || 1,
    x: muzzleX,
    y: muzzleY,
    angle: launchAngle + (Math.random() - 0.5) * 0.08,
    damage: 11,
    speed: 7.6,
    turnSpeed: 0.0048,
    radius: 10,
    isSmall: false,
    splitAfter: 0,
    groundFireRadius: 0,
    groundFireDuration: 0,
    pierceRemaining: 4,
    variant: 'energy',
    homingDelayMs: 170,
    obstacleGraceMs: 160,
    splashRadius: 86,
  }));

  obs.monolithVolleyShotsRemaining -= 1;
  obs.monolithShotCooldown = obs.monolithVolleyShotsRemaining > 0 ? 95 : 0;
  obs.monolithLaunchPulse = 160;
  game.shakeTimer = Math.max(game.shakeTimer, 70);

  game.hitEffects.push({ x: muzzleX, y: muzzleY, type: 'blue_circle', lifetime: 180, maxLifetime: 180 });
  game.hitEffects.push({ x: muzzleX, y: muzzleY, type: 'white_sparks', lifetime: 200, maxLifetime: 200 });
  for (let i = 0; i < 4; i++) {
    const sparkAngle = launchAngle + Math.PI + (Math.random() - 0.5) * 0.9;
    const sparkDist = 8 + Math.random() * 10;
    game.hitEffects.push({
      x: muzzleX + Math.cos(sparkAngle) * sparkDist,
      y: muzzleY + Math.sin(sparkAngle) * sparkDist,
      type: 'arc_spark',
      lifetime: 140,
      maxLifetime: 140,
      radius: 2 + Math.random(),
    });
  }
}

export function dropVendingMachineItems(game: Game, obs: Obstacle): void {
  const rand = Math.random();
  let type: import('../Item').ItemType = 'shield';
  if (rand < 0.4) type = 'shield';
  else if (rand < 0.8) type = 'speed';
  else type = 'magnet';

  game.items.push(new Item(obs.x + obs.width / 2, obs.y + obs.height / 2, type, 10000));

  obs.isDestroyed = true;
  obs.isTriggered = false;
}
