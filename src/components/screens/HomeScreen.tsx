// ── HomeScreen.tsx ────────────────────────────────────────────────────────────
// MOBA 手遊風格首頁 v2：暖灰棕背景 + 無邊框卡片 + 真實武器展示 + 戲劇字型
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { CharacterShowcase } from './CharacterShowcase';
import { OnlineMenuScreen } from './OnlineMenuScreen';

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
  platform, setPlatform,
  onlineStep, roomCode, joinInput, setJoinInput, onlineError,
  onStartGame, onCreateRoom, onJoinRoom, onCancelWait,
}) => {
  const [selectedMode,    setSelectedMode]    = useState<'arena' | 'endless'>('arena');
  const [selectedCount,   setSelectedCount]   = useState<1 | 2 | 'online'>(1);
  const [showOnlinePanel, setShowOnlinePanel] = useState(false);
  const [toast,           setToast]           = useState('');

  useEffect(() => {
    if (onlineStep !== 'menu') setShowOnlinePanel(true);
  }, [onlineStep]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleStart = () => {
    if (selectedCount === 'online') setShowOnlinePanel(true);
    else onStartGame(selectedCount, selectedMode);
  };

  const isArena = selectedMode === 'arena';

  // ── 模式色彩系統 ───────────────────────────────────────────
  const accent = isArena
    ? { main: '#c53030', glow: 'rgba(197,48,48,0.4)', btn: 'linear-gradient(135deg,#c53030,#7b1a1a)', card: 'rgba(130,18,18,0.30)' }
    : { main: '#2b6cb0', glow: 'rgba(43,108,176,0.4)',  btn: 'linear-gradient(135deg,#2b6cb0,#1a3f6f)', card: 'rgba(18,40,110,0.30)' };

  return (
    <div
      className="absolute inset-0 z-20 flex overflow-hidden"
      style={{ background: '#141210', userSelect: 'none', fontFamily: 'system-ui,-apple-system,sans-serif' }}
    >
      {/* ── Toast ──────────────────────────────────────────── */}
      {toast && (
        <div
          className="absolute top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          style={{
            background: 'rgba(255,255,255,0.09)',
            border: '1px solid rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            color: '#e5e7eb',
            fontSize: '13px',
            fontWeight: 600,
            padding: '8px 20px',
            borderRadius: '999px',
          }}
        >
          {toast}
        </div>
      )}

      {/* ══ 左側：角色展示 ════════════════════════════════════ */}
      <div
        className="relative flex-shrink-0 overflow-hidden"
        style={{ width: '44%' }}
      >
        {/* 右緣向右淡出（融入頁面背景）*/}
        <div
          className="absolute inset-y-0 right-0 z-10 pointer-events-none"
          style={{ width: '55%', background: 'linear-gradient(to right, transparent, #141210)' }}
        />
        {/* 底部淡出 */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
          style={{ height: '35%', background: 'linear-gradient(to bottom, transparent, #141210)' }}
        />

        <div style={{ width: '100%', height: '100%' }}>
          <CharacterShowcase playerColor="#4fc3f7" />
        </div>

        {/* ── 角色名牌（左下）── */}
        <div className="absolute z-20" style={{ bottom: '3rem', left: '2.2rem' }}>
          {/* 紅標籤 */}
          <div
            style={{
              display: 'inline-block',
              background: 'rgba(197,48,48,0.82)',
              color: '#fff',
              fontSize: '9px',
              fontWeight: 800,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              padding: '3px 10px',
              borderRadius: '4px',
              marginBottom: '10px',
            }}
          >
            末日倖存者
          </div>

          {/* 主標：超粗斜體大字 */}
          <div
            style={{
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '3.4rem',
              lineHeight: 0.92,
              letterSpacing: '-0.04em',
              fontStyle: 'italic',
              textShadow: '0 2px 24px rgba(0,0,0,0.9), 0 0 40px rgba(197,48,48,0.25)',
            }}
          >
            倖存者
          </div>

          {/* 副標：紅色粗斜體 */}
          <div
            style={{
              color: '#f87171',
              fontWeight: 900,
              fontSize: '3.4rem',
              lineHeight: 0.92,
              letterSpacing: '-0.04em',
              fontStyle: 'italic',
              textShadow: '0 2px 24px rgba(0,0,0,0.9), 0 0 30px rgba(248,113,113,0.4)',
            }}
          >
            末日生存
          </div>

          {/* 橫線 + 英文 */}
          <div className="flex items-center gap-3 mt-4">
            <div style={{ height: '1px', width: '2rem', background: 'rgba(255,255,255,0.28)' }} />
            <span
              style={{
                color: 'rgba(255,255,255,0.3)',
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              The Last Stand of Humanity
            </span>
          </div>
        </div>

        {/* 模式高亮底色線 */}
        <div
          className="absolute bottom-0 left-0 z-20 pointer-events-none"
          style={{
            width: '100%',
            height: '3px',
            background: `linear-gradient(to right, transparent, ${accent.main}88, transparent)`,
          }}
        />
      </div>

      {/* ══ 右側：控制面板 ════════════════════════════════════ */}
      <div
        className="flex-1 flex flex-col justify-center min-w-0 overflow-y-auto"
        style={{ padding: '1.5rem 2.8rem 1.5rem 2rem', gap: '1.05rem', display: 'flex', flexDirection: 'column' }}
      >
        {/* 遊戲標題 */}
        <div style={{ marginBottom: '0.3rem' }}>
          <h1
            style={{
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '1.55rem',
              letterSpacing: '0.04em',
              textShadow: '0 1px 12px rgba(0,0,0,0.6)',
              margin: 0,
            }}
          >
            Survivor <span style={{ color: '#f87171' }}>Survival</span>
          </h1>
          <p
            style={{
              color: '#4b5563',
              fontSize: '9px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              marginTop: '5px',
              fontWeight: 600,
            }}
          >
            Select Your Mode
          </p>
        </div>

        {/* ── 模式卡片 ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>

          {/* 競技場 */}
          <ModeCard
            onClick={() => setSelectedMode('arena')}
            selected={isArena}
            bg={isArena ? accent.card : 'rgba(255,255,255,0.038)'}
            leftBar={isArena ? '#c53030' : 'transparent'}
            glow={isArena ? '0 0 20px rgba(197,48,48,0.22)' : 'none'}
            iconBg={isArena ? 'linear-gradient(135deg,#e53e3e,#9b1c1c)' : 'rgba(197,48,48,0.18)'}
            icon="⚡"
            title="競技場"
            sub="Ranked Arena Mode"
          />

          {/* 無限 */}
          <ModeCard
            onClick={() => setSelectedMode('endless')}
            selected={!isArena}
            bg={!isArena ? accent.card : 'rgba(255,255,255,0.038)'}
            leftBar={!isArena ? '#2b6cb0' : 'transparent'}
            glow={!isArena ? '0 0 20px rgba(43,108,176,0.22)' : 'none'}
            iconBg={!isArena ? 'linear-gradient(135deg,#3182ce,#1a3f6f)' : 'rgba(43,108,176,0.18)'}
            icon="🔄"
            title="無限"
            sub="Endless Challenge"
          />
        </div>

        {/* ── 人數選擇 ─────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '4px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          {([1, 2, 'online'] as const).map(c => (
            <button
              key={c}
              onClick={() => setSelectedCount(c)}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: '7px',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '0.02em',
                transition: 'all 0.14s',
                background: selectedCount === c ? 'rgba(255,255,255,0.13)' : 'transparent',
                color:      selectedCount === c ? '#ffffff' : '#6b7280',
                border:     selectedCount === c ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              {c === 'online' ? '🌐 線上' : `${c} 人`}
            </button>
          ))}
        </div>

        {/* ── 次要按鈕（英雄庫 / 戰備商店）─────────────────── */}
        <div style={{ display: 'flex', gap: '0.55rem' }}>
          {['英雄庫', '戰備商店'].map(label => (
            <button
              key={label}
              onClick={() => showToast('即將開放')}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#6b7280',
                background: 'rgba(255,255,255,0.038)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'rgba(255,255,255,0.07)';
                el.style.color = '#9ca3af';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'rgba(255,255,255,0.038)';
                el.style.color = '#6b7280';
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 開始戰鬥 CTA ─────────────────────────────────── */}
        <button
          onClick={handleStart}
          style={{
            width: '100%',
            padding: '15px 0',
            borderRadius: '14px',
            fontWeight: 900,
            fontSize: '1.05rem',
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
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.filter = 'brightness(1.14)';
            el.style.boxShadow = `0 2px 0 rgba(0,0,0,0.4), 0 8px 40px ${accent.glow}`;
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.filter = 'brightness(1)';
            el.style.boxShadow = `0 2px 0 rgba(0,0,0,0.4), 0 6px 32px ${accent.glow}`;
          }}
          onMouseDown={e  => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
          onMouseUp={e    => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        >
          {/* 高光線 */}
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: '40%',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.12), transparent)',
              pointerEvents: 'none',
              borderRadius: '14px 14px 0 0',
            }}
          />
          {selectedCount === 'online' ? '進入線上模式  →' : '開始戰鬥  →'}
        </button>

        {/* ── 平台切換 ─────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginTop: '2px',
          }}
        >
          <span
            style={{
              color: '#374151',
              fontSize: '9px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            設備
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['pc', 'mobile'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                style={{
                  padding: '4px 14px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  transition: 'all 0.14s',
                  background: platform === p ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color:      platform === p ? '#d1d5db' : '#4b5563',
                  border:     platform === p ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {p === 'pc' ? 'PC' : '手機'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══ 線上模式 Overlay ════════════════════════════════════ */}
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
              onCancelWait={() => { onCancelWait(); setShowOnlinePanel(false); }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ── 模式卡片子元件 ──────────────────────────────────────────
interface ModeCardProps {
  onClick: () => void;
  selected: boolean;
  bg: string;
  leftBar: string;
  glow: string;
  iconBg: string;
  icon: string;
  title: string;
  sub: string;
}

function ModeCard({ onClick, bg, leftBar, glow, iconBg, icon, title, sub }: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1.05rem 1.1rem',
        borderRadius: '12px',
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
        transition: 'all 0.18s',
        background: bg,
        border: 'none',
        borderLeft: `3px solid ${leftBar}`,
        boxShadow: glow,
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.filter = 'brightness(1.10)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.filter = 'brightness(1)';
      }}
    >
      {/* 圖示方塊 */}
      <div
        style={{
          width: '68px',
          height: '68px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.75rem',
          flexShrink: 0,
          background: iconBg,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      >
        {icon}
      </div>

      {/* 文字 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '1.35rem',
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: '#6b7280',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}
        >
          {sub}
        </div>
      </div>

      {/* 箭頭 */}
      <svg
        width="18" height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#4b5563"
        strokeWidth="2.5"
        style={{ flexShrink: 0 }}
      >
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  );
}
