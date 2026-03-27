import { Game } from '../Game';
import { Zombie } from '../Zombie';
import { ArcProjectile } from '../entities/ArcProjectile';

export class ArcSystem {
  static triggerArc(
    game: Game,
    startX: number,
    startY: number,
    maxJumps: number,
    damage: number,
    paralyzeDuration: number,
    ownerId: number,
    level: number,
    searchRadius: number = 300,
    ignoreZombieIds: Set<number> = new Set(),
  ) {
    if (maxJumps <= 0) return;

    let nearest: Zombie | null = null;
    let minDist = Infinity;

    for (const z of game.zombies) {
      if (z.hp <= 0) continue;
      if (ignoreZombieIds.has(z.id)) continue;

      const dist = Math.hypot(z.x - startX, z.y - startY);
      if (dist < searchRadius && dist < minDist) {
        minDist = dist;
        nearest = z;
      }
    }

    if (!nearest) return;

    nearest.paralysisTimer = Math.max(nearest.paralysisTimer, paralyzeDuration);
    nearest.hp -= damage;
    nearest.lastDamageTime.set(ownerId, Date.now());
    ignoreZombieIds.add(nearest.id);

    game.hitEffects.push({
      type: 'arc_lightning',
      x: startX,
      y: startY,
      targetX: nearest.x,
      targetY: nearest.y,
      lifetime: 300,
      maxLifetime: 300,
    });

    if (nearest.hp <= 0) {
      const angle = Math.atan2(nearest.y - startY, nearest.x - startX);
      game.queueZombieDeath(nearest, ownerId, level, angle);
    }

    const queue = ((game as any)._pendingArcs = (game as any)._pendingArcs || []);
    queue.push({
      x: nearest.x,
      y: nearest.y,
      maxJumps: maxJumps - 1,
      damage,
      paralyzeDuration,
      ownerId,
      level,
      searchRadius,
      ignoreZombieIds,
      delayTimer: 80,
    });
  }

  static updateArcs(arcs: ArcProjectile[], game: Game, dt: number) {
    const arcQueue = (game as any)._pendingArcs as any[] | undefined;
    if (arcQueue) {
      for (let i = arcQueue.length - 1; i >= 0; i--) {
        const pending = arcQueue[i];
        pending.delayTimer -= dt;
        if (pending.delayTimer <= 0) {
          arcQueue.splice(i, 1);
          ArcSystem.triggerArc(
            game,
            pending.x,
            pending.y,
            pending.maxJumps,
            pending.damage,
            pending.paralyzeDuration,
            pending.ownerId,
            pending.level,
            pending.searchRadius,
            pending.ignoreZombieIds,
          );
        }
      }
    }

    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];

      if (arc.isEmbedded && arc.embeddedTarget) {
        if (arc.embeddedTarget.hp <= 0) {
          arc.embedTimer = arc.maxEmbedTime;
        } else {
          arc.x = arc.embeddedTarget.x;
          arc.y = arc.embeddedTarget.y;
        }

        if (Math.random() < 0.6) {
          game.hitEffects.push({
            x: arc.x + (Math.random() - 0.5) * 40,
            y: arc.y + (Math.random() - 0.5) * 40,
            type: 'arc_spark',
            lifetime: 100,
            maxLifetime: 100,
            radius: 2 + Math.random() * 2,
          });
        }

        arc.embedTimer += dt;
        if (arc.embedTimer >= arc.maxEmbedTime) {
          if (!arc.hasTriggeredArc) {
            arc.hasTriggeredArc = true;
            ArcSystem.triggerArc(
              game,
              arc.x,
              arc.y,
              arc.maxJumps,
              arc.damage,
              arc.paralyzeDuration,
              arc.ownerId,
              arc.level,
              350,
            );
          }
          arc.lifetime = 0;
        }
      } else {
        arc.x += arc.vx * (dt / 16);
        arc.y += arc.vy * (dt / 16);

        const obstacles = game.mapManager.getNearbyObstacles(arc.x, arc.y);
        let hitWall = false;
        for (const obs of obstacles) {
          if (obs.collidesWithCircle(arc.x, arc.y, arc.radius)) {
            hitWall = true;
            break;
          }
        }

        if (hitWall) {
          arc.lifetime = 0;
        } else {
          for (const z of game.zombies) {
            if (z.hp <= 0) continue;

            const dist = Math.hypot(arc.x - z.x, arc.y - z.y);
            if (dist < arc.radius + z.radius + game.lagCompensationRadius + 15) {
              arc.isEmbedded = true;
              arc.embeddedTarget = z;
              arc.vx = 0;
              arc.vy = 0;
              arc.embedTimer = 0;
              arc.lifetime = Math.max(arc.lifetime, arc.maxEmbedTime);

              if (!arc.hasTriggeredArc) {
                arc.hasTriggeredArc = true;
                ArcSystem.triggerArc(
                  game,
                  z.x,
                  z.y,
                  arc.maxJumps,
                  arc.damage,
                  arc.paralyzeDuration,
                  arc.ownerId,
                  arc.level,
                  350,
                );
              }

              break;
            }
          }
        }
      }

      arc.lifetime -= dt;
      if (arc.lifetime <= 0) {
        arcs.splice(i, 1);
      }
    }
  }
}
