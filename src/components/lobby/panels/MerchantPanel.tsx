import React from 'react';
import { PanelOverlay } from './PanelOverlay';
interface Props { onClose: () => void; }
export function MerchantPanel({ onClose }: Props) {
  return (
    <PanelOverlay emoji="💰" title="商人" subtitle="永久被動強化" onClose={onClose}>
      <div className="text-gray-400 text-sm text-center py-4">（即將開放）</div>
    </PanelOverlay>
  );
}
