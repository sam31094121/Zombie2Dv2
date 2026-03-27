// ── PlayerPreviewCanvas.tsx ───────────────────────────────────────────────────
// 商店角色預覽模組 — 與遊戲中完全相同的繪製邏輯
//
// 設計原則：
//   1. 直接呼叫 drawPlayer()，與遊戲主畫布使用完全一致的 Canvas 2D 指令
//   2. 使用 requestAnimationFrame 持續更新，確保 bob 動畫、光暈與遊戲同步
//   3. 唯一新功能：計算每個武器槽位的隱形點擊熱區（圓形），
//      使用與 drawPlayer 完全相同的 WEAPON_SLOT_POSITIONS 座標
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useEffect, useCallback } from 'react';
import type { Player } from '../../game/Player';
import { drawPlayer, WEAPON_SLOT_POSITIONS } from '../../game/renderers/PlayerRenderer';

// ── 點擊熱區半徑（px，以 canvas 內部解析度計）────────────────────────────────
// 武器繪製尺寸約 30px，熱區設為 30px 半徑讓點擊手感寬鬆
const HIT_RADIUS = 30;

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlayerPreviewCanvasProps {
  player: Player;
  /** 自訂顯示標籤，例如 "P1" / "P2" */
  playerLabel?: string;
  /** 目前被選中的武器槽位 index（-1 或 undefined = 無選取）*/
  selectedSlotIdx?: number | null;
  /** 此預覽是否為當前操作的玩家（影響背景光暈強度）*/
  isActive?: boolean;
  /** 點擊武器槽位時的 callback，回傳槽位 index (0-5) */
  onSlotClick?: (slotIdx: number) => void;
  /** 點擊角色主體時的 callback */
  onPlayerClick?: () => void;
  /** canvas 內部解析度寬（px）— 影響繪製精度，不影響 DOM 大小 */
  bufW?: number;
  /** canvas 內部解析度高（px）*/
  bufH?: number;
}

// ── 主元件 ────────────────────────────────────────────────────────────────────

export const PlayerPreviewCanvas: React.FC<PlayerPreviewCanvasProps> = ({
  player,
  playerLabel,
  selectedSlotIdx = null,
  isActive = false,
  onSlotClick,
  onPlayerClick,
  bufW = 240,
  bufH = 180,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // rAF handle，用於 cleanup
  const rafRef = useRef<number>(0);
  // 玩家中心在 canvas 中的座標
  const cx = Math.round(bufW / 2);
  const cy = Math.round(bufH / 2) + 4;

  // ── 繪製循環 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 建立一個「假的」Player 代理，讓 drawPlayer 把原點當作 canvas 中心
    // 只複製繪製需要的欄位，不影響遊戲中真實的 player 物件
    const previewProxy: Player = {
      ...player,
      x: cx,
      y: cy,
      // 靜止姿態：不攻擊，手指朝右（0 rad）
      aimAngle: 0,
      // 確保走懸浮武器路徑
      isFloatingWeapons: true,
      // 停用戰鬥相關視覺效果
      weaponSwitchTimer: 0,
      isInsideContainer: false,
      slowDebuffTimer: 0,
    };

    const render = () => {
      ctx.clearRect(0, 0, bufW, bufH);

      // ── 背景：玩家顏色的放射漸層 ──
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80);
      gradient.addColorStop(0, isActive ? `${player.color}22` : `${player.color}0d`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, bufW, bufH);

      // ── 選中槽位高亮環（畫在 drawPlayer 之前，避免被覆蓋）──
      if (selectedSlotIdx !== null && selectedSlotIdx >= 0) {
        const sp = WEAPON_SLOT_POSITIONS[selectedSlotIdx];
        // 計算 bob 偏移（與 drawPlayer 完全一致的公式）
        const bob = Math.sin(Date.now() / 300 + selectedSlotIdx) * 4;
        const hx = cx + sp.rx;
        const hy = cy + sp.ry + bob;
        ctx.save();
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(hx, hy, HIT_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = '#fbbf2466';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // ── 核心：使用完全相同的 drawPlayer 渲染 ──
      drawPlayer(previewProxy, ctx);

      // ── 底部標籤：玩家名稱 + 金幣 ──
      if (playerLabel) {
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = isActive ? player.color : '#475569';
        ctx.fillText(playerLabel, cx, 12);
      }
      ctx.font = '9px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`💰 ${Math.floor(player.materials)}`, cx, bufH - 4);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, selectedSlotIdx, isActive, bufW, bufH, cx, cy, playerLabel]);

  // ── 點擊熱區判斷 ────────────────────────────────────────────────────────────
  // 使用與 drawPlayer 完全一致的 WEAPON_SLOT_POSITIONS 計算每個槽位中心，
  // bob 偏移在點擊瞬間即時計算（誤差在 ±4px 內，使用者感知不到）
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 將 DOM 座標換算回 canvas 內部解析度座標
    const rect = canvas.getBoundingClientRect();
    const scaleX = bufW / rect.width;
    const scaleY = bufH / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // ── 武器槽位熱區判斷 ──
    // 找最近的槽位，只要距離在 HIT_RADIUS 內即視為點擊
    let hitSlot = -1;
    let minDist = HIT_RADIUS;

    for (let i = 0; i < WEAPON_SLOT_POSITIONS.length; i++) {
      const sp = WEAPON_SLOT_POSITIONS[i];
      // bob 在點擊瞬間即時計算，與 rAF 誤差 < 1 幀
      const bob = Math.sin(Date.now() / 300 + i) * 4;
      const slotX = cx + sp.rx;
      const slotY = cy + sp.ry + bob;
      const dist = Math.hypot(mx - slotX, my - slotY);
      if (dist < minDist) {
        minDist = dist;
        hitSlot = i;
      }
    }

    if (hitSlot !== -1) {
      onSlotClick?.(hitSlot);
      return;
    }

    // ── 角色主體熱區判斷 ──
    const playerDist = Math.hypot(mx - cx, my - cy);
    if (playerDist < (player.radius ?? 16) + 10) {
      onPlayerClick?.();
    }
  }, [bufW, bufH, cx, cy, player.radius, onSlotClick, onPlayerClick]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <canvas
      ref={canvasRef}
      width={bufW}
      height={bufH}
      onClick={handleClick}
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        cursor: 'pointer',
        borderRadius: '10px',
        background: '#070c16',
        outline: isActive
          ? `1.5px solid ${player.color}55`
          : '1.5px solid #131e2e',
        // 讓點擊區域更準，避免瀏覽器縮放模糊
        imageRendering: 'pixelated',
      }}
    />
  );
};
