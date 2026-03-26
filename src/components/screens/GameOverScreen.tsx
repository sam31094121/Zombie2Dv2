// ── GameOverScreen.tsx ────────────────────────────────────────────────────────
import React from 'react';
import { NetworkManager } from '../../game/NetworkManager';

interface GameOverScreenProps {
  gameStats: { time: number; kills: number };
  isOnlineMode: boolean;
  readyState: { myReady: boolean; otherReady: boolean };
  readyRef: React.MutableRefObject<{ myReady: boolean; otherReady: boolean }>;
  networkRef: React.RefObject<NetworkManager | null>;
  playerCount: number;
  formatTime: (ms: number) => string;
  onPlayAgain: () => void;
  onMainMenu: () => void;
  onReadyRematch: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  gameStats, isOnlineMode, readyState, readyRef, networkRef,
  formatTime, onPlayAgain, onMainMenu, onReadyRematch,
}) => (
  <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center rounded-xl text-white z-10 overflow-y-auto p-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
    <div className="max-w-md w-full flex flex-col items-center my-auto py-4 sm:py-8">
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-800 tracking-tighter drop-shadow-lg text-center">遊戲結束</h1>
      <div className="bg-neutral-900/80 p-6 md:p-8 rounded-3xl border border-neutral-800 shadow-2xl mb-8 flex flex-col gap-4 w-full text-center">
        <div className="text-xl text-neutral-300 font-medium">存活時間</div>
        <div className="text-3xl font-mono text-yellow-400 font-bold">{formatTime(gameStats.time)}</div>
        <div className="h-px w-full bg-neutral-800 my-2"></div>
        <div className="text-xl text-neutral-300 font-medium">殭屍擊殺數</div>
        <div className="text-3xl font-mono text-red-400 font-bold">{gameStats.kills}</div>
      </div>
      <div className="flex flex-col gap-4 w-full">
        {!isOnlineMode && (
          <button onClick={onPlayAgain}
            className="w-full py-4 bg-white text-black hover:bg-neutral-200 font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:-translate-y-1 active:translate-y-0 text-xl">
            再玩一次
          </button>
        )}
        {isOnlineMode && (
          !readyState.myReady ? (
            <button onClick={onReadyRematch}
              className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-2xl transition-all hover:-translate-y-1 active:translate-y-0 text-xl">
              準備重賽
            </button>
          ) : (
            <div className="w-full py-4 text-center text-yellow-400 font-bold text-xl animate-pulse rounded-2xl bg-yellow-500/10 border border-yellow-500/30">
              {readyState.otherReady ? '重新開始中...' : '等待對手準備中...'}
            </div>
          )
        )}
        <button onClick={onMainMenu}
          className="w-full py-4 bg-neutral-800 text-white hover:bg-neutral-700 font-bold rounded-2xl transition-all border border-neutral-700 hover:-translate-y-1 active:translate-y-0 text-lg">
          主選單
        </button>
      </div>
    </div>
  </div>
);
