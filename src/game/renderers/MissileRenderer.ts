// ── MissileRenderer.ts ────────────────────────────────────────────────────────
// 燃燒導彈像素藝術繪圖（3-frame 動畫）
// 座標系：pivot = 彈身中心，鼻頭朝 +X，尾焰朝 -X
// 原始設計 44×44，pivot 在 canvas(6,22)，此處以 ox=-15 將中心對齊 (0,0)
// ─────────────────────────────────────────────────────────────────────────────
import { MissileProjectile } from '../entities/MissileProjectile';

// 調色盤（與用戶設計一致）
const C = {
  base:       '#1a1c23',
  steelMid:   '#666a7a',
  steelLight: '#9ba0b5',
  warhead:    '#cc0000',
  fireWhite:  '#ffffff',
  fireYellow: '#ffcc00',
  fireOrange: '#ff6600',
  fireRed:    '#cc0000',
  ember:      '#450a0a',
};

export function drawMissiles(missiles: MissileProjectile[], ctx: CanvasRenderingContext2D): void {
  for (const m of missiles) {
    if (!m.alive) continue;
    _drawOne(m, ctx);
  }
}

function _drawOne(m: MissileProjectile, ctx: CanvasRenderingContext2D): void {
  const angle = Math.atan2(m.vy, m.vx);
  // 小導彈縮小 0.65×；大導彈正常
  const s = m.isSmall ? 0.65 : 1.0;
  // 3-frame 動畫（每幀 110ms，與原始設計一致）
  const f = Math.floor(Date.now() / 110) % 3;

  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  ctx.imageSmoothingEnabled = false;

  // ox = -15：將彈身中心對齊 (0,0)（原始設計中彈身從 x=0 延伸到 x=22，中心 ≈ 15）
  const ox = -15;
  const r = (x: number, y: number, w: number, h: number) =>
    ctx.fillRect(x + ox, y, w, h);

  // ── 1. 尾焰噴射（3 幀動畫）─────────────────────────────────────────────
  const spark = (x: number, y: number, sz: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + ox, y, sz, sz);
  };

  if (f === 0) {
    // 穩定噴射
    ctx.fillStyle = C.fireRed;    r(-12, -3, 10, 6);
    ctx.fillStyle = C.fireOrange; r(-8,  -2,  7, 4);
    ctx.fillStyle = C.fireWhite;  r(-2,  -1,  3, 2);
  } else if (f === 1) {
    // 劇烈噴發
    spark(-15, -4, 3, C.fireRed);
    spark(-12,  2, 2, C.fireOrange);
    spark(-8,  -1, 4, C.fireYellow);
    spark(-4,  -2, 4, C.fireWhite);
    spark(-5,  -6, 1, C.fireYellow);
    spark(-6,   5, 1, C.fireOrange);
  } else {
    // 殘煙與餘燼
    ctx.fillStyle = C.fireRed;  r(-18, -2, 12, 4);
    ctx.fillStyle = C.ember;    r(-22, -1,  4, 2);
    spark(-25, 1, 1, C.fireRed);
  }

  // ── 2. 彈身主體 ────────────────────────────────────────────────────────
  // 尾部結構（深黑）
  ctx.fillStyle = C.base;
  r(0, -3, 2, 6);

  // 彈身（金屬）
  ctx.fillStyle = C.steelMid;
  r(2, -3, 18, 6);
  // 高光（亮部）
  ctx.fillStyle = C.steelLight;
  r(2, -3, 18, 2);
  // 底部陰影
  ctx.fillStyle = C.base;
  r(2,  2, 18, 1);

  // ── 3. 彈頭 ────────────────────────────────────────────────────────────
  ctx.fillStyle = C.warhead;
  r(20, -3, 5, 6);

  // 尖頭三角形
  ctx.fillStyle = C.warhead;
  ctx.beginPath();
  ctx.moveTo(25 + ox, -3);
  ctx.lineTo(31 + ox,  0);
  ctx.lineTo(25 + ox,  3);
  ctx.closePath();
  ctx.fill();

  // ── 4. 尾翼 ────────────────────────────────────────────────────────────
  ctx.fillStyle = C.base;
  r(2, -6, 3, 3);   // 上翼
  r(2,  3, 3, 3);   // 下翼
  ctx.fillStyle = C.steelMid;
  r(3, -5, 1, 10);  // 翼片細節

  ctx.restore();
}
