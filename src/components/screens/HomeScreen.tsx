import React, { useEffect, useMemo, useState } from 'react';
import { CharacterShowcase } from './CharacterShowcase';
import { OnlineMenuScreen } from './OnlineMenuScreen';
import { QRCodeCanvas } from 'qrcode.react';

interface Props {
  platform: 'pc' | 'mobile';
  setPlatform: (v: 'pc' | 'mobile') => void;
  onlineStep: 'menu' | 'waiting' | 'joining';
  roomCode: string;
  joinInput: string;
  setJoinInput: (v: string) => void;
  onlineError: string;
  onStartGame: (count: number, mode: 'endless' | 'arena') => void;
  onCreateRoom: (mode: 'endless' | 'arena') => void;
  onJoinRoom: () => void;
  onCancelWait: () => void;
}

export const HomeScreen: React.FC<Props> = ({
  platform,
  setPlatform,
  onlineStep,
  roomCode,
  joinInput,
  setJoinInput,
  onlineError,
  onStartGame,
  onCreateRoom,
  onJoinRoom,
  onCancelWait,
}) => {
  const [selectedMode, setSelectedMode] = useState<'arena' | 'endless'>('arena');
  const [selectedCount, setSelectedCount] = useState<1 | 2 | 'online'>(1);
  const [showOnlinePanel, setShowOnlinePanel] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [toast, setToast] = useState('');
  const [vp, setVp] = useState(() => ({
    w: typeof window === 'undefined' ? 1200 : window.innerWidth,
    h: typeof window === 'undefined' ? 800 : window.innerHeight,
  }));

  useEffect(() => {
    if (onlineStep !== 'menu') setShowOnlinePanel(true);
  }, [onlineStep]);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const touchDevice = navigator.maxTouchPoints > 0;
    const mobileUA = /android|iphone|ipad|ipod|mobile/.test(ua);
    const detectedPlatform: 'pc' | 'mobile' =
      mobileUA || (coarsePointer && touchDevice) ? 'mobile' : 'pc';
    setPlatform(detectedPlatform);
  }, [setPlatform]);

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2500);
  };

  const handleStart = () => {
    if (selectedCount === 'online') {
      setShowOnlinePanel(true);
      return;
    }
    onStartGame(selectedCount, selectedMode);
  };

  const isArena = selectedMode === 'arena';
  const isPhonePortrait = vp.w <= 768 && vp.h > vp.w;
  const isNarrow = vp.w <= 1024;

  const accent = useMemo(
    () =>
      isArena
        ? {
            main: '#c53030',
            glow: 'rgba(197,48,48,0.4)',
            btn: 'linear-gradient(135deg,#c53030,#7b1a1a)',
            card: 'rgba(130,18,18,0.30)',
            iconBg: 'linear-gradient(135deg,#e53e3e,#9b1c1c)',
          }
        : {
            main: '#2b6cb0',
            glow: 'rgba(43,108,176,0.4)',
            btn: 'linear-gradient(135deg,#2b6cb0,#1a3f6f)',
            card: 'rgba(18,40,110,0.30)',
            iconBg: 'linear-gradient(135deg,#3182ce,#1a3f6f)',
          },
    [isArena],
  );

  return (
    <div
      className="absolute inset-0 z-20 overflow-hidden"
      style={{
        background: '#141210',
        userSelect: 'none',
        fontFamily: 'system-ui,-apple-system,sans-serif',
      }}
    >
      {toast && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.18)',
            backdropFilter: 'blur(10px)',
            color: '#e5e7eb',
            fontSize: 13,
            fontWeight: 600,
            padding: '8px 18px',
            borderRadius: 999,
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: isPhonePortrait ? 'column' : 'row',
          height: '100%',
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            width: isPhonePortrait ? '100%' : isNarrow ? '42%' : '44%',
            height: isPhonePortrait ? '38vh' : '100%',
            minHeight: isPhonePortrait ? 250 : undefined,
            flexShrink: 0,
          }}
        >
          <div
            className="absolute inset-y-0 right-0 z-10 pointer-events-none"
            style={{
              width: isPhonePortrait ? '35%' : '55%',
              background: 'linear-gradient(to right, transparent, #141210)',
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
            style={{
              height: isPhonePortrait ? '42%' : '35%',
              background: 'linear-gradient(to bottom, transparent, #141210)',
            }}
          />

          <div style={{ width: '100%', height: '100%' }}>
            <CharacterShowcase playerColor="#4fc3f7" />
          </div>

          <div
            className="absolute z-20"
            style={{
              bottom: isPhonePortrait ? '1rem' : '3rem',
              left: isPhonePortrait ? '1rem' : '2.2rem',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(197,48,48,0.82)',
                color: '#fff',
                fontSize: isPhonePortrait ? 8 : 9,
                fontWeight: 800,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                padding: '3px 10px',
                borderRadius: 4,
                marginBottom: 8,
              }}
            >
              最後倖存者
            </div>

            <div
              style={{
                color: '#ffffff',
                fontWeight: 900,
                fontSize: isPhonePortrait ? 'clamp(2rem,9vw,2.8rem)' : '3.4rem',
                lineHeight: 0.92,
                letterSpacing: '-0.04em',
                fontStyle: 'italic',
                textShadow: '0 2px 24px rgba(0,0,0,0.9), 0 0 40px rgba(197,48,48,0.25)',
              }}
            >
              倖存者
            </div>
            <div
              style={{
                color: '#f87171',
                fontWeight: 900,
                fontSize: isPhonePortrait ? 'clamp(2rem,9vw,2.8rem)' : '3.4rem',
                lineHeight: 0.92,
                letterSpacing: '-0.04em',
                fontStyle: 'italic',
                textShadow: '0 2px 24px rgba(0,0,0,0.9), 0 0 30px rgba(248,113,113,0.4)',
              }}
            >
              末日生存
            </div>

            {!isPhonePortrait && (
              <div className="flex items-center gap-3 mt-4">
                <div style={{ height: 1, width: '2rem', background: 'rgba(255,255,255,0.28)' }} />
                <span
                  style={{
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }}
                >
                  The Last Stand of Humanity
                </span>
              </div>
            )}
          </div>

          <div
            className="absolute bottom-0 left-0 z-20 pointer-events-none"
            style={{
              width: '100%',
              height: 3,
              background: `linear-gradient(to right, transparent, ${accent.main}88, transparent)`,
            }}
          />
        </div>

        <div
          className="flex-1 min-w-0"
          style={{
            overflowY: 'auto',
            padding: isPhonePortrait
              ? '0.9rem 0.9rem calc(5.8rem + env(safe-area-inset-bottom))'
              : isNarrow
                ? '1.2rem 1.5rem 1.2rem 1.2rem'
                : '1.5rem 2.8rem 1.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: isPhonePortrait ? 'flex-start' : 'center',
            gap: isPhonePortrait ? '0.65rem' : '1rem',
          }}
        >
          <div style={{ marginBottom: isPhonePortrait ? 2 : 4 }}>
            <h1
              style={{
                color: '#ffffff',
                fontWeight: 900,
                fontSize: isPhonePortrait ? 'clamp(1.12rem,5.2vw,1.5rem)' : '1.55rem',
                letterSpacing: '0.03em',
                textShadow: '0 1px 12px rgba(0,0,0,0.6)',
                margin: 0,
              }}
            >
              Survivor <span style={{ color: '#f87171' }}>Survival</span>
            </h1>
            <p
              style={{
                color: '#4b5563',
                fontSize: isPhonePortrait ? 8 : 9,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              Select Your Mode
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: isPhonePortrait ? '0.5rem' : '0.6rem' }}>
            <ModeCard
              onClick={() => setSelectedMode('arena')}
              bg={isArena ? accent.card : 'rgba(255,255,255,0.038)'}
              leftBar={isArena ? '#c53030' : 'transparent'}
              glow={isArena ? '0 0 20px rgba(197,48,48,0.22)' : 'none'}
              iconBg={isArena ? accent.iconBg : 'rgba(197,48,48,0.18)'}
              icon="⚡"
              title="競技場"
              sub="Ranked Arena Mode"
              compact={isPhonePortrait}
            />

            <ModeCard
              onClick={() => setSelectedMode('endless')}
              bg={!isArena ? accent.card : 'rgba(255,255,255,0.038)'}
              leftBar={!isArena ? '#2b6cb0' : 'transparent'}
              glow={!isArena ? '0 0 20px rgba(43,108,176,0.22)' : 'none'}
              iconBg={!isArena ? accent.iconBg : 'rgba(43,108,176,0.18)'}
              icon="🔁"
              title="無限"
              sub="Endless Challenge"
              compact={isPhonePortrait}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            {([1, 2, 'online'] as const).map(c => (
              <button
                key={c}
                onClick={() => setSelectedCount(c)}
                style={{
                  flex: 1,
                  padding: isPhonePortrait ? '8px 0' : '9px 0',
                  borderRadius: 7,
                  fontWeight: 700,
                  fontSize: isPhonePortrait ? 11 : 12,
                  letterSpacing: '0.02em',
                  transition: 'all 0.14s',
                  background: selectedCount === c ? 'rgba(255,255,255,0.13)' : 'transparent',
                  color: selectedCount === c ? '#ffffff' : '#6b7280',
                  border: selectedCount === c ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {c === 'online' ? '🌐 線上' : `${c} 人`}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.55rem' }}>
            {['英雄庫', '戰備商店'].map(label => (
              <button
                key={label}
                onClick={() => showToast('功能開發中')}
                style={{
                  flex: 1,
                  padding: isPhonePortrait ? '9px 0' : '10px 0',
                  borderRadius: 10,
                  fontSize: isPhonePortrait ? 11 : 12,
                  fontWeight: 600,
                  color: '#6b7280',
                  background: 'rgba(255,255,255,0.038)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 2,
            }}
          >
            <span
              style={{
                color: '#374151',
                fontSize: 9,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              設備
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['pc', 'mobile'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  style={{
                    padding: '4px 14px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    transition: 'all 0.14s',
                    background: platform === p ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: platform === p ? '#d1d5db' : '#4b5563',
                    border: platform === p ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  {p === 'pc' ? 'PC' : '手機'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowShareModal(true)}
              style={{
                marginLeft: 'auto',
                padding: '4px 14px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(234,179,8,0.12)',
                color: '#fbbf24',
                border: '1px solid rgba(234,179,8,0.25)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s',
              }}
            >
              <span>🔗</span> 分享
            </button>
          </div>

          <div
            style={
              isPhonePortrait
                ? {
                    position: 'fixed',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 30,
                    padding: '0.6rem 0.9rem calc(0.7rem + env(safe-area-inset-bottom))',
                    background: 'linear-gradient(to top, rgba(20,18,16,0.96), rgba(20,18,16,0.7), rgba(20,18,16,0))',
                  }
                : { marginTop: '0.25rem' }
            }
          >
            <button
              onClick={handleStart}
              style={{
                width: '100%',
                padding: isPhonePortrait ? '13px 0' : '15px 0',
                borderRadius: isPhonePortrait ? 12 : 14,
                fontWeight: 900,
                fontSize: isPhonePortrait ? '0.96rem' : '1.05rem',
                letterSpacing: '0.1em',
                color: '#fff',
                background: accent.btn,
                boxShadow: `0 2px 0 rgba(0,0,0,0.4), 0 6px 32px ${accent.glow}`,
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                transition: 'filter 0.15s, transform 0.1s',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '40%',
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.12), transparent)',
                  pointerEvents: 'none',
                  borderRadius: isPhonePortrait ? '12px 12px 0 0' : '14px 14px 0 0',
                }}
              />
              {selectedCount === 'online' ? '開始連線' : '開始戰鬥'}
            </button>
          </div>
        </div>
      </div>

      {showOnlinePanel && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(12px)' }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '21rem',
              margin: '0 1.5rem',
              borderRadius: '1.5rem',
              padding: '2rem',
              background: '#1c1a18',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 12px 60px rgba(0,0,0,0.6)',
            }}
          >
            <OnlineMenuScreen
              onlineStep={onlineStep}
              roomCode={roomCode}
              joinInput={joinInput}
              setJoinInput={setJoinInput}
              onlineError={onlineError}
              onCreateRoom={() => onCreateRoom(selectedMode)}
              onJoinRoom={onJoinRoom}
              onBack={() => setShowOnlinePanel(false)}
              onCancelWait={() => {
                onCancelWait();
                setShowOnlinePanel(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div
          className="absolute inset-0 z-[60] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden"
            style={{
              background: '#1c1a18',
              borderRadius: 24,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8 flex flex-col items-center text-center">
              <div className="mb-6 p-4 bg-white rounded-2xl shadow-xl">
                <QRCodeCanvas 
                  value={window.location.origin + window.location.pathname} 
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <h3 className="text-xl font-black text-white mb-2">掃描玩遊戲</h3>
              <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
                邀請朋友一起加入這場<br />末日生存之戰！
              </p>
              
              <div className="w-full flex flex-col gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + window.location.pathname);
                    showToast('連結已複製到剪貼簿');
                    setShowShareModal(false);
                  }}
                  className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-colors border border-white/5"
                >
                  複製連結
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-full py-3 text-neutral-500 font-bold hover:text-white transition-colors"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ModeCardProps {
  onClick: () => void;
  bg: string;
  leftBar: string;
  glow: string;
  iconBg: string;
  icon: string;
  title: string;
  sub: string;
  compact?: boolean;
}

function ModeCard({ onClick, bg, leftBar, glow, iconBg, icon, title, sub, compact = false }: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '0.7rem' : '1rem',
        padding: compact ? '0.82rem 0.9rem' : '1.05rem 1.1rem',
        borderRadius: 12,
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
        transition: 'all 0.18s',
        background: bg,
        border: 'none',
        borderLeft: `3px solid ${leftBar}`,
        boxShadow: glow,
      }}
    >
      <div
        style={{
          width: compact ? 54 : 68,
          height: compact ? 54 : 68,
          borderRadius: compact ? 11 : 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? '1.35rem' : '1.75rem',
          flexShrink: 0,
          background: iconBg,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: '#ffffff',
            fontWeight: 900,
            fontSize: compact ? '1.15rem' : '1.35rem',
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: '#6b7280',
            fontSize: compact ? 8 : 9,
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginTop: 4,
          }}
        >
          {sub}
        </div>
      </div>

      <svg
        width={compact ? 14 : 18}
        height={compact ? 14 : 18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#4b5563"
        strokeWidth="2.5"
        style={{ flexShrink: 0 }}
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}
