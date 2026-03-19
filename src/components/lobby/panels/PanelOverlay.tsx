// ── PanelOverlay.tsx ──────────────────────────────────────────────────────────
// 所有 NPC 面板共用的外殼
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

interface Props {
  emoji: string;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function PanelOverlay({ emoji, title, subtitle, onClose, children }: Props) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 shadow-2xl">
        {/* 頭部 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{emoji}</span>
            <div>
              <div className="font-black text-white text-base">{title}</div>
              <div className="text-gray-500 text-xs">{subtitle}</div>
            </div>
          </div>
          <button onClick={onClose}
                  className="text-gray-500 hover:text-white text-xl cursor-pointer transition-colors">✕</button>
        </div>
        {/* 內容 */}
        {children}
      </div>
    </div>
  );
}
