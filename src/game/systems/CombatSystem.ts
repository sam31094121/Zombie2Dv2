// ── CombatSystem.ts ───────────────────────────────────────────────────────────
// 障礙物互動、玩家攻擊觸發、障礙物爆炸/自動販賣機（從 Game.ts 分離）
// 新增障礙物互動：在 handleObstacleInteractions() 加 case，Game.ts 零修改
// ─────────────────────────────────────────────────────────────────────────────
import type { Game } from '../Game';
import { Player } from '../Player';
import { Obstacle } from '../map/Obstacle';
import { Item } from '../Item';
import { Projectile } from '../Projectile';
import { SwordProjectile } from '../entities/SwordProjectile';
import { WEAPON_REGISTRY, getWeaponKey } from '../entities/definitions/WeaponDefinitions';

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
        x: p.x + (Math.random() - 0.5) * 15,
        y: p.y - 30,
        alpha: 1.0,
        startTime: Date.now()
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

    // Electric Fence
    if (obs.type === 'electric_fence') {
      const now = Date.now();
      for (const player of game.players) {
        if (player.hp > 0 && obs.collidesWithCircle(player.x, player.y, player.radius)) {
          if (now - obs.lastEffectTime > 1000) {
            player.slowDebuffTimer = 500;
            obs.lastEffectTime = now;
          }
        }
      }
      for (const zombie of game.zombies) {
        if (obs.collidesWithCircle(zombie.x, zombie.y, zombie.radius)) {
          if (now - obs.lastEffectTime > 1000) {
            zombie.hp -= 5;
            zombie.paralysisTimer = 500;
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

    // Altar
    if (obs.type === 'altar' && game.waveManager.currentWave >= 7) {
      for (const player of game.players) {
        if (player.hp > 0 && obs.collidesWithCircle(player.x, player.y, player.radius)) {
          player.isAtAltar = true;
        }
      }
    }
  }
}

export function handlePlayerAttacks(game: Game, player: Player, dt: number = 16): void {
  const activeWeapons = player.isFloatingWeapons
    ? player.weapons
    : [{ id: 'main', type: player.weapon, level: player.weaponLevels[player.weapon] || 1, lastAttackTime: player.lastAttackTime, branch: player.weaponBranches[player.weapon] }];

  const now = Date.now();
  const dmgMult = player.damageMultiplier * (player.isAtAltar ? 1.4 : 1);

  // 劍系：只有裝備 1 把「主武器」時阻擋（無盡模式）
  // 競技場模式允許劍氣齊發，不受 _swordOut 阻擋
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
    // 射程：未設定時 sword=150px, gun=300px
    const attackRange = weaponDef.attackRange ?? (wType === 'sword' ? 150 : 300);

    if (player.isFloatingWeapons) {
      // ── 浮空武器：每幀平滑旋轉瞄準最近怪物，進入射程才開火 ──────────────
      const offsetAngle = (i / player.weapons.length) * Math.PI * 2;
      const bob = Math.sin(now / 300 + i) * 6;
      const bx = player.x + Math.cos(offsetAngle) * 38;
      const by = player.y + Math.sin(offsetAngle) * 38 + bob;

      // 1. 瞄準（大雷達範圍 700px，無距離限制，始終旋轉朝向最近怪物）
      const aimTarget = findNearestZombie(game, bx, by, 700);
      if (aimTarget) {
        const targetAngle = Math.atan2(aimTarget.y - by, aimTarget.x - bx);
        let aDiff = targetAngle - (slot.aimAngle ?? player.aimAngle);
        while (aDiff > Math.PI) aDiff -= Math.PI * 2;
        while (aDiff < -Math.PI) aDiff += Math.PI * 2;
        const maxRot = 3.5 * (dt / 1000); // 3.5 rad/s 平滑旋轉
        slot.aimAngle = Math.abs(aDiff) <= maxRot
          ? targetAngle
          : (slot.aimAngle ?? player.aimAngle) + Math.sign(aDiff) * maxRot;
      }

      // 2. 射程檢查：只有怪物進入 attackRange 才開火
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
      // ── 主武器（無盡模式）：射程檢查，在範圍內才開火 ──────────────────────
      if (now - slot.lastAttackTime <= attackInterval) continue;

      const nearest = findNearestZombie(game, player.x, player.y, attackRange);
      if (!nearest) continue; // 射程內無怪物，不開火

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
        player.hp -= damage * (1 - dist / explosionRadius);
        player.lastDamageTime = Date.now();
      }
    }
  }
  for (const zombie of game.zombies) {
    const dist = Math.hypot(zombie.x - (obs.x + obs.width / 2), zombie.y - (obs.y + obs.height / 2));
    if (dist < explosionRadius) {
      zombie.hp -= damage * 2 * (1 - dist / explosionRadius);
      zombie.vx += (zombie.x - (obs.x + obs.width / 2)) / dist * 10;
      zombie.vy += (zombie.y - (obs.y + obs.height / 2)) / dist * 10;
    }
  }
  obs.isDestroyed = true;
  obs.isTriggered = false;
}

export function dropVendingMachineItems(game: Game, obs: Obstacle): void {
  const type = Math.random() > 0.5 ? 'shield' : 'speed';
  game.items.push(new Item(obs.x + obs.width / 2, obs.y + obs.height / 2, type, 10000));

  for (const zombie of game.zombies) {
    const dist = Math.hypot(zombie.x - obs.x, zombie.y - obs.y);
    if (dist < 1000) {
      zombie.vx += ((obs.x + obs.width / 2) - zombie.x) / dist * 15;
      zombie.vy += ((obs.y + obs.height / 2) - zombie.y) / dist * 15;
    }
  }
  obs.isDestroyed = true;
  obs.isTriggered = false;
}
