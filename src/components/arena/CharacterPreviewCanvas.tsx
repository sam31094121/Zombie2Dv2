// ── CharacterPreviewCanvas.tsx ────────────────────────────────────────────────
// 靜態 Canvas：繪製單一玩家角色 + 6 個武器槽，支援點選槽位
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useEffect, useCallback } from 'react';
import type { Player } from '../../game/Player';
import { WEAPON_REGISTRY, getWeaponKey } from '../../game/entities/definitions/WeaponDefinitions';

const SLOT_POSITIONS = [
  { rx:  50, ry:   0 }, // 0
  { rx: -50, ry:   0 }, // 1
  { rx: -50, ry: -28 }, // 2
  { rx:  50, ry: -28 }, // 3
  { rx: -50, ry:  28 }, // 4
  { rx:  50, ry:  28 }, // 5
];

const RARITY_COLORS = ['#94a3b8', '#4ade80', '#60a5fa', '#c084fc', '#fbbf24'];

interface Props {
  player: Player;
  playerLabel: string;
  selectedSlotIdx: number | null;
  isActive: boolean;
  onSlotClick: (slotIdx: number) => void;
  onPlayerClick: () => void;
  renderTick?: number;
  bufW?: number;
  bufH?: number;
}

export const CharacterPreviewCanvas: React.FC<Props> = ({
  player, playerLabel, selectedSlotIdx, isActive,
  onSlotClick, onPlayerClick, renderTick = 0,
  bufW = 240, bufH = 160,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cx = Math.round(bufW / 2);
  const cy = Math.round(bufH / 2) + 4;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, bufW, bufH);

    // ── 背景 ──────────────────────────────────────────────────────────────────
    if (isActive) {
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
      grd.addColorStop(0, `${player.color}1a`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, bufW, bufH);
    }

    // ── 武器槽 ────────────────────────────────────────────────────────────────
    for (let i = 0; i < 6; i++) {
      const slot = player.weapons[i] ?? null;
      const sp = SLOT_POSITIONS[i];
      const sx = cx + sp.rx;
      const sy = cy + sp.ry;
      const isSelected = selectedSlotIdx === i;
      const R = 20;

      ctx.save();
      ctx.translate(sx, sy);

      // Glow when selected
      if (isSelected) {
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 18;
      } else if (slot) {
        ctx.shadowColor = RARITY_COLORS[Math.min(slot.level - 1, 4)];
        ctx.shadowBlur = 8;
      }

      // Slot circle
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fillStyle = slot ? '#0f1e33' : '#09111d';
      ctx.fill();
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeStyle = isSelected ? '#fbbf24' : (slot ? `${RARITY_COLORS[Math.min(slot.level - 1, 4)]}66` : '#1e2d3f');
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (slot) {
        const facingAngle = sp.rx > 0 ? 0 : Math.PI;
        ctx.save();
        ctx.rotate(facingAngle);
        ctx.scale(0.85, 0.85);
        const wKey = getWeaponKey(slot.type, slot.level, slot.branch);
        const wDef = WEAPON_REGISTRY[slot.type]?.[wKey];
        if (wDef) {
          try {
            wDef.drawWeapon(ctx, { ...player, x: 0, y: 0, aimAngle: 0, weapons: [], isFloatingWeapons: false } as unknown as Player, slot);
          } catch { /* ignore */ }
        }
        ctx.restore();

        // Rarity dot below
        ctx.beginPath();
        ctx.arc(0, R + 5, 3, 0, Math.PI * 2);
        ctx.fillStyle = RARITY_COLORS[Math.min(slot.level - 1, 4)];
        ctx.fill();
      } else {
        // Empty: subtle plus
        ctx.strokeStyle = '#1e2d3f';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
      }

      ctx.restore();
    }

    // ── 角色主體 ──────────────────────────────────────────────────────────────
    ctx.save();
    ctx.translate(cx, cy);

    // Shadow
    ctx.beginPath();
    ctx.arc(2, 4, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    // Glow
    ctx.shadowColor = player.color;
    ctx.shadowBlur = isActive ? 20 : 8;

    // Body
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    ctx.closePath();

    ctx.restore();

    // ── HP bar ────────────────────────────────────────────────────────────────
    const barW = 36, barH = 3;
    const hpRatio = Math.max(0, Math.min(1, player.hp / player.maxHp));
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(cx - barW / 2, cy - player.radius - 9, barW, barH);
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(cx - barW / 2, cy - player.radius - 9, barW * hpRatio, barH);

    // ── 標籤 ──────────────────────────────────────────────────────────────────
    ctx.font = `bold 10px 'Arial'`;
    ctx.textAlign = 'center';
    ctx.fillStyle = isActive ? player.color : '#475569';
    ctx.fillText(playerLabel, cx, 11);

    // Materials
    ctx.font = '9px Arial';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`💰 ${player.materials}`, cx, bufH - 3);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, selectedSlotIdx, isActive, bufW, bufH, renderTick]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = bufW / rect.width;
    const scaleY = bufH / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let nearest = -1, nearestDist = 28;
    for (let i = 0; i < 6; i++) {
      const sp = SLOT_POSITIONS[i];
      const d = Math.hypot(mx - (cx + sp.rx), my - (cy + sp.ry));
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    }

    if (nearest !== -1) {
      onSlotClick(nearest);
    } else if (Math.hypot(mx - cx, my - cy) < player.radius + 14) {
      onPlayerClick();
    }
  }, [bufW, bufH, cx, cy, player.radius, onSlotClick, onPlayerClick]);

  return (
    <canvas
      ref={canvasRef}
      width={bufW}
      height={bufH}
      style={{
        display: 'block', width: '100%', height: 'auto',
        cursor: 'pointer', borderRadius: '10px',
        background: '#070c16',
        outline: isActive ? `1.5px solid ${player.color}44` : '1.5px solid #131e2e',
      }}
      onClick={handleClick}
    />
  );
};
