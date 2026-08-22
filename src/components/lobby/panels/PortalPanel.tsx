// ── PortalPanel.tsx ───────────────────────────────────────────────────────────
import React from 'react';
import { PanelOverlay } from './PanelOverlay';

interface Props {
  onStart: (difficulty: 'normal' | 'hard' | 'infinite') => void;
  onClose: () => void;
  isInfiniteUnlocked: boolean;
}

const MODES: { key: 'normal' | 'hard' | 'infinite'; emoji: string; name: string; desc: string; color: string }[] = [
  { key: 'normal',   emoji: '🟢', name: '普通',   desc: '殭屍速度正常，適合練習',      color: '#aed581' },
  { key: 'hard',     emoji: '🔴', name: '困難',   desc: '更多殭屍，更快速度，更高傷害', color: '#ff8a65' },
  { key: 'infinite', emoji: '💀', name: '無限',   desc: '無盡波次，挑戰極限',          color: '#ce93d8' },
];

export function PortalPanel({ onStart, onClose, isInfiniteUnlocked }: Props) {
  return (
    <PanelOverlay emoji="🌀" title="傳送門" subtitle="選擇難度進入遊戲" onClose={onClose}>
      <div className="flex flex-col gap-3 mt-2">
        {MODES.map(m => (
          (() => {
            const isLocked = m.key === 'infinite' && !isInfiniteUnlocked;
            return <button
              key={m.key}
              disabled={isLocked}
              onClick={() => onStart(m.key)}
              className="flex items-center gap-3 p-3 rounded-lg border transition-all"
              style={{
                borderColor: isLocked ? '#616161' : m.color,
                background: isLocked ? '#42424218' : m.color + '18',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.55 : 1,
              }}
            >
            <span className="text-2xl">{isLocked ? '🔒' : m.emoji}</span>
            <div className="text-left">
              <div className="font-black text-sm" style={{ color: m.color }}>{m.name}</div>
              <div className="text-xs text-gray-400">{isLocked ? '通關競技場才可以解鎖' : m.desc}</div>
            </div>
          </button>
          })()
        ))}
      </div>
    </PanelOverlay>
  );
}
