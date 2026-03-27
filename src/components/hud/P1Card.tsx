// ── P1Card.tsx ────────────────────────────────────────────────────────────────
import React from 'react';
import { Player } from '../../game/Player';
import { PlayerHudCard } from './PlayerHudCard';

interface P1CardProps {
  p1State: Player;
  p1RespawnCountdown: number;
}

export const P1Card: React.FC<P1CardProps> = ({ p1State, p1RespawnCountdown }) => (
  <PlayerHudCard
    player={p1State}
    respawnCountdown={p1RespawnCountdown}
    side="left"
    label="P1"
    accentColor="#60a5fa"
    levelBadgeColor="rgba(37, 99, 235, 0.42)"
  />
);
