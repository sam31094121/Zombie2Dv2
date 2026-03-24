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

export function handlePlayerAttacks(game: Game, player: Player): void {
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

    if (now - slot.lastAttackTime > attackInterval) {
      slot.lastAttackTime = now;
      if (!player.isFloatingWeapons) player.lastAttackTime = now;

      const fireOnce = () => {
        if (player.hp <= 0) return;

        let origin: {x: number, y: number, aimAngle: number} | undefined = undefined;
        if (player.isFloatingWeapons) {
          const offsetAngle = (i / player.weapons.length) * Math.PI * 2;
          const bob = Math.sin(now / 300 + i) * 6; // 更大一點的呼吸感
          const bx = player.x + Math.cos(offsetAngle) * 38;
          const by = player.y + Math.sin(offsetAngle) * 38 + bob;
          
          let wAim = player.aimAngle;
          // 獨立索敵雷達：以武器自身為中心，尋找最近且存活的敵人 (雷達距離給大一點 600px)
          const nearest = findNearestZombie(game, bx, by, 600);
          if (nearest && nearest.hp > 0) {
            wAim = Math.atan2(nearest.y - by, nearest.x - bx);
          }
          slot.aimAngle = wAim;
          origin = { x: bx, y: by, aimAngle: wAim };
        }

        if (weaponDef.fireDirect) {
          // 直接操作 game（包含刀劍、A/B 分支武器）
          weaponDef.fireDirect(game, player, dmgMult, origin);
        } else {
          // 產生子彈規格
          const specs = weaponDef.fire(player, dmgMult, origin);
          for (const s of specs) {
            // 修正 Sword Level 5 回傳 ProjectileSpec 時被塞入普通子彈的問題
            if (s.type === 'slash') {
               // 建立模擬的 SwordConfig 塞回真實的 SwordProjectiles
               game.swordProjectiles.push(new SwordProjectile({
                 branch: 'base', level: s.level, ownerId: s.ownerId,
                 x: s.x, y: s.y, angle: origin?.aimAngle ?? player.aimAngle, dmgMult,
                 passRadius: 12, damage: Math.floor(s.damage / dmgMult),
                 speed: 0.42, maxRange: 200, attackInterval: weaponDef.attackInterval,
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
      };

      fireOnce();

      if (weaponDef.burstCount && weaponDef.burstCount > 1) {
        let fired = 1;
        const burstInterval = setInterval(() => {
          if (fired >= (weaponDef.burstCount ?? 1) || player.hp <= 0) {
            clearInterval(burstInterval); return;
          }
          fireOnce();
          fired++;
        }, weaponDef.burstDelay ?? 150);
      }
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
