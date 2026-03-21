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
    const t = Date.now() / 1000;

    // 互動範圍底光
    ctx.beginPath(); ctx.arc(npc.x, npc.y, npc.interactRadius, 0, TWO_PI);
    ctx.fillStyle = npc.color + '0d'; ctx.fill();

    // ── 各 NPC 獨立外觀 ────────────────────────────────────────────────────────
    ctx.save();
    ctx.translate(npc.x, npc.y);

    if (npc.id === 'portal') {
      // 傳送門：旋轉光環
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TWO_PI + t * 1.2;
        const r = 26 + Math.sin(t * 2 + i) * 3;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 4, 0, TWO_PI);
        ctx.fillStyle = i % 2 === 0 ? '#00e5ff' : '#7c3aed'; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, TWO_PI);
      ctx.fillStyle = '#0a0a1a';
      ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 20; ctx.fill(); ctx.shadowBlur = 0;
      // 中心符文
      ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#00e5ff'; ctx.fillText('🌀', 0, 1);

    } else if (npc.id === 'blacksmith') {
      // 鐵匠：方形身體 + 大錘
      ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = npc.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-18, -22, 36, 44, 6); ctx.fill(); ctx.stroke();
      // 圍裙
      ctx.fillStyle = '#8b4513';
      ctx.beginPath(); ctx.roundRect(-12, -4, 24, 24, 3); ctx.fill();
      // 臉
      ctx.fillStyle = '#c8a882';
      ctx.beginPath(); ctx.arc(0, -8, 12, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = '#5a3e28'; ctx.lineWidth = 1; ctx.stroke();
      // 鬍子
      ctx.fillStyle = '#555';
      ctx.beginPath(); ctx.arc(0, -3, 8, 0, Math.PI); ctx.fill();
      // 大錘（隨時間微微搖擺）
      ctx.save(); ctx.rotate(Math.sin(t * 1.5) * 0.15);
      ctx.fillStyle = '#9e9e9e'; ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(16, -26, 14, 10); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(21, -16, 4, 20); ctx.fill(); ctx.stroke();
      ctx.restore();

    } else if (npc.id === 'merchant') {
      // 商人：圓胖身體 + 金幣袋
      ctx.fillStyle = '#2d5016'; ctx.strokeStyle = npc.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 4, 20, 24, 0, 0, TWO_PI); ctx.fill(); ctx.stroke();
      // 臉
      ctx.fillStyle = '#f5cba7';
      ctx.beginPath(); ctx.arc(0, -14, 13, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = '#c0874a'; ctx.lineWidth = 1; ctx.stroke();
      // 帽子
      ctx.fillStyle = '#2d5016'; ctx.strokeStyle = npc.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(-16, -30, 32, 8); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(-9, -46, 18, 18); ctx.fill(); ctx.stroke();
      // 金幣袋（漂浮）
      const bagY = Math.sin(t * 2) * 3;
      ctx.fillStyle = '#f6d860'; ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(22, -10 + bagY, 10, 0, TWO_PI); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#7a5c00'; ctx.fillText('$', 22, -10 + bagY);

    } else if (npc.id === 'gacha') {
      // 抽獎機：方形機台
      ctx.fillStyle = '#1a0a2e'; ctx.strokeStyle = npc.color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(-22, -30, 44, 56, 6); ctx.fill(); ctx.stroke();
      // 螢幕
      ctx.fillStyle = '#0d0d2b';
      ctx.beginPath(); ctx.roundRect(-15, -24, 30, 22, 3); ctx.fill();
      // 螢幕閃爍彩色符號
      const symbols = ['⭐','💎','🎰','👑'];
      const sym = symbols[Math.floor(t * 3) % symbols.length];
      ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sym, 0, -13);
      // 拉桿
      ctx.fillStyle = '#c62828'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(22, -20, 6, 26); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(25, -20 + Math.sin(t * 3) * 8, 5, 0, TWO_PI); ctx.fill(); ctx.stroke();
      // 投幣口
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.roundRect(-8, 4, 16, 4, 2); ctx.fill();
      // 出獎口
      ctx.fillStyle = '#111'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(-14, 18, 28, 8, 3); ctx.fill(); ctx.stroke();

    } else if (npc.id === 'questboard') {
      // 任務板：石板
      ctx.fillStyle = '#37474f'; ctx.strokeStyle = npc.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-22, -34, 44, 58, 4); ctx.fill(); ctx.stroke();
      // 紙張貼條
      const lines = [[-14,-26,28,6], [-14,-16,20,6], [-14,-6,24,6], [-14,4,16,6]];
      lines.forEach(([x,y,w,h], i) => {
        ctx.fillStyle = i < 2 ? '#ffe082' : '#fff9c4';
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 2); ctx.fill();
      });
      // 打勾
      ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, -23); ctx.lineTo(-7, -20); ctx.lineTo(-2, -26); ctx.stroke();
      // 骷髏圖標
      ctx.font = '11px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💀', 10, -13);
    }

    ctx.restore();

    // NPC 名稱標籤
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = npc.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = npc.color; ctx.shadowBlur = 6;
    ctx.fillText(npc.label, npc.x, npc.y + 46);
    ctx.shadowBlur = 0;

    // ── 圓圈進度條 ────────────────────────────────────────────────────────────
    if (npc.progress > 0) {
      const r = 38;
      ctx.beginPath(); ctx.arc(npc.x, npc.y, r, -Math.PI / 2, -Math.PI / 2 + TWO_PI);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 6; ctx.stroke();

      ctx.beginPath();
      ctx.arc(npc.x, npc.y, r, -Math.PI / 2, -Math.PI / 2 + TWO_PI * npc.progress);
      ctx.strokeStyle = npc.color;
      ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.shadowColor = npc.color; ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0; ctx.lineCap = 'butt';

      // 秒數倒計時
      const remaining = ((1 - npc.progress) * npc.interactDuration / 1000).toFixed(1);
      ctx.font = 'bold 11px Arial';
      ctx.fillStyle = npc.color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${remaining}s`, npc.x, npc.y - 54);
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
