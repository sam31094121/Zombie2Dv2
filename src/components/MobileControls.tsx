// ── MobileControls.tsx ────────────────────────────────────────────────────────
// 統一手機搖桿模組（高效能重構版）
// 1. 繞過 React setState，使用 DOM Ref 直接控制 (解決觸控掉幀 / 偵測遺失)
// 2. 加入動態基座漂移 (Dynamic Base Drift) 解決拖曳死區問題
// 3. 攔截系統事件冒泡 (e.stopPropagation) 解決底層干擾
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useEffect } from 'react';

const OUTER_RADIUS = 68; // 放大搖桿外環便於大螢幕手機操作
const INNER_RADIUS = 28; // 放大搖桿核心球

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

export interface MobileControlsProps {
  playerCount: 1 | 2;
  onMove: (playerIndex: number, input: { x: number; y: number } | null) => void;
  resetSignal?: number;
}


// ── 核心搖桿管理 Hook（分離邏輯與處理，專門負責輸入更新）────────────────────────
function useJoystickManager(playerCount: 1 | 2, onMove: MobileControlsProps['onMove'], resetSignal: number = 0) {
  const containerRef = useRef<HTMLDivElement>(null);
  const joysRef      = useRef<JoystickState[]>([DEFAULT_JOY(), DEFAULT_JOY()]);
  const onMoveRef    = useRef(onMove);
  
  // DOM Refs (直接操作視覺，不觸發 render)
  const baseRefs  = useRef<(HTMLDivElement | null)[]>([null, null]);
  const stickRefs = useRef<(HTMLDivElement | null)[]>([null, null]);

  onMoveRef.current = onMove;

  // 更新單一搖桿的 DOM 視覺 (60fps 高效能直接更新)
  const updateDOM = (p: number, joy: JoystickState) => {
    const base  = baseRefs.current[p];
    const stick = stickRefs.current[p];
    
    if (!base || !stick) return;

    if (joy.active) {
      base.style.display = 'block';
      base.style.left = `${joy.baseX - OUTER_RADIUS}px`;
      base.style.top  = `${joy.baseY - OUTER_RADIUS}px`;
      stick.style.transform = `translate(${joy.stickX}px, ${joy.stickY}px)`;
    } else {
      base.style.display = 'none';
      stick.style.transform = `translate(0px, 0px)`;
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getPlayerIndex = (relX: number): number => {
      if (playerCount === 1) return 0;
      return relX < el.getBoundingClientRect().width / 2 ? 0 : 1;
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation(); // 攔截冒泡，防止底層 Game.ts 或 GameCanvas 誤判！
      
      const rect = el.getBoundingClientRect();
      const joys = joysRef.current;

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
          updateDOM(p, joys[p]);
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation(); // 攔截冒泡
      
      const rect = el.getBoundingClientRect();
      const joys = joysRef.current;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        for (let p = 0; p < joys.length; p++) {
          if (joys[p].active && joys[p].touchId === t.identifier) {
            
            const relX = t.clientX - rect.left;
            const relY = t.clientY - rect.top;
            
            let dx = relX - joys[p].baseX;
            let dy = relY - joys[p].baseY;
            const dist = Math.hypot(dx, dy);

            // 動態基座漂移 (Dynamic Base Drift) - 防止玩家滑出死區
            if (dist > OUTER_RADIUS) {
              const angle = Math.atan2(dy, dx);
              // 把基座拉向手指方向，確保手指永遠在搖桿絕對邊界
              joys[p].baseX = relX - Math.cos(angle) * OUTER_RADIUS;
              joys[p].baseY = relY - Math.sin(angle) * OUTER_RADIUS;
              // 依據新基座重新計算距離
              dx = relX - joys[p].baseX;
              dy = relY - joys[p].baseY;
            }

            const finalDist = Math.hypot(dx, dy);
            const clamped   = Math.min(finalDist, OUTER_RADIUS);
            const angle     = Math.atan2(dy, dx);
            
            joys[p].stickX = Math.cos(angle) * clamped;
            joys[p].stickY = Math.sin(angle) * clamped;
            
            // 繞過 React state 立即變更視覺
            updateDOM(p, joys[p]);

            onMoveRef.current(p, {
              x: Math.cos(angle) * (clamped / OUTER_RADIUS),
              y: Math.sin(angle) * (clamped / OUTER_RADIUS),
            });
          }
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const joys = joysRef.current;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        for (let p = 0; p < joys.length; p++) {
          if (joys[p].active && joys[p].touchId === t.identifier) {
            joys[p] = DEFAULT_JOY();
            updateDOM(p, joys[p]);
            onMoveRef.current(p, null);
          }
        }
      }
    };

    // ── 滑鼠事件（保持相同的原生更新邏輯，支援 PC 端測試） ──
    const onMouseDown = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const p = getPlayerIndex(relX);
      const joys = joysRef.current;
      
      if (!joys[p].active) {
        joys[p] = { active: true, touchId: -99 - p, baseX: relX, baseY: e.clientY - rect.top, stickX: 0, stickY: 0 };
        updateDOM(p, joys[p]);
      }
    };
    
    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const joys = joysRef.current;
      
      for (let p = 0; p < joys.length; p++) {
        if (joys[p].active && joys[p].touchId === -99 - p) {
          const relX = e.clientX - rect.left;
          const relY = e.clientY - rect.top;
          let dx = relX - joys[p].baseX;
          let dy = relY - joys[p].baseY;
          
          if (Math.hypot(dx, dy) > OUTER_RADIUS) {
            const angle = Math.atan2(dy, dx);
            joys[p].baseX = relX - Math.cos(angle) * OUTER_RADIUS;
            joys[p].baseY = relY - Math.sin(angle) * OUTER_RADIUS;
            dx = relX - joys[p].baseX;
            dy = relY - joys[p].baseY;
          }

          const clamped = Math.min(Math.hypot(dx, dy), OUTER_RADIUS);
          const angle   = Math.atan2(dy, dx);
          joys[p].stickX = Math.cos(angle) * clamped;
          joys[p].stickY = Math.sin(angle) * clamped;
          
          updateDOM(p, joys[p]);
          onMoveRef.current(p, { x: Math.cos(angle) * (clamped / OUTER_RADIUS), y: Math.sin(angle) * (clamped / OUTER_RADIUS) });
        }
      }
    };
    
    const onMouseUp = () => {
      const joys = joysRef.current;
      for (let p = 0; p < joys.length; p++) {
        if (joys[p].active && joys[p].touchId < -1) {
          joys[p] = DEFAULT_JOY();
          updateDOM(p, joys[p]);
          onMoveRef.current(p, null);
        }
      }
    };

    el.addEventListener('touchstart',  onTouchStart, { passive: false });
    el.addEventListener('touchmove',   onTouchMove,  { passive: false });
    el.addEventListener('touchend',    onTouchEnd,   { passive: false });
    el.addEventListener('touchcancel', onTouchEnd,   { passive: false });
    el.addEventListener('mousedown',   onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);

    // 第一幀先關閉所有顯示
    updateDOM(0, DEFAULT_JOY());
    updateDOM(1, DEFAULT_JOY());

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

  useEffect(() => {
    joysRef.current = [DEFAULT_JOY(), DEFAULT_JOY()];
    updateDOM(0, joysRef.current[0]);
    updateDOM(1, joysRef.current[1]);
    onMoveRef.current(0, null);
    onMoveRef.current(1, null);
  }, [resetSignal]);

  return { containerRef, baseRefs, stickRefs };
}

// ── 渲染層 ───────────────────────────────────────────────────────────────────
export function MobileControls({ playerCount, onMove, resetSignal = 0 }: MobileControlsProps) {
  // 將所有核心邏輯交還給管理 Hook 處理
  const { containerRef, baseRefs, stickRefs } = useJoystickManager(playerCount, onMove, resetSignal);
  
  const colors = ['rgba(52,152,219,0.55)', 'rgba(231,76,60,0.55)'];
  const fillColors = ['rgba(52,152,219,0.75)', 'rgba(231,76,60,0.75)'];

  // 預先產生兩種 JoyStick 的原生結構，讓 Hook 控制透明度/顯示，避免 React 重繪
  const renderJoysticks = () => {
    return Array.from({ length: 2 }).map((_, i) => (
      <div key={`joy-group-${i}`}>
        {/* 動態搖桿 (預設隱藏) */}
        <div
          ref={el => { baseRefs.current[i] = el; }}
          style={{
            position:      'absolute',
            display:       'none',
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
          {/* 搖桿小球 */}
          <div
            ref={el => { stickRefs.current[i] = el; }}
            style={{
              position:     'absolute',
              left:         OUTER_RADIUS - INNER_RADIUS, // 自動置中
              top:          OUTER_RADIUS - INNER_RADIUS,
              width:        INNER_RADIUS * 2,
              height:       INNER_RADIUS * 2,
              borderRadius: '50%',
              background:   fillColors[i],
              border:       '2px solid rgba(255,255,255,0.5)',
              willChange:   'transform', // 啟用 GPU 加速提升效能
            }}
          />
        </div>
      </div>
    ));
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20"
      style={{ touchAction: 'none' }}
    >
      {renderJoysticks()}
    </div>
  );
}
