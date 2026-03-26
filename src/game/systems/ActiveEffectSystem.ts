// ── ActiveEffectSystem.ts ─────────────────────────────────────────────────────
// 處理場地殘留效果（龍捲風 / 岩漿標記）的更新、傷害 tick、爆炸
// 新增效果類型：在 switch 加 case，其他邏輯零修改
// ─────────────────────────────────────────────────────────────────────────────
import type { Game } from '../Game';
import type { ActiveEffect } from '../types';
import { audioManager } from '../AudioManager';
import { spawnZombieAt } from './SpawnSystem';

// 龍捲風吸引力強度（px/ms²），乘以 dt 後加到速度
// 設定偏保守：不大於 2 * 正常殭屍移速（~1.5 px/ms），讓碰撞系統自行解決重疊
const TORNADO_PULL = 0.012; // 邊緣最大值；距離越近越強

export function updateActiveEffects(game: Game, dt: number): void {
  for (const effect of game.activeEffects) {
    effect.lifetime -= dt;

    // ── lava_mark：跟蹤目標殭屍位置 ─────────────────────────────────────────
    if (effect.type === 'lava_mark' && effect.targetZombieId !== undefined) {
      const target = game.zombies.find(z => z.id === effect.targetZombieId);
      if (target) {
        effect.x = target.x;
        effect.y = target.y;
      }
    }

    // ── tornado：每幀吸引範圍內殭屍 ──────────────────────────────────────────
    if (effect.type === 'tornado') {
      for (const zombie of game.zombies) {
        const dx   = effect.x - zombie.x;
        const dy   = effect.y - zombie.y;
        const dist = Math.hypot(dx, dy);
        // 只吸引半徑內、且距離大於自身半徑（避免極近距離爆速）的殭屍
        const pullRange = effect.radius + zombie.radius; // 與傷害 tick 相同範圍
        if (dist > zombie.radius && dist < pullRange) {
          // 線性衰減：邊緣弱，近中心強；單幀速度增量上限 0.5px/ms
          const ratio  = 1 - dist / pullRange;
          const dv     = Math.min(TORNADO_PULL * ratio * dt, 0.5);
          zombie.vx += (dx / dist) * dv;
          zombie.vy += (dy / dist) * dv;
        }
      }
    }

    // ── 傷害 tick ─────────────────────────────────────────────────────────────
    effect.tickTimer -= dt;
    if (effect.tickTimer <= 0) {
      effect.tickTimer = effect.tickInterval;
      for (const zombie of game.zombies) {
        const dist = Math.hypot(zombie.x - effect.x, zombie.y - effect.y);
        if (dist < effect.radius + zombie.radius) {
          zombie.hp -= effect.damage;
          zombie.flashWhiteTimer = 80;
          if (zombie.hp <= 0 && !game.pendingSwordKills.has(zombie)) {
            const angle = Math.atan2(zombie.y - effect.y, zombie.x - effect.x);
            game.pendingSwordKills.set(zombie, { ownerId: effect.ownerId, level: effect.level, hitAngle: angle });
          }
        }
      }
    }

    // ── lava_mark 到期爆炸 ────────────────────────────────────────────────────
    if (effect.type === 'lava_mark' && effect.lifetime <= 0) {
      _explodeLava(game, effect);
    }
    
    // ── spawn_warning 到期生成殭屍 ──────────────────────────────────────────────
    if (effect.type === 'spawn_warning' && effect.lifetime <= 0) {
      if (effect.zombieType) {
        spawnZombieAt(game, effect.x, effect.y, effect.zombieType as any);
      }
    }
  }

  // 移除已結束的效果
  for (let i = game.activeEffects.length - 1; i >= 0; i--) {
    if (game.activeEffects[i].lifetime <= 0) {
      game.activeEffects.splice(i, 1);
    }
  }
}

function _explodeLava(game: Game, effect: ActiveEffect): void {
  const radius = effect.explodeRadius ?? 100;
  const maxDmg = effect.explodeDamage ?? 30;

  for (const zombie of game.zombies) {
    const dist = Math.hypot(zombie.x - effect.x, zombie.y - effect.y);
    if (dist < radius) {
      const ratio = 1 - dist / radius;
      zombie.hp -= maxDmg * ratio;
      zombie.flashWhiteTimer = 200;
      // 擊退
      const dx = zombie.x - effect.x;
      const dy = zombie.y - effect.y;
      const d = Math.hypot(dx, dy) || 1;
      zombie.vx += (dx / d) * 26 * ratio;
      zombie.vy += (dy / d) * 26 * ratio;
      if (zombie.hp <= 0 && !game.pendingSwordKills.has(zombie)) {
        const angle = Math.atan2(zombie.y - effect.y, zombie.x - effect.x);
        game.pendingSwordKills.set(zombie, { ownerId: effect.ownerId, level: effect.level, hitAngle: angle });
      }
    }
  }

  audioManager.playSlash(5);
  game.hitEffects.push({
    x: effect.x, y: effect.y,
    type: 'pixel_explosion',
    lifetime: 650, maxLifetime: 650,
    startTime: Date.now(),
    radius: Math.min((effect.explodeRadius ?? 100) * 0.5, 70),
  });
  game.shakeTimer = 200;
}
