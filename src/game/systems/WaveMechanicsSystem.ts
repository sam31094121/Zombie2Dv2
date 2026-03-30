// ── WaveMechanicsSystem.ts ────────────────────────────────────────────────────
// 波次機制與濾鏡繪圖（從 Game.ts 分離）
// ─────────────────────────────────────────────────────────────────────────────
import type { Game } from '../Game';
import { drawHealVFX } from '../renderers/EffectRenderer';

// 目前無波次特殊機制（舊有雲層、閃電、毒霧、裂縫等已移除）
export function applyWaveMechanisms(_game: Game, _dt: number): void {
  // 預留位置：未來可在此加入新機制
}

export function drawWaveFilters(game: Game, ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // 已經移除干擾的 setTransform(1,0,0,1,0,0) - 現已能正確繼承 2x 縮放與攝影機矩陣
  drawHealVFX(game.healVFX, ctx, game.players);
  ctx.restore();
}
