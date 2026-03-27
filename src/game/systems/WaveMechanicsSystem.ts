// ── WaveMechanicsSystem.ts ────────────────────────────────────────────────────
// 波次機制（地震、閃電）與濾鏡繪圖（從 Game.ts 分離）
// 新增波次機制：在此加 case，Game.ts 零修改
// ─────────────────────────────────────────────────────────────────────────────
import type { Game } from '../Game';
import { CONSTANTS } from '../Constants';
import { drawHealVFX } from '../renderers/EffectRenderer';

export function applyWaveMechanisms(game: Game, dt: number): void {
  const wave = game.waveManager.currentWave;
  const isInfinite = game.waveManager.isInfinite;
  const mechanics = game.waveManager.activeMechanics;


  // Lightning (W9 or Infinite)
  if (wave === 9 || (isInfinite && mechanics.includes('lightning'))) {
    if (Math.random() < 0.005) {
      const lx = game.camera.x + Math.random() * CONSTANTS.CANVAS_WIDTH;
      const ly = game.camera.y + Math.random() * CONSTANTS.CANVAS_HEIGHT;
      game.hitEffects.push({ x: lx, y: ly, type: 'lightning', lifetime: 500, maxLifetime: 500 });

      const stunRadius = 150;
      for (const player of game.players) {
        if (Math.hypot(player.x - lx, player.y - ly) < stunRadius) {
          player.slowDebuffTimer = 2000;
        }
      }
      for (const zombie of game.zombies) {
        if (Math.hypot(zombie.x - lx, zombie.y - ly) < stunRadius) {
          zombie.vx = 0; zombie.vy = 0;
        }
      }
    }
  }
}

export function drawWaveFilters(game: Game, ctx: CanvasRenderingContext2D): void {
  const wave = game.waveManager.currentWave;
  const isInfinite = game.waveManager.isInfinite;
  const mechanics = game.waveManager.activeMechanics;
  const introTimer = game.waveManager.waveIntroTimer;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to screen space

  if (introTimer > 0) {
    const progress = introTimer / 3000;
    drawIntroEffect(ctx, wave, isInfinite, progress);

    // Toxic Fog (Green)
    if (wave === 6 || (isInfinite && mechanics.includes('toxic_fog'))) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
      ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
    }

    // Red Filter (Attack Boost / Blood Flow)
    if (wave === 7 || (isInfinite && mechanics.includes('attack_boost'))) {
      const time = Date.now() / 1000;
      const alpha = 0.2 + Math.sin(time * 2) * 0.03;
      ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
      ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
      ctx.strokeStyle = `rgba(150, 0, 0, ${alpha * 2})`;
      ctx.lineWidth = 40;
      ctx.strokeRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
    }

    // Yellow Filter (Lightning / Flicker)
    if (wave === 3 || wave === 9 || (isInfinite && mechanics.includes('lightning'))) {
      const alpha = wave === 3 ? 0.04 : (Math.random() < 0.1 ? 0.15 : 0.06);
      ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
      if (wave === 3) {
        ctx.strokeStyle = `rgba(255, 255, 0, ${alpha * 5})`;
        ctx.lineWidth = 20;
        ctx.strokeRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
      } else {
        ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
      }
    }

  }

  drawHealVFX(game.healVFX, ctx);

  ctx.restore();
}

function drawCloudShadow(ctx: CanvasRenderingContext2D, progress: number, color = 'rgba(0, 0, 0, 0.3)'): void {
  ctx.fillStyle = color.replace('0.3', (progress * 0.3).toString());
  for (let i = 0; i < 5; i++) {
    const x = (Date.now() / 5 + i * 300) % (CONSTANTS.CANVAS_WIDTH * 2) - CONSTANTS.CANVAS_WIDTH;
    ctx.beginPath();
    ctx.ellipse(x, CONSTANTS.CANVAS_HEIGHT / 2, 500, 300, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawIntroEffect(ctx: CanvasRenderingContext2D, wave: number, isInfinite: boolean, progress: number): void {
  if (isInfinite) {
    ctx.fillStyle = `rgba(0, 0, 0, ${progress})`;
    ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
    return;
  }
  switch (wave) {
    case 1:
      ctx.fillStyle = `rgba(255, 255, 255, ${progress * 0.5})`;
      ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
      break;
    case 2: drawCloudShadow(ctx, progress); break;
    case 3: drawCloudShadow(ctx, progress, 'rgba(0, 100, 0, 0.3)'); break;
    case 4: drawCloudShadow(ctx, progress); break;
    case 5: drawCloudShadow(ctx, progress); break;
    case 6: drawCloudShadow(ctx, progress, 'rgba(0, 100, 0, 0.5)'); break;
    case 7: drawCloudShadow(ctx, progress, 'rgba(150, 0, 0, 0.5)'); break;
    case 8:
      drawCloudShadow(ctx, progress);
      ctx.fillStyle = `rgba(0, 0, 0, ${progress * 0.4})`;
      ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
      break;
    case 9:
      ctx.fillStyle = `rgba(0, 0, 0, ${progress * 0.7})`;
      ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
      if (Math.random() < 0.2) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(Math.random() * CONSTANTS.CANVAS_WIDTH, 0);
        ctx.lineTo(Math.random() * CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
        ctx.stroke();
      }
      break;
  }
}
