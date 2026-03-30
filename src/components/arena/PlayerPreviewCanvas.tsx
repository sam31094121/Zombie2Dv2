import React, { useCallback, useEffect, useRef } from 'react';
import type { Player } from '../../game/Player';
import { drawPlayer, WEAPON_SLOT_POSITIONS } from '../../game/renderers/PlayerRenderer';

const HIT_RADIUS = 20;

interface PlayerPreviewCanvasProps {
  player: Player;
  playerLabel?: string;
  selectedSlotIdx?: number | null;
  isActive?: boolean;
  onSlotClick?: (slotIdx: number) => void;
  onPlayerClick?: () => void;
  bufW?: number;
  bufH?: number;
}

export const PlayerPreviewCanvas: React.FC<PlayerPreviewCanvasProps> = ({
  player,
  playerLabel,
  selectedSlotIdx = null,
  isActive = false,
  onSlotClick,
  onPlayerClick,
  bufW = 585, // 195 * 3
  bufH = 330, // 110 * 3
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const playerRef = useRef(player);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  const LOGICAL_W = 195;
  const LOGICAL_H = 110;
  const cx = LOGICAL_W / 2;
  const cy = LOGICAL_H / 2 + 4;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, bufW, bufH);

      const scale = bufW / LOGICAL_W;
      ctx.scale(scale, scale);

      const p = playerRef.current;
      const previewProxy: Player = {
        ...p,
        weapons: p.weapons.map(w => (w ? { ...w, aimAngle: undefined, lastAttackTime: 0 } : null)),
        x: cx,
        y: cy,
        aimAngle: 0,
        isFloatingWeapons: true,
        weaponSwitchTimer: 0,
        isInsideContainer: false,
        slowDebuffTimer: 0,
        isPreview: true,
      } as any;

      drawPlayer(previewProxy, ctx, {
        hideUI: true,
        selectedSlotIdx,
        dimUnselected: true,
        weaponScale: 1.0,
      });

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [selectedSlotIdx, isActive, bufW, bufH, cx, cy]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_W / rect.width;
    const scaleY = LOGICAL_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let hitSlot = -1;
    let minDist = HIT_RADIUS;
    for (let i = 0; i < WEAPON_SLOT_POSITIONS.length; i++) {
      const slot = player.weapons[i];
      if (!slot) continue;

      const sp = WEAPON_SLOT_POSITIONS[i];
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

    onPlayerClick?.();
  }, [LOGICAL_H, LOGICAL_W, cx, cy, onPlayerClick, onSlotClick, player.weapons, selectedSlotIdx]);

  return (
    <canvas
      ref={canvasRef}
      width={bufW}
      height={bufH}
      onClick={handleClick}
      style={{
        display: 'block',
        width: '100%',
        maxWidth: '186px',
        aspectRatio: `${LOGICAL_W} / ${LOGICAL_H}`,
        height: 'auto',
        maxHeight: '28vh',
        margin: '0 auto',
        cursor: 'pointer',
        background: 'rgba(7, 12, 22, 0.6)',
        borderRadius: '12px',
        border: `1.5px solid ${isActive ? player.color : '#1e293b'}`,
        boxShadow: isActive ? `0 0 15px ${player.color}44` : 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    />
  );
};
