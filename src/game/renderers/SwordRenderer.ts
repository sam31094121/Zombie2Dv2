// ── SwordRenderer.ts ─────────────────────────────────────────────────────────
// 劍系子彈的繪圖邏輯
// base  (Lv1-4): 飛旋小刀（Brotato 風）
// going_out / returning (A): 蛇形曲刀飛行
// spinning (A):  旋轉刀環
// embedded (B):  嵌入目標 + 爆炸預警圓
// ─────────────────────────────────────────────────────────────────────────────
import { SwordProjectile } from '../entities/SwordProjectile';

const TWO_PI = Math.PI * 2;

export function drawSwordProjectiles(
  swords: SwordProjectile[],
  ctx: CanvasRenderingContext2D,
): void {
  for (const sword of swords) {
    if (sword.isDone) continue;
    ctx.save();
    ctx.translate(sword.x, sword.y);

    if (sword.branch === 'base') {
      _drawBaseKnife(sword, ctx);
    } else if (sword.branch === 'B') {
      _drawStraightB(sword, ctx);   // 直線刺，不旋轉
    } else {
      switch (sword.state) {
        case 'going_out':
        case 'returning':
          _drawFlyingCurved(sword, ctx);
          break;
      }
    }

    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// base: 突刺刺刀（直線飛行，不旋轉）
// going_out：刀尖朝前飛出
// returning ：純動畫飛回，刀尖朝玩家方向（稍微半透明表示「沒有攻擊力」）
// ─────────────────────────────────────────────────────────────────────────────
function _drawBaseKnife(sword: SwordProjectile, ctx: CanvasRenderingContext2D): void {
  const { level } = sword;
  const isReturn = sword.state === 'returning';

  // 等級光暈
  const glowColors: Array<string | null> = [null, '#ffffff', '#b3e5fc', '#1565c0'];
  const blurSizes = [0, 7, 10, 14];
  const glow = glowColors[Math.min(level - 1, 3)];
  const blur = blurSizes[Math.min(level - 1, 3)];

  // 固定朝飛行方向，完全不旋轉（突刺感）
  ctx.rotate(sword.angle);

  // 回程半透明（表示沒有攻擊力）
  if (isReturn) ctx.globalAlpha = 0.6;

  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = blur; }

  // ── 刺刀刀身 ───────────────────────────────────────────────────────────────
  ctx.fillStyle = _rustColor(level);
  ctx.beginPath();
  ctx.moveTo(20, 0);        // 刀尖（前）
  ctx.lineTo(4, -3);        // 刀背上
  ctx.lineTo(-2, -4);       // 護手上
  ctx.lineTo(-2, -2);
  ctx.lineTo(-12, -2);      // 刀柄
  ctx.lineTo(-12, 2);
  ctx.lineTo(-2, 2);
  ctx.lineTo(-2, 4);        // 護手下
  ctx.lineTo(4, 3);         // 刀背下
  ctx.closePath();
  ctx.fill();

  // 刀身反光
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(5, -2);
  ctx.lineTo(3, -1);
  ctx.lineTo(15, 0);
  ctx.closePath();
  ctx.fill();

  // 刀柄紋路
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  for (let i = -10; i <= -4; i += 3) {
    ctx.beginPath(); ctx.moveTo(i, -2); ctx.lineTo(i, 2); ctx.stroke();
  }

  // 去程：速度拖尾（表示突刺動感）
  if (!isReturn) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = glow ?? '#aaaaaa';
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.ellipse(-i * 6, 0, 4 - i * 0.6, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.shadowBlur = 0;
  if (isReturn) ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── 共用 Shape 函式（手持 + 飛行都呼叫這裡，唯一外觀定義）────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/** Branch A 蛇形曲刀：純畫形狀，呼叫前需先 rotate 到正確方向 */
export function drawBranchAShape(
  ctx: CanvasRenderingContext2D,
  colors: { blade: string; glow: string; handle: string },
  blur: number,
): void {
  ctx.shadowColor = colors.glow; ctx.shadowBlur = blur;

  // 蛇形刀身（貝塞爾曲線）
  ctx.fillStyle = colors.blade;
  ctx.beginPath();
  ctx.moveTo(-6, -3);
  ctx.bezierCurveTo(4, -9, 18, 3, 28, -3);  // 上緣波浪
  ctx.lineTo(30, 0);                          // 刀尖
  ctx.bezierCurveTo(18, 6, 4, -1, -6, 4);   // 下緣波浪
  ctx.closePath();
  ctx.fill();

  // 刀身反光
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.moveTo(-2, -1); ctx.bezierCurveTo(6, -5, 16, 2, 26, -1);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // 刀柄
  ctx.fillStyle = colors.handle;
  ctx.beginPath(); ctx.rect(-14, -4, 10, 8); ctx.fill();
}

/** Branch B 判決劍：純畫形狀，呼叫前需先 rotate 到正確方向 */
export function drawBranchBShape(
  ctx: CanvasRenderingContext2D,
  colors: { blade: string; glow: string; handle: string },
  blur: number,
): void {
  ctx.shadowColor = colors.glow; ctx.shadowBlur = blur;

  // 刀身（直線刺刀形）
  ctx.fillStyle = colors.blade;
  ctx.beginPath();
  ctx.moveTo(30, 0);   // 刀尖（前）
  ctx.lineTo(8, -4); ctx.lineTo(-4, -5); ctx.lineTo(-4, -3);
  ctx.lineTo(-14, -3); ctx.lineTo(-14, 3);
  ctx.lineTo(-4, 3); ctx.lineTo(-4, 5); ctx.lineTo(8, 4);
  ctx.closePath(); ctx.fill();

  // 刀身反光
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(24, 0); ctx.lineTo(8, -2.5); ctx.lineTo(4, -2); ctx.lineTo(22, 0);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // 刀柄
  ctx.fillStyle = colors.handle;
  ctx.beginPath(); ctx.rect(-14, -5, 12, 10); ctx.fill();

  // 護手橫條
  ctx.fillStyle = colors.glow;
  ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.rect(-5, -7, 3, 14); ctx.fill();
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch A going_out / returning: 蛇形曲刀飛行
// ─────────────────────────────────────────────────────────────────────────────
function _drawFlyingCurved(sword: SwordProjectile, ctx: CanvasRenderingContext2D): void {
  const colors = getBranchColors(sword.branch as 'A' | 'B', sword.level);
  const isReturn = sword.state === 'returning';

  ctx.rotate(sword.angle + (isReturn ? Math.PI : 0) + sword.visualAngle * 4);
  drawBranchAShape(ctx, colors, 10 + sword.level * 2);

  // 飛行拖尾
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = colors.glow;
  for (let i = 1; i <= 3; i++) {
    const off = i * 7;
    ctx.beginPath();
    ctx.arc(-Math.cos(sword.angle) * off, -Math.sin(sword.angle) * off, 3.5 - i * 0.8, 0, TWO_PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch B: 直線刺（同鐵劍，但用審判流配色）
// ─────────────────────────────────────────────────────────────────────────────
function _drawStraightB(sword: SwordProjectile, ctx: CanvasRenderingContext2D): void {
  const colors = getBranchColors('B', sword.level);
  const isReturn = sword.state === 'returning';

  ctx.rotate(sword.angle);
  if (isReturn) ctx.globalAlpha = 0.65;

  drawBranchBShape(ctx, colors, 10 + sword.level * 2);

  ctx.globalAlpha = isReturn ? 0.65 : 1;

  // 飛行拖尾
  ctx.globalAlpha = (isReturn ? 0.65 : 1) * 0.3;
  ctx.fillStyle = colors.glow;
  for (let i = 1; i <= 3; i++) {
    const off = i * 7;
    ctx.beginPath();
    ctx.arc(-Math.cos(sword.angle) * off, -Math.sin(sword.angle) * off, 3.5 - i * 0.8, 0, TWO_PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// 顏色輔助
// ─────────────────────────────────────────────────────────────────────────────

export function getBranchColors(branch: 'A' | 'B', level: number): { glow: string; blade: string; handle: string } {
  if (branch === 'A') {
    const blades = ['#b3e5fc', '#80d8ff', '#e0f7fa', '#ffffff'];
    return { glow: '#00e5ff', blade: blades[Math.min(level - 5, 3)], handle: '#006064' };
  } else {
    const blades = ['#fff9c4', '#ffe082', '#ffca28', '#ff8f00'];
    return { glow: '#ffea00', blade: blades[Math.min(level - 5, 3)], handle: '#4a148c' };
  }
}

// Lv1=鏽棕 Lv2=鐵灰 Lv3=銀色 Lv4=深銀
function _rustColor(level: number): string {
  return ['#8d5524', '#9e9e9e', '#cfd8dc', '#78909c'][Math.min(level - 1, 3)];
}
