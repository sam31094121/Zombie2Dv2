// ── StartScreen.tsx ───────────────────────────────────────────────────────────
import React from 'react';
import { OnlineMenuScreen } from './OnlineMenuScreen';

interface StartScreenProps {
  selectionStep: 'platform' | 'players' | 'online';
  setSelectionStep: (v: 'platform' | 'players' | 'online') => void;
  platform: 'pc' | 'mobile' | null;
  setPlatform: (v: 'pc' | 'mobile') => void;
  onlineStep: 'menu' | 'waiting' | 'joining';
  setOnlineStep: (v: 'menu' | 'waiting' | 'joining') => void;
  roomCode: string;
  joinInput: string;
  setJoinInput: (v: string) => void;
  onlineError: string;
  setOnlineError: (v: string) => void;
  onStartGame: (count: number) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onCancelWait: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  selectionStep, setSelectionStep, platform, setPlatform,
  onlineStep, setOnlineStep, roomCode, joinInput, setJoinInput,
  onlineError, setOnlineError, onStartGame, onCreateRoom, onJoinRoom, onCancelWait,
}) => (
  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl text-white z-10 overflow-y-auto p-2 sm:p-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
    <div className="max-w-2xl w-full flex flex-col items-center my-auto py-4 sm:py-8">
      <h1 className="text-4xl md:text-6xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 tracking-tight text-center">
        Survivor Survival
      </h1>

      {selectionStep === 'platform' && (
        <div className="flex flex-col items-center w-full">
          <p className="text-neutral-400 mb-6 text-lg font-medium text-center">選擇遊玩設備</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-8 w-full justify-center">
            <button onClick={() => { setPlatform('pc'); setSelectionStep('players'); }}
              className="flex sm:flex-col items-center sm:justify-center gap-4 p-4 sm:p-8 bg-neutral-900/80 rounded-2xl border-2 border-neutral-700 hover:border-blue-500 hover:bg-neutral-800 transition-all group w-full sm:w-64 touch-manipulation">
              <div className="w-12 h-12 sm:w-20 sm:h-20 shrink-0 bg-blue-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 sm:w-10 sm:h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xl sm:text-2xl font-bold">電腦版</span>
            </button>
            <button onClick={() => { setPlatform('mobile'); setSelectionStep('players'); }}
              className="flex sm:flex-col items-center sm:justify-center gap-4 p-4 sm:p-8 bg-neutral-900/80 rounded-2xl border-2 border-neutral-700 hover:border-green-500 hover:bg-neutral-800 transition-all group w-full sm:w-64 touch-manipulation">
              <div className="w-12 h-12 sm:w-20 sm:h-20 shrink-0 bg-green-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 sm:w-10 sm:h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-2xl font-bold">手機版</span>
            </button>
          </div>
        </div>
      )}

      {selectionStep === 'players' && (
        <div className="flex flex-col items-center w-full">
          <p className="text-neutral-400 mb-6 text-lg font-medium text-center">選擇模式</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 w-full justify-center mb-4 sm:mb-6">
            <button onClick={() => onStartGame(1)}
              className="flex sm:flex-col items-center sm:justify-center gap-4 sm:gap-3 p-4 sm:p-6 bg-neutral-900/80 rounded-2xl border-2 border-neutral-700 hover:border-blue-500 hover:bg-neutral-800 transition-all group w-full sm:w-52 touch-manipulation text-left sm:text-center">
              <span className="text-2xl sm:text-3xl font-bold text-white shrink-0 w-16 text-center">1 人</span>
              <div className="flex flex-col">
                 <span className="text-sm text-neutral-400">本地單人</span>
                 {platform === 'pc' && <p className="text-blue-300 text-xs font-mono mt-1 w-full text-left sm:text-center">W A S D</p>}
              </div>
            </button>
            <button onClick={() => onStartGame(2)}
              className="flex sm:flex-col items-center sm:justify-center gap-4 sm:gap-3 p-4 sm:p-6 bg-neutral-900/80 rounded-2xl border-2 border-neutral-700 hover:border-purple-500 hover:bg-neutral-800 transition-all group w-full sm:w-52 touch-manipulation text-left sm:text-center">
              <span className="text-2xl sm:text-3xl font-bold text-white shrink-0 w-16 text-center">2 人</span>
              <div className="flex flex-col">
                 <span className="text-sm text-neutral-400">本地雙人</span>
                 {platform === 'pc' && (
                   <div className="text-xs text-left sm:text-center mt-1">
                     <span className="text-blue-300 font-mono">P1: WASD</span>
                     <span className="text-neutral-500 mx-1">/</span>
                     <span className="text-purple-300 font-mono">P2: 方向鍵</span>
                   </div>
                 )}
               </div>
            </button>
            <button onClick={() => setSelectionStep('online')}
              className="flex sm:flex-col items-center sm:justify-center gap-4 sm:gap-3 p-4 sm:p-6 bg-neutral-900/80 rounded-2xl border-2 border-neutral-700 hover:border-yellow-500 hover:bg-neutral-800 transition-all group w-full sm:w-52 touch-manipulation text-left sm:text-center">
              <span className="text-2xl sm:text-3xl font-bold text-white shrink-0 w-16 text-center">🌐</span>
              <div className="flex flex-col">
                 <span className="text-lg sm:text-xl font-bold text-white leading-none">線上</span>
                 <span className="text-sm text-neutral-400 mt-1">遠端雙人</span>
              </div>
            </button>
          </div>
          <button onClick={() => setSelectionStep('platform')} className="text-neutral-500 hover:text-white transition-colors underline underline-offset-4">返回上一步</button>
        </div>
      )}

      {selectionStep === 'online' && (
        <OnlineMenuScreen
          onlineStep={onlineStep}
          roomCode={roomCode}
          joinInput={joinInput}
          setJoinInput={setJoinInput}
          onlineError={onlineError}
          onCreateRoom={onCreateRoom}
          onJoinRoom={onJoinRoom}
          onBack={() => { setSelectionStep('players'); setOnlineError(''); }}
          onCancelWait={onCancelWait}
        />
      )}
    </div>
  </div>
);
