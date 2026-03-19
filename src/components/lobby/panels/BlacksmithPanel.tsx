import React from 'react';
import { PanelOverlay } from './PanelOverlay';
interface Props { onClose: () => void; }
export function BlacksmithPanel({ onClose }: Props) {
  return (
    <PanelOverlay emoji="⚒️" title="鐵匠" subtitle="花金幣強化起始武器" onClose={onClose}>
      <div className="text-gray-400 text-sm text-center py-4">（即將開放）</div>
    </PanelOverlay>
  );
}
