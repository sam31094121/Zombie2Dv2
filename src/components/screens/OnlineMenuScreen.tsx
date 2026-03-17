// ── OnlineMenuScreen.tsx ──────────────────────────────────────────────────────
import React from 'react';

interface OnlineMenuScreenProps {
  onlineStep: 'menu' | 'waiting' | 'joining';
  roomCode: string;
  joinInput: string;
  setJoinInput: (v: string) => void;
  onlineError: string;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onBack: () => void;
  onCancelWait: () => void;
}

export const OnlineMenuScreen: React.FC<OnlineMenuScreenProps> = ({
  onlineStep, roomCode, joinInput, setJoinInput, onlineError,
  onCreateRoom, onJoinRoom, onBack, onCancelWait,
}) => (
  <div className="flex flex-col items-center w-full max-w-md">
    {onlineStep === 'menu' && (
      <>
        <p className="text-neutral-400 mb-6 text-lg font-medium text-center">線上多人遊戲</p>
        {onlineError && (
          <div className="mb-4 px-4 py-2 bg-red-900/50 border border-red-500 rounded-xl text-red-300 text-sm text-center">
            {onlineError}
          </div>
        )}
        <div className="flex flex-col gap-4 w-full mb-6">
          <button onClick={onCreateRoom}
            className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-2xl transition-all text-xl">
            建立房間
          </button>
          <div className="flex flex-col gap-2">
            <input
              type="text" inputMode="numeric" pattern="[0-9]*"
              value={joinInput}
              onChange={e => setJoinInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && onJoinRoom()}
              placeholder="輸入 4 位數字代碼"
              maxLength={4}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-600 rounded-xl text-white font-mono text-center text-2xl tracking-widest placeholder-neutral-600 focus:outline-none focus:border-yellow-500"
            />
            <button onClick={onJoinRoom}
              className="w-full py-4 bg-neutral-700 hover:bg-neutral-600 text-white font-bold rounded-2xl transition-all text-xl border border-neutral-600">
              加入房間
            </button>
          </div>
        </div>
        <button onClick={onBack} className="text-neutral-500 hover:text-white transition-colors underline underline-offset-4">返回</button>
      </>
    )}

    {onlineStep === 'waiting' && (
      <div className="flex flex-col items-center gap-6">
        <p className="text-neutral-400 text-lg">等待對手加入...</p>
        <div className="bg-neutral-900/80 border-2 border-yellow-500 rounded-2xl p-8 text-center">
          <p className="text-neutral-400 text-sm mb-2">房間代碼</p>
          <p className="text-5xl font-black font-mono tracking-widest text-yellow-400">{roomCode}</p>
          <p className="text-neutral-500 text-xs mt-3">將代碼傳給朋友</p>
        </div>
        <div className="flex items-center gap-3 text-neutral-400">
          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          <span>等待第二位玩家...</span>
        </div>
        <button onClick={onCancelWait} className="text-neutral-500 hover:text-white transition-colors underline underline-offset-4">取消</button>
      </div>
    )}

    {onlineStep === 'joining' && (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3 text-neutral-400">
          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          <span>連線中...</span>
        </div>
      </div>
    )}
  </div>
);
