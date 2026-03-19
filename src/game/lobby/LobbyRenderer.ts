// ── LobbyRenderer.ts ──────────────────────────────────────────────────────────
// 大廳繪圖：地板、NPC、玩家、圓圈進度條
// ─────────────────────────────────────────────────────────────────────────────
import { LobbyScene } from './LobbyScene';

const TWO_PI = Math.PI * 2;

export function drawLobby(scene: LobbyScene, ctx: CanvasRenderingContext2D) {
  const W = scene.width;
  const H = scene.height;

  // ── 地板 ────────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  // 地磚格線
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // 中心裝飾圓
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 200, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 100, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.stroke();

  // ── NPC ──────────────────────────────────────────────────────────────────────
  for (const npc of scene.npcs) {
    // 互動範圍底光（半透明）
    ctx.beginPath(); ctx.arc(npc.x, npc.y, npc.interactRadius, 0, TWO_PI);
    ctx.fillStyle = `${npc.color}11`; ctx.fill();

    // NPC 身體（圓形）
    ctx.beginPath(); ctx.arc(npc.x, npc.y, 28, 0, TWO_PI);
    ctx.fillStyle = '#2a2a3e'; ctx.fill();
    ctx.strokeStyle = npc.color; ctx.lineWidth = 2.5; ctx.stroke();

    // NPC Emoji
    ctx.font = '22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(npc.emoji, npc.x, npc.y);

    // NPC 名稱
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = npc.color;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(npc.label, npc.x, npc.y + 44);

    // ── 圓圈進度條 ────────────────────────────────────────────────────────────
    if (npc.progress > 0) {
      const r = 36;
      // 底圈（灰）
      ctx.beginPath(); ctx.arc(npc.x, npc.y, r, -Math.PI / 2, -Math.PI / 2 + TWO_PI);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 5; ctx.stroke();
      // 進度弧（彩色）
      ctx.beginPath();
      ctx.arc(npc.x, npc.y, r, -Math.PI / 2, -Math.PI / 2 + TWO_PI * npc.progress);
      ctx.strokeStyle = npc.color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.shadowColor = npc.color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineCap = 'butt';

      // 進度百分比文字
      const pct = Math.round(npc.progress * 100);
      ctx.font = 'bold 10px Arial';
      ctx.fillStyle = npc.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pct}%`, npc.x, npc.y - 52);
    }
  }

  // ── 玩家 ─────────────────────────────────────────────────────────────────────
  const px = scene.playerX;
  const py = scene.playerY;
  const r  = scene.playerRadius;

  // 陰影
  ctx.beginPath(); ctx.arc(px + 3, py + 5, r, 0, TWO_PI);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();

  // 身體
  ctx.beginPath(); ctx.arc(px, py, r, 0, TWO_PI);
  ctx.fillStyle = scene.playerColor;
  ctx.shadowColor = scene.playerColor;
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

  // 名稱
  ctx.font = 'bold 11px Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('你', px, py - r - 6);
}
