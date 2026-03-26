import { Game } from '../Game';
import { Zombie } from '../Zombie';
import { ArcProjectile } from '../entities/ArcProjectile';

export class ArcSystem {
  /**
   * 獨立的電弧連鎖特效模組 (Arc Effect Module)
   * 允許任何來源呼叫，尋找並連鎖攻擊範圍內的敵人
   */
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
    ignoreZombieIds: Set<number> = new Set()
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

    if (nearest) {
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
        maxLifetime: 300
      });

      if (nearest.hp <= 0) {
        const angle = Math.atan2(nearest.y - startY, nearest.x - startX);
        game.pendingSwordKills.set(nearest, { ownerId, level, hitAngle: angle });
      }

      // 將後續的連鎖跳躍排入佇列，給予一點時間差 (80ms)
      // 這樣不僅視覺上有「傳導」的動態感，最重要的是讓遊戲主迴圈有時間
      // 在下幾幀處理怪物的「死亡、史萊姆分裂等」生命週期，
      // 以免同步瞬間算完導致分裂出來的怪物被閃電跳過。
      const queue = (game as any)._pendingArcs = (game as any)._pendingArcs || [];
      queue.push({
        x: nearest.x, y: nearest.y,
        maxJumps: maxJumps - 1,
        damage, paralyzeDuration, ownerId, level, searchRadius,
        ignoreZombieIds,
        delayTimer: 80
      });
    }
  }

  /**
   * 更新所有飛行中的電弧彈 (ArcProjectile) 與延遲跳躍
   */
  static updateArcs(arcs: ArcProjectile[], game: Game, dt: number) {
    // 處理延遲跳躍的電弧
    const arcQueue = (game as any)._pendingArcs as any[] | undefined;
    if (arcQueue) {
      for (let i = arcQueue.length - 1; i >= 0; i--) {
        const p = arcQueue[i];
        p.delayTimer -= dt;
        if (p.delayTimer <= 0) {
          arcQueue.splice(i, 1);
          ArcSystem.triggerArc(
            game, p.x, p.y, p.maxJumps, p.damage, p.paralyzeDuration,
            p.ownerId, p.level, p.searchRadius, p.ignoreZombieIds
          );
        }
      }
    }

    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      
      if (arc.isEmbedded && arc.embeddedTarget) {
        if (arc.embeddedTarget.hp <= 0) {
          // 目標提早死亡，立即引爆
          arc.embedTimer = arc.maxEmbedTime;
        } else {
          arc.x = arc.embeddedTarget.x;
          arc.y = arc.embeddedTarget.y;
        }
        
        // 播放高頻「電弧火花」動畫
        if (Math.random() < 0.6) {
          game.hitEffects.push({
            x: arc.x + (Math.random() - 0.5) * 40,
            y: arc.y + (Math.random() - 0.5) * 40,
            type: 'arc_spark',
            lifetime: 100,
            maxLifetime: 100,
            radius: 2 + Math.random() * 2
          });
        }

        arc.embedTimer += dt;
        if (arc.embedTimer >= arc.maxEmbedTime && !arc.hasTriggeredArc) {
          arc.hasTriggeredArc = true;
          arc.lifetime = 0;
          
          ArcSystem.triggerArc(
            game,
            arc.x,
            arc.y,
            arc.maxJumps,
            arc.damage,
            arc.paralyzeDuration,
            arc.ownerId,
            arc.level,
            350 // search radius
          );
        }
      } else {
        // 飛行邏輯
        arc.x += arc.vx * (dt / 16);
        arc.y += arc.vy * (dt / 16);

        // 撞牆判定
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
          // 命中判定
          for (const z of game.zombies) {
            if (z.hp <= 0) continue;
            const dist = Math.hypot(arc.x - z.x, arc.y - z.y);
            if (dist < arc.radius + z.radius + game.lagCompensationRadius + 15) {
              arc.isEmbedded = true;
              arc.embeddedTarget = z;
              arc.vx = 0;
              arc.vy = 0;
              break; // 僅附著第一隻
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
