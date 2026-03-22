// ── MobileControls.tsx ────────────────────────────────────────────────────────
// 統一手機搖桿模組：follow-touch，點哪裡搖桿就出現在哪裡
// 未觸碰時在底部中央顯示靜止提示；雙人模式左右各一個
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useEffect, useState } from 'react';

const OUTER_RADIUS = 56;
const INNER_RADIUS = 22;

interface JoystickState {
  active: boolean;
  touchId: number;
  baseX: number;
  baseY: number;
  stickX: number;
  stickY: number;
}

const DEFAULT_JOY = (): JoystickState => ({
  active: false, touchId: -1, baseX: 0, baseY: 0, stickX: 0, stickY: 0,
});

interface MobileControlsProps {
  playerCount: 1 | 2;
  onMove: (playerIndex: number, input: { x: number; y: number } | null) => void;
}

// 靜止提示圖示（底部中央的虛線圓環）
function IdleHint({ color }: { color: string }) {
  return (
    <div style={{
      width:        OUTER_RADIUS * 2,
      height:       OUTER_RADIUS * 2,
      borderRadius: '50%',
      border:       `2px dashed ${color}`,
      background:   'rgba(255,255,255,0.03)',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        width:        INNER_RADIUS * 2,
        height:       INNER_RADIUS * 2,
        borderRadius: '50%',
        background:   color,
        opacity:      0.35,
      }} />
    </div>
  );
}

export function MobileControls({ playerCount, onMove }: MobileControlsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const joysticksRef = useRef<JoystickState[]>([DEFAULT_JOY(), DEFAULT_JOY()]);
  const onMoveRef    = useRef(onMove);
  onMoveRef.current  = onMove;

  const [, forceRender] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getPlayerIndex = (relX: number): number => {
      if (playerCount === 1) return 0;
      return relX < el.getBoundingClientRect().width / 2 ? 0 : 1;
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const joys = joysticksRef.current;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const relX = t.clientX - rect.left;
        const p = getPlayerIndex(relX);
        if (!joys[p].active) {
          joys[p] = {
            active:  true,
            touchId: t.identifier,
            baseX:   relX,
            baseY:   t.clientY - rect.top,
            stickX:  0,
            stickY:  0,
          };
        }
      }
      forceRender(n => n + 1);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const joys = joysticksRef.current;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        for (let p = 0; p < joys.length; p++) {
          if (joys[p].active && joys[p].touchId === t.identifier) {
            const dx      = (t.clientX - rect.left) - joys[p].baseX;
            const dy      = (t.clientY - rect.top)  - joys[p].baseY;
            const dist    = Math.hypot(dx, dy);
            const clamped = Math.min(dist, OUTER_RADIUS);
            const angle   = Math.atan2(dy, dx);
            joys[p].stickX = Math.cos(angle) * clamped;
            joys[p].stickY = Math.sin(angle) * clamped;
            onMoveRef.current(p, {
              x: Math.cos(angle) * (clamped / OUTER_RADIUS),
              y: Math.sin(angle) * (clamped / OUTER_RADIUS),
            });
          }
        }
      }
      forceRender(n => n + 1);
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const joys = joysticksRef.current;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        for (let p = 0; p < joys.length; p++) {
          if (joys[p].active && joys[p].touchId === t.identifier) {
            joys[p] = DEFAULT_JOY();
            onMoveRef.current(p, null);
          }
        }
      }
      forceRender(n => n + 1);
    };

    // ── 滑鼠事件（PC 測試用）─────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const p = getPlayerIndex(relX);
      const joys = joysticksRef.current;
      if (!joys[p].active) {
        joys[p] = { active: true, touchId: -99 - p, baseX: relX, baseY: e.clientY - rect.top, stickX: 0, stickY: 0 };
      }
      forceRender(n => n + 1);
    };
    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const joys = joysticksRef.current;
      for (let p = 0; p < joys.length; p++) {
        if (joys[p].active && joys[p].touchId === -99 - p) {
          const dx = (e.clientX - rect.left) - joys[p].baseX;
          const dy = (e.clientY - rect.top)  - joys[p].baseY;
          const dist = Math.hypot(dx, dy);
          const clamped = Math.min(dist, OUTER_RADIUS);
          const angle   = Math.atan2(dy, dx);
          joys[p].stickX = Math.cos(angle) * clamped;
          joys[p].stickY = Math.sin(angle) * clamped;
          onMoveRef.current(p, { x: Math.cos(angle) * (clamped / OUTER_RADIUS), y: Math.sin(angle) * (clamped / OUTER_RADIUS) });
          forceRender(n => n + 1);
        }
      }
    };
    const onMouseUp = () => {
      const joys = joysticksRef.current;
      for (let p = 0; p < joys.length; p++) {
        if (joys[p].active && joys[p].touchId < -1) {
          joys[p] = DEFAULT_JOY();
          onMoveRef.current(p, null);
        }
      }
      forceRender(n => n + 1);
    };

    el.addEventListener('touchstart',  onTouchStart, { passive: false });
    el.addEventListener('touchmove',   onTouchMove,  { passive: false });
    el.addEventListener('touchend',    onTouchEnd,   { passive: false });
    el.addEventListener('touchcancel', onTouchEnd,   { passive: false });
    el.addEventListener('mousedown',   onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);

    return () => {
      el.removeEventListener('touchstart',  onTouchStart);
      el.removeEventListener('touchmove',   onTouchMove);
      el.removeEventListener('touchend',    onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('mousedown',   onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [playerCount]);

  const joys = joysticksRef.current;
  const colors = ['rgba(52,152,219,0.55)', 'rgba(231,76,60,0.55)'];

  // 靜止提示位置：底部中央，雙人各在自己那半邊的中央
  const hintPositions = playerCount === 1
    ? [{ left: '50%', bottom: '48px', transform: 'translateX(-50%)' }]
    : [
        { left: '25%', bottom: '48px', transform: 'translateX(-50%)' },
        { left: '75%', bottom: '48px', transform: 'translateX(-50%)' },
      ];

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20"
      style={{ touchAction: 'none' }}
    >
      {/* 靜止提示（未觸碰時顯示） */}
      {hintPositions.map((pos, i) => (
        !joys[i]?.active && (
          <div key={`hint-${i}`} style={{ position: 'absolute', ...pos }}>
            <IdleHint color={colors[i]} />
          </div>
        )
      ))}

      {/* 觸碰時的動態搖桿 */}
      {joys.map((joy, i) => {
        if (!joy.active) return null;
        const fillColor = i === 0
          ? 'rgba(52,152,219,0.75)'
          : 'rgba(231,76,60,0.75)';

        return (
          <div
            key={`joy-${i}`}
            style={{
              position:      'absolute',
              left:          joy.baseX - OUTER_RADIUS,
              top:           joy.baseY - OUTER_RADIUS,
              width:         OUTER_RADIUS * 2,
              height:        OUTER_RADIUS * 2,
              pointerEvents: 'none',
            }}
          >
            {/* 外環 */}
            <div style={{
              position:     'absolute',
              inset:        0,
              borderRadius: '50%',
              border:       '2px solid rgba(255,255,255,0.3)',
              background:   'rgba(255,255,255,0.06)',
            }} />
            {/* 搖桿球 */}
            <div style={{
              position:     'absolute',
              left:         OUTER_RADIUS + joy.stickX - INNER_RADIUS,
              top:          OUTER_RADIUS + joy.stickY - INNER_RADIUS,
              width:        INNER_RADIUS * 2,
              height:       INNER_RADIUS * 2,
              borderRadius: '50%',
              background:   fillColor,
              border:       '2px solid rgba(255,255,255,0.5)',
            }} />
          </div>
        );
      })}
    </div>
  );
}
