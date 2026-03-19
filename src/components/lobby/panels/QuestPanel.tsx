import React from 'react';
import { PanelOverlay } from './PanelOverlay';
interface Props { onClose: () => void; }
export function QuestPanel({ onClose }: Props) {
  return (
    <PanelOverlay emoji="🗿" title="任務板" subtitle="成就與統計" onClose={onClose}>
      <div className="text-gray-400 text-sm text-center py-4">（即將開放）</div>
    </PanelOverlay>
  );
}
