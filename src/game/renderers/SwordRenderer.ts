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
      ctx.rotate(sword.angle);
      if (sword.state === 'returning') ctx.globalAlpha = 0.6;
      if (sword.level === 1)      drawWoodenStakeShape(ctx);
      else if (sword.level === 2) drawRustyDirkShape(ctx);
      else if (sword.level === 3) drawSoldierDirkShape(ctx);
      else                        drawBlackSteelKatanaShape(ctx);
      ctx.globalAlpha = 1;
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

  // 固定朝飛行方向，完全不旋轉（突刺感）
  ctx.rotate(sword.angle);

  // 回程半透明（表示沒有攻擊力）
  if (isReturn) ctx.globalAlpha = 0.6;

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
    ctx.fillStyle = '#aaaaaa';
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.ellipse(-i * 6, 0, 4 - i * 0.6, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (isReturn) ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── 共用 Shape 函式（手持 + 飛行都呼叫這裡，唯一外觀定義）────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/** Branch A 二叉匕首（Custom Grip）：從 SVG 44×44 轉換，90° CCW，刀尖朝右（+x）
 *  上下兩刃對稱分叉＋閃電紋＋淺色止滑握柄，全長約 40px（x:-22 ~ x:18） */
export function drawBranchAShape(
  ctx: CanvasRenderingContext2D,
  _colors: { blade: string; glow: string; handle: string },
): void {
  ctx.scale(1.4, 1.35); // 56×19px
  // ── 上方刃部（黑鋼）──
  ctx.fillStyle = '#18181B';
  ctx.beginPath();
  ctx.moveTo(18, -5);
  ctx.lineTo(14, -2);
  ctx.lineTo(-4, -2);
  ctx.lineTo(-4, -5);
  ctx.closePath();
  ctx.fill();

  // 上刃口銀邊
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(-4, -6, 22, 1);

  // ── 下方刃部（對稱）──
  ctx.fillStyle = '#18181B';
  ctx.beginPath();
  ctx.moveTo(18,  5);
  ctx.lineTo(14,  2);
  ctx.lineTo(-4,  2);
  ctx.lineTo(-4,  5);
  ctx.closePath();
  ctx.fill();

  // 下刃口銀邊
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(-4, 5, 22, 1);

  // ── 閃電紋路（上刃）──
  ctx.strokeStyle = 'rgba(56,189,248,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(15, -4);
  ctx.lineTo(13, -3);
  ctx.lineTo(10, -4);
  ctx.lineTo( 6, -3);
  ctx.lineTo( 1, -4);
  ctx.stroke();

  // ── 閃電紋路（下刃）──
  ctx.beginPath();
  ctx.moveTo(15, 4);
  ctx.lineTo(13, 3);
  ctx.lineTo(10, 4);
  ctx.lineTo( 6, 3);
  ctx.lineTo( 1, 4);
  ctx.stroke();

  // ── 連接基座 ──
  ctx.fillStyle = '#09090B';
  ctx.fillRect(-6, -5, 2, 10);

  // ── 護手（深灰）──
  ctx.fillStyle = '#3F3F46';
  ctx.fillRect(-8, -7, 2, 14);

  // ── 握柄（淺灰複合材料）──
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(-19, -2, 11, 4);

  // 止滑紋路（三條橫槽）
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, -2); ctx.lineTo(-10, 2);
  ctx.moveTo(-13, -2); ctx.lineTo(-13, 2);
  ctx.moveTo(-16, -2); ctx.lineTo(-16, 2);
  ctx.stroke();

  // ── 柄尾配重（深藍黑）──
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(-22, -3, 3, 6);
}

/** Branch B 月牙彎刀：從 SVG 44×44 轉換，90° CCW，刀尖朝右（+x）
 *  全長約 40px（x:-22 ~ x:18），琥珀刃口＋深綠握柄＋鎖鏈尾 */
export function drawBranchBShape(
  ctx: CanvasRenderingContext2D,
  _colors: { blade: string; glow: string; handle: string },
): void {
  ctx.scale(1.35, 1.2); // 54×23px
  // ── 刀身外框（深黑）──
  ctx.fillStyle = '#09090B';
  ctx.beginPath();
  ctx.moveTo(18, -3);
  ctx.bezierCurveTo(18, -1, 14,  6,  8, 10);
  ctx.bezierCurveTo( 2, 13, -4, 12, -7,  9);
  ctx.lineTo(-7, -3);
  ctx.lineTo(18, -3);
  ctx.closePath();
  ctx.fill();

  // ── 刀身內色（次暗）──
  ctx.fillStyle = '#1A1A1E';
  ctx.beginPath();
  ctx.moveTo(17, -2);
  ctx.bezierCurveTo(17,  0, 13,  5,  8,  8);
  ctx.bezierCurveTo( 3, 11, -3, 10, -6,  8);
  ctx.lineTo(-6, -2);
  ctx.lineTo(17, -2);
  ctx.closePath();
  ctx.fill();

  // ── 圓孔缺口 ──
  ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.arc(4, 6, 2.2, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = '#050506';
  ctx.beginPath(); ctx.arc(4, 6, 1.5, 0, TWO_PI); ctx.fill();

  // ── 琥珀刃口（外層深琥珀）──
  ctx.fillStyle = '#B45309';
  ctx.beginPath();
  ctx.moveTo(-7, 9);
  ctx.bezierCurveTo(-4, 12,  2, 13,  8, 10);
  ctx.bezierCurveTo(12,  8, 17,  2, 18, -3);
  ctx.lineTo(16, -3);
  ctx.bezierCurveTo(15,  0, 11,  6,  6,  8);
  ctx.bezierCurveTo( 1, 10, -4,  9, -6,  7);
  ctx.lineTo(-7, 9);
  ctx.closePath();
  ctx.fill();

  // ── 琥珀刃口（亮面金琥珀）──
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.moveTo(-6, 8);
  ctx.bezierCurveTo(-3, 10,  2, 11,  7,  9);
  ctx.bezierCurveTo(10,  7, 14,  3, 15, -2);
  ctx.lineTo(14, -2);
  ctx.bezierCurveTo(13,  1, 10,  5,  5,  7);
  ctx.bezierCurveTo( 0,  8, -3,  7, -5,  6);
  ctx.lineTo(-6, 8);
  ctx.closePath();
  ctx.fill();

  // ── 護手（金色細條）──
  ctx.fillStyle = '#CA8A04';
  ctx.fillRect(-8, -6, 2, 8);

  // ── 握柄（深綠纏帶）──
  ctx.fillStyle = '#064E3B';
  ctx.fillRect(-16, -4, 8, 4);

  // 纏帶刻線
  ctx.strokeStyle = '#065F46';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, -4); ctx.lineTo(-10, 0);
  ctx.moveTo(-13, -4); ctx.lineTo(-13, 0);
  ctx.stroke();

  // ── 鎖鏈尾（三節）──
  ctx.strokeStyle = '#EAB308';
  ctx.lineWidth = 1;
  ctx.strokeRect(-19, -3, 3, 2);
  ctx.strokeRect(-21, -1, 3, 2);
  ctx.strokeRect(-22, -4, 3, 2);

  // 鎖鏈反光點
  ctx.fillStyle = '#FEF3C7';
  ctx.beginPath(); ctx.arc(-18.5, -2.5, 0.4, 0, TWO_PI); ctx.fill();
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch A going_out / returning: 蛇形曲刀飛行
// ─────────────────────────────────────────────────────────────────────────────
function _drawFlyingCurved(sword: SwordProjectile, ctx: CanvasRenderingContext2D): void {
  const colors = getBranchColors(sword.branch as 'A' | 'B', sword.level);
  const isReturn = sword.state === 'returning';

  ctx.rotate(sword.angle + (isReturn ? Math.PI : 0) + sword.visualAngle * 4);
  drawBranchAShape(ctx, colors);

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

  ctx.rotate(sword.angle + (isReturn ? Math.PI : 0));

  drawBranchBShape(ctx, colors);

  // 飛行拖尾
  ctx.globalAlpha = 0.3;
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

// ─────────────────────────────────────────────────────────────────────────────
// 黑鋼日輪刀（Black Steel Katana）── Lv4，從 SVG 44×44 轉換，90° CCW
// 日本刀微弧刃 + 銀色刃紋 + 菱格紋柄，全長約 40px（x:-22 ~ x:18）
// ─────────────────────────────────────────────────────────────────────────────
export function drawBlackSteelKatanaShape(ctx: CanvasRenderingContext2D): void {
  ctx.scale(1.5, 1.5); // uniform — 60px，保持圓形 Tsuba 與曲線比例

  // ── 刀身基底（Sori 弧度，深黑鋼）──
  ctx.strokeStyle = '#09090B';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.bezierCurveTo(-6, 0, 7, 0, 18, 4);
  ctx.stroke();

  // ── 鏡面刃口（極亮銀線）──
  ctx.strokeStyle = '#F8FAFC';
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(-6, -0.5);
  ctx.bezierCurveTo(-6, -0.5, 7, -0.5, 18, 3.5);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── 銀色斜斬紋（Hamon）──
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo( 0, 0); ctx.lineTo( 2, 2);
  ctx.moveTo( 6, 1); ctx.lineTo( 8, 3);
  ctx.moveTo(12, 2); ctx.lineTo(14, 4);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── 裝飾性刀鍔（Tsuba）圓形 ──
  ctx.fillStyle = '#18181B';
  ctx.beginPath(); ctx.arc(-6, 0, 3.5, 0, TWO_PI); ctx.fill();
  ctx.strokeStyle = '#3F3F46'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(-6, 0, 3.5, 0, TWO_PI); ctx.stroke();
  ctx.fillStyle = '#71717A';
  ctx.beginPath(); ctx.arc(-6, 0, 1.5, 0, TWO_PI); ctx.fill();

  // ── 菱格紋柄（Tsuka）──
  ctx.fillStyle = '#09090B';
  ctx.fillRect(-20, -1.5, 12, 3);
  ctx.fillStyle = '#3F3F46';
  for (const cx of [-11, -15, -19]) {
    ctx.beginPath();
    ctx.moveTo(cx,      -1.5);
    ctx.lineTo(cx + 1.5, 0);
    ctx.lineTo(cx,       1.5);
    ctx.lineTo(cx - 1.5, 0);
    ctx.closePath();
    ctx.fill();
  }

  // ── 柄頭（Kashira）──
  ctx.fillStyle = '#18181B';
  ctx.fillRect(-22, -2, 2, 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// 精鋼短劍（Soldier Dirk）── Lv3，從 SVG 44×44 轉換，90° CCW
// 5 層金屬刀面（亮面→中軸→陰影）+ 皮革握柄 + 配重柄尾，全長約 42px
// ─────────────────────────────────────────────────────────────────────────────
export function drawSoldierDirkShape(ctx: CanvasRenderingContext2D): void {
  ctx.scale(1.55, 2.0); // 60×10px — 軍用短劍
  // ── 最左側斜角（外緣）──
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.moveTo(14, -3); ctx.lineTo(15, -2);
  ctx.lineTo(-5, -2); ctx.lineTo(-5, -3);
  ctx.closePath(); ctx.fill();

  // ── 左側主刃面 ──
  ctx.fillStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.moveTo(17, -2); ctx.lineTo(18, -1);
  ctx.lineTo(-5, -1); ctx.lineTo(-5, -2);
  ctx.closePath(); ctx.fill();

  // ── 極亮中軸線 ──
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.moveTo(19, -1); ctx.lineTo(18, 0);
  ctx.lineTo(-5,  0); ctx.lineTo(-5, -1);
  ctx.closePath(); ctx.fill();

  // ── 右側陰影面 ──
  ctx.fillStyle = '#64748B';
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(17, 1);
  ctx.lineTo(-5, 1); ctx.lineTo(-5, 0);
  ctx.closePath(); ctx.fill();

  // ── 最右側深色邊緣 ──
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(15, 1); ctx.lineTo(14, 2);
  ctx.lineTo(-5, 2); ctx.lineTo(-5, 1);
  ctx.closePath(); ctx.fill();

  // ── 刀身微節點高光 ──
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(10, -1, 2, 1);
  ctx.fillRect( 2, -1, 2, 1);

  // ── 護手基底 ──
  ctx.fillStyle = '#475569'; ctx.fillRect(-7, -6, 2, 11);
  ctx.fillStyle = '#94A3B8'; ctx.fillRect(-5, -4, 1,  7); // 上緣隆起
  ctx.fillStyle = '#F1F5F9'; ctx.fillRect(-7, -1, 2,  1); // 中心裝飾點
  ctx.fillStyle = 'rgba(30,41,59,0.4)'; ctx.fillRect(-7, -6, 1, 11); // 下緣陰影

  // ── 皮革握柄 ──
  ctx.fillStyle = '#451A03'; ctx.fillRect(-17, -2, 10, 3);
  ctx.fillStyle = 'rgba(39,23,9,0.6)';
  ctx.fillRect( -9, -2, 1, 3);
  ctx.fillRect(-12, -2, 1, 3);
  ctx.fillRect(-15, -2, 1, 3);
  ctx.fillStyle = 'rgba(120,53,15,0.3)'; ctx.fillRect(-17, -2, 10, 1); // 側邊受光

  // ── 配重柄尾 ──
  ctx.fillStyle = '#94A3B8'; ctx.fillRect(-19, -3, 2, 5);
  ctx.fillStyle = '#475569'; ctx.fillRect(-20, -2, 1, 3);
  ctx.fillStyle = 'rgba(241,245,249,0.5)'; ctx.fillRect(-18, -1, 1, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 生鏽鐵刃（Rusty Pitted Dirk）── Lv2，從 SVG 44×44 轉換，90° CCW
// 雙刃不對稱缺角＋腐蝕鏽斑，全長約 42px（x:-21 ~ x:18）
// ─────────────────────────────────────────────────────────────────────────────
export function drawRustyDirkShape(ctx: CanvasRenderingContext2D): void {
  ctx.scale(1.4, 1.8); // 55×9px — 殘破匕首
  // ── 左刃（不對稱缺角）──
  ctx.fillStyle = '#64748B';
  ctx.beginPath();
  ctx.moveTo(17, -2); ctx.lineTo(17, -1); ctx.lineTo(13, -1);
  ctx.lineTo(12, -2); ctx.lineTo(10, -2); ctx.lineTo( 9, -1);
  ctx.lineTo(-5, -1); ctx.lineTo(-5, -2); ctx.lineTo(10, -2);
  ctx.lineTo(11, -3); ctx.lineTo(12, -3); ctx.lineTo(12, -2);
  ctx.closePath(); ctx.fill();

  // ── 右刃（鋸齒崩裂）──
  ctx.fillStyle = '#64748B';
  ctx.beginPath();
  ctx.moveTo(17,  1); ctx.lineTo(17,  2); ctx.lineTo( 8,  2);
  ctx.lineTo( 7,  1); ctx.lineTo( 5,  1); ctx.lineTo( 4,  2);
  ctx.lineTo( 0,  2); ctx.lineTo(-1,  1); ctx.lineTo(-5,  1);
  ctx.lineTo( 0,  1); ctx.lineTo( 1,  0); ctx.lineTo( 3,  0);
  ctx.lineTo( 4,  1); ctx.lineTo( 8,  1); ctx.lineTo( 9,  0);
  ctx.lineTo(17,  0);
  ctx.closePath(); ctx.fill();

  // ── 刀身中軸陰影 ──
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(18, -1); ctx.lineTo(18,  1); ctx.lineTo( 8,  1);
  ctx.lineTo( 7,  0); ctx.lineTo(-5,  0); ctx.lineTo(-5, -1);
  ctx.closePath(); ctx.fill();

  // ── 鏽斑：頂端 ──
  ctx.fillStyle = '#B45309'; ctx.fillRect(15, -1, 1, 1);
  ctx.fillStyle = '#78350F'; ctx.fillRect(14,  0, 1, 1);

  // ── 鏽斑：中部腐蝕斑 ──
  ctx.fillStyle = 'rgba(180,83,9,0.8)';
  ctx.beginPath();
  ctx.moveTo(9, -2); ctx.lineTo(9, 0); ctx.lineTo(8, 0); ctx.lineTo(8,  1);
  ctx.lineTo(6,  1); ctx.lineTo(6,-1); ctx.lineTo(7,-1); ctx.lineTo(7, -2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#451A03';              ctx.fillRect( 7, -1, 1, 1);
  ctx.fillStyle = 'rgba(249,115,22,0.4)'; ctx.fillRect( 6,  0, 1, 1);

  // ── 鏽斑：刃口散點 ──
  ctx.fillStyle = '#B45309';              ctx.fillRect( 0,  1, 1, 1);
  ctx.fillStyle = '#78350F';              ctx.fillRect(10, -3, 1, 1);
  ctx.fillStyle = 'rgba(180,83,9,0.6)';  ctx.fillRect(-4,  0, 1, 2);

  // ── 護手（暗鐵）──
  ctx.fillStyle = '#1E293B'; ctx.fillRect(-7, -6, 2, 12);
  ctx.fillStyle = 'rgba(69,26,3,0.4)'; ctx.fillRect(-6, -4, 1, 3);

  // ── 鬆動木柄 ──
  ctx.fillStyle = '#5D4037'; ctx.fillRect(-19, -2, 10, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-9, -2, 1, 4); // 分離縫
  ctx.strokeStyle = '#271709'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-11, -2); ctx.lineTo(-11, 2);
  ctx.moveTo(-15, -2); ctx.lineTo(-15, 2);
  ctx.stroke();

  // ── 柄尾（戰損）──
  ctx.fillStyle = '#334155'; ctx.fillRect(-21, -3, 2, 6);
  ctx.fillStyle = '#B45309'; ctx.fillRect(-21, -2, 1, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 枯木短匕（Splintered Stake）── Lv1 初始武器，從 SVG 44×44 轉換，90° CCW
// 刀尖朝右（+x），全長約 40px（x:-20 ~ x:18）
// ─────────────────────────────────────────────────────────────────────────────
export function drawWoodenStakeShape(ctx: CanvasRenderingContext2D): void {
  ctx.scale(1.2, 1.35); // 46×8px — 短粗木樁
  // ── 深色樹皮層 ──
  ctx.fillStyle = '#5D4037';
  ctx.beginPath();
  ctx.moveTo(18, -1);
  ctx.lineTo(14,  1);
  ctx.lineTo(-2,  1);
  ctx.lineTo(-6, -2);
  ctx.lineTo(-6, -5);
  ctx.lineTo( 2, -5);
  ctx.lineTo(10, -3);
  ctx.closePath();
  ctx.fill();

  // ── 木質主色 ──
  ctx.fillStyle = '#795548';
  ctx.beginPath();
  ctx.moveTo(17, -1);
  ctx.lineTo(14,  0);
  ctx.lineTo( 0,  0);
  ctx.lineTo(-4, -1);
  ctx.lineTo(-1, -2);
  ctx.lineTo(14, -2);
  ctx.closePath();
  ctx.fill();

  // ── 木材纖維高光 ──
  ctx.strokeStyle = '#D7CCC8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(18, -1); ctx.lineTo(15,  0);   // 刀尖纖維
  ctx.moveTo(12, -2); ctx.lineTo(12, -1);   // 側面纖維
  ctx.moveTo(-3, -4); ctx.lineTo(-5, -2);   // 根部纖維
  ctx.stroke();

  // ── 碎屑 ──
  ctx.fillStyle = '#D7CCC8';
  ctx.globalAlpha = 0.6;
  ctx.fillRect(9, 0, 1, 1);
  ctx.globalAlpha = 0.4;
  ctx.fillRect(3, -4, 1, 1);
  ctx.globalAlpha = 1;

  // ── 握柄底層（麻繩色）──
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(-18, -5, 12, 6);

  // 繩纏橫線
  ctx.strokeStyle = 'rgba(215,204,200,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo( -8, -5); ctx.lineTo( -8, 1);
  ctx.moveTo(-12, -5); ctx.lineTo(-12, 1);
  ctx.moveTo(-16, -5); ctx.lineTo(-16, 1);
  ctx.stroke();

  // 螺旋紋路
  ctx.strokeStyle = 'rgba(93,64,55,0.3)';
  ctx.beginPath();
  ctx.moveTo( -8, -5); ctx.lineTo(-10, 1);
  ctx.moveTo(-12, -5); ctx.lineTo(-14, 1);
  ctx.stroke();

  // ── 柄尾斷裂處 ──
  ctx.fillStyle = '#4E342E';
  ctx.beginPath();
  ctx.moveTo(-18, -5);
  ctx.lineTo(-18,  1);
  ctx.lineTo(-20,  1);
  ctx.lineTo(-20, -2);
  ctx.lineTo(-19, -4);
  ctx.lineTo(-18, -4);
  ctx.closePath();
  ctx.fill();
}

// ─────────────────────────────────────────────────────────────────────────────
// 刺劍（Stiletto）像素風格 ── 從 SVG 22×22 轉換，90° CCW，scale×2
// 刀尖朝右（+x），全長約 40px（x:-22 ~ x:18）
// 呼叫前需先 ctx.save() / translate / rotate
// ─────────────────────────────────────────────────────────────────────────────
export function drawStilettoShape(ctx: CanvasRenderingContext2D): void {
  // 刀身外框
  ctx.fillStyle = '#1A1A1B';
  ctx.fillRect(-8, -2, 26, 4);

  // 刀身暗面（上）
  ctx.fillStyle = '#A5B1C2';
  ctx.fillRect(-6, -2, 22, 2);

  // 刀身亮面（下）
  ctx.fillStyle = '#D1D8E0';
  ctx.fillRect(-6, 0, 22, 2);

  // 刀尖高光
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(12, 0, 4, 2);

  // 護手外框
  ctx.fillStyle = '#1A1A1B';
  ctx.fillRect(-12, -8, 4, 16);

  // 護手金色
  ctx.fillStyle = '#F7B731';
  ctx.fillRect(-12, -6, 2, 12);

  // 護手上下裝飾
  ctx.fillStyle = '#F7B731';
  ctx.fillRect(-8, -4, 4, 2);
  ctx.fillRect(-8,  2, 4, 2);

  // 握柄外框
  ctx.fillStyle = '#1A1A1B';
  ctx.fillRect(-20, -2, 8, 4);

  // 握柄填色
  ctx.fillStyle = '#4B4B4B';
  ctx.fillRect(-22, 0, 10, 2);
}

// Lv1=鏽棕 Lv2=鐵灰 Lv3=銀色 Lv4=深銀
function _rustColor(level: number): string {
  return ['#8d5524', '#9e9e9e', '#cfd8dc', '#78909c'][Math.min(level - 1, 3)];
}
