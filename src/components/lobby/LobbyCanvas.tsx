// ── LobbyCanvas.tsx ───────────────────────────────────────────────────────────
// 大廳主畫面：Canvas 遊戲迴圈 + NPC 面板觸發
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LobbyScene } from '../../game/lobby/LobbyScene';
import { drawLobby }  from '../../game/lobby/LobbyRenderer';
import { NPCType }    from '../../game/lobby/LobbyNPC';
import { MobileControls } from '../MobileControls';
import { PortalPanel }     from './panels/PortalPanel';
import { BlacksmithPanel } from './panels/BlacksmithPanel';
import { MerchantPanel }   from './panels/MerchantPanel';
import { GachaPanel }      from './panels/GachaPanel';
import { QuestPanel }      from './panels/QuestPanel';

interface Props {
  playerColor?: string;
  platform?: 'pc' | 'mobile' | null;
  onStartGame: (difficulty: 'normal' | 'hard' | 'infinite', mode: 'endless' | 'arena') => void;
}

export function LobbyCanvas({ playerColor = '#4fc3f7', platform, onStartGame }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef  = useRef<LobbyScene | null>(null);
  const rafRef    = useRef<number>(0);
  const lastRef   = useRef<number>(0);

  const [openPanel, setOpenPanel] = useState<NPCType | null>(null);

  // ── 初始化大廳 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = new LobbyScene(playerColor);
    sceneRef.current = scene;

    scene.onNPCTrigger = (id) => setOpenPanel(id);

    window.addEventListener('keydown', scene.handleKeyDown);
    window.addEventListener('keyup',   scene.handleKeyUp);

    return () => {
      window.removeEventListener('keydown', scene.handleKeyDown);
      window.removeEventListener('keyup',   scene.handleKeyUp);
      cancelAnimationFrame(rafRef.current);
    };
  }, [playerColor]);

  // ── 遊戲迴圈 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const loop = (now: number) => {
      const dt = Math.min(now - (lastRef.current || now), 50);
      lastRef.current = now;

      const scene = sceneRef.current;
      if (scene && !openPanel) {
        scene.update(dt);
      }
      if (scene) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawLobby(scene, ctx);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [openPanel]);

  // ── 面板關閉 ────────────────────────────────────────────────────────────────
  const closePanel = useCallback((id: NPCType) => {
    sceneRef.current?.resetNPC(id);
    setOpenPanel(null);
  }, []);

  return (
    <div className="relative flex items-center justify-center w-full h-full bg-black">
      {/* 頂部標題 */}
      <div className="absolute top-0 left-0 right-0 z-10 text-center py-2 bg-black/60">
        <span className="text-yellow-300 font-black tracking-widest text-lg">☠ 大廳 ☠</span>
        <span className="text-gray-500 text-xs ml-4">走近 NPC 停留 3 秒自動互動</span>
      </div>

      {/* 大廳 Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={680}
        className="block max-w-full max-h-full"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* 手機版搖桿（只在 mobile 且面板未開時顯示） */}
      {platform === 'mobile' && !openPanel && (
        <MobileControls
          playerCount={1}
          onMove={(_idx, input) => { if (sceneRef.current) sceneRef.current.joystick = input; }}
        />
      )}

      {/* NPC 面板 */}
      {openPanel === 'portal'       && <PortalPanel     onStart={(diff) => onStartGame(diff, 'endless')} onClose={() => closePanel('portal')}     />}
      {openPanel === 'arena_portal' && <PortalPanel     onStart={(diff) => onStartGame(diff, 'arena')}   onClose={() => closePanel('arena_portal')} />}
      {openPanel === 'blacksmith'   && <BlacksmithPanel                                                  onClose={() => closePanel('blacksmith')} />}
      {openPanel === 'merchant'   && <MerchantPanel                               onClose={() => closePanel('merchant')}   />}
      {openPanel === 'gacha'      && <GachaPanel                                  onClose={() => closePanel('gacha')}      />}
      {openPanel === 'questboard' && <QuestPanel                                  onClose={() => closePanel('questboard')} />}
    </div>
  );
}
