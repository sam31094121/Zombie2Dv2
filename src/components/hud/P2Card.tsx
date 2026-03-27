// ── P2Card.tsx ────────────────────────────────────────────────────────────────
import React from 'react';
import { Player } from '../../game/Player';
import { PlayerHudCard } from './PlayerHudCard';

interface P2CardProps {
  p2State: Player;
  p2RespawnCountdown: number;
}

export const P2Card: React.FC<P2CardProps> = ({ p2State, p2RespawnCountdown }) => (
  <PlayerHudCard
    player={p2State}
    respawnCountdown={p2RespawnCountdown}
    side="right"
    label="P2"
    accentColor="#4ade80"
    levelBadgeColor="rgba(22, 163, 74, 0.42)"
  />
);
