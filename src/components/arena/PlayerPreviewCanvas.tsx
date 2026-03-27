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

// 武器平均尺寸，將熱區縮小以適應更緊湊的預覽
const HIT_RADIUS = 20;

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
  bufW = 195,
  bufH = 110,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // rAF handle，用於 cleanup
  const rafRef = useRef<number>(0);
  const playerRef = useRef(player);
  
  // 隨時同步最新的 player 物件供 rAF 使用，避免閉包快照導致的更新延遲
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  // 玩家中心在 canvas 中的座標
  const cx = Math.round(bufW / 2);
  const cy = Math.round(bufH / 2) + 4;

  // ── 繪製循環 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, bufW, bufH);
      
      const p = playerRef.current;
      // 每一幀都建立最新的代理，確保購買武器後立刻更新預覽
      const previewProxy: Player = {
        ...p,
        weapons: p.weapons.map(w => w ? { ...w, aimAngle: undefined, lastAttackTime: 0 } : null),
        x: cx,
        y: cy,
        aimAngle: 0,
        isFloatingWeapons: true,
        weaponSwitchTimer: 0,
        isInsideContainer: false,
        slowDebuffTimer: 0,
        isPreview: true,
      } as any;

      // ── 核心：使用完全相同的 drawPlayer 渲染，但隱藏遊戲 UI 並加入選中特效 ──
      drawPlayer(previewProxy, ctx, { 
        hideUI: true, 
        selectedSlotIdx: selectedSlotIdx,
        dimUnselected: true 
      });

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlotIdx, isActive, bufW, bufH, cx, cy]);

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
      const slot = player.weapons[i];
      if (!slot) continue; // 只有該位置有裝備武器時才計算熱區

      const sp = WEAPON_SLOT_POSITIONS[i];
      
      // ── 與 PlayerRenderer 渲染邏輯同步 ──
      // 當點選了別把武器時，本武器是不呼吸的 (bob=0)
      const isSelected = selectedSlotIdx === i;
      const isOtherSelected = selectedSlotIdx !== null && !isSelected;
      const bob = isOtherSelected ? 0 : Math.sin(Date.now() / 300 + i) * 4;

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

    // ── 2. 角色與背景判斷 ──
    // 只要沒點到武器，點擊框內任何地方都視為「選擇角色」（全部呼吸模式）
    onPlayerClick?.();
  }, [bufW, bufH, cx, cy, selectedSlotIdx, onSlotClick, onPlayerClick]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <canvas
      ref={canvasRef}
      width={bufW}
      height={bufH}
      onClick={handleClick}
      style={{
        display: 'block',
        width: '186px',          // 增加寬度，讓長武器也能完全展示
        height: '110px',
        margin: '0 auto',
        cursor: 'pointer',
        // 🔽 高級展示框設計
        background: 'rgba(7, 12, 22, 0.6)',           // 深色透明背板
        borderRadius: '12px',                         // 柔和圓角
        border: `1.5px solid ${isActive ? player.color : '#1e293b'}`, // 根據選中狀態切換顏色
        boxShadow: isActive ? `0 0 15px ${player.color}44` : 'none', // 選中時發光
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        imageRendering: 'pixelated',
      }}
    />
  );
};
