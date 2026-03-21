// ── ActiveEffectSystem.ts ─────────────────────────────────────────────────────
// 處理場地殘留效果（龍捲風 / 岩漿標記）的更新、傷害 tick、爆炸
// 新增效果類型：在 switch 加 case，其他邏輯零修改
// ─────────────────────────────────────────────────────────────────────────────
import type { Game } from '../Game';
import type { ActiveEffect } from '../types';
import { audioManager } from '../AudioManager';

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
            game.pendingSwordKills.set(zombie, { ownerId: effect.ownerId, level: effect.level });
          }
        }
      }
    }

    // ── lava_mark 到期爆炸 ────────────────────────────────────────────────────
    if (effect.type === 'lava_mark' && effect.lifetime <= 0) {
      _explodeLava(game, effect);
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
        game.pendingSwordKills.set(zombie, { ownerId: effect.ownerId, level: effect.level });
      }
    }
  }

  audioManager.playSlash(5);
  game.hitEffects.push({ x: effect.x, y: effect.y, type: 'orange_explosion', lifetime: 600, maxLifetime: 600 });
  game.shakeTimer = 200;
}
