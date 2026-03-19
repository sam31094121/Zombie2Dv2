import React from 'react';
import { PanelOverlay } from './PanelOverlay';
interface Props { onClose: () => void; }
export function GachaPanel({ onClose }: Props) {
  return (
    <PanelOverlay emoji="🎰" title="抽獎機" subtitle="花金幣抽角色皮膚" onClose={onClose}>
      <div className="text-gray-400 text-sm text-center py-4">（即將開放）</div>
    </PanelOverlay>
  );
}
