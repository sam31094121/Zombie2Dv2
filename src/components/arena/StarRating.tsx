// ── StarRating.tsx ────────────────────────────────────────────────────────────
// 4 格星星顯示武器等級與流派
//
// Tier 1（Lv1–4）：白色/金色星，逐格填滿
//   Lv1 ★☆☆☆  Lv2 ★★☆☆  Lv3 ★★★☆  Lv4 ★★★★
//
// Tier 2（Lv5–8 選流派後）：彩色高級星，重新從 1 顆填起
//   Lv5A ✦◇◇◇  Lv6A ✦✦◇◇  …  Lv8A ✦✦✦✦  (A=藍色)
//   Lv5B ✦◇◇◇  …  Lv8B ✦✦✦✦              (B=紅色)
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

interface StarRatingProps {
  level: number;
  branch: 'A' | 'B' | null;
  /** 'sm'=10px / 'md'=13px（預設 md） */
  size?: 'sm' | 'md';
}

export const StarRating: React.FC<StarRatingProps> = ({ level, branch, size = 'md' }) => {
  const isBranch = level >= 5 && branch !== null;

  // 已填格數（Tier1: level→1-4，Tier2: level-4→1-4）
  const filled = Math.min(4, Math.max(0, isBranch ? level - 4 : level));

  // 顏色
  const filledColor = isBranch
    ? (branch === 'A' ? '#60a5fa' : '#f87171')
    : '#fbbf24';
  const emptyColor = '#374151';

  // 彩色星使用 glow，普通星不加
  const glow = isBranch
    ? `0 0 5px ${filledColor}, 0 0 10px ${filledColor}88`
    : 'none';

  const px = size === 'sm' ? 10 : 13;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          style={{
            fontSize: px,
            lineHeight: 1,
            color: i < filled ? filledColor : emptyColor,
            textShadow: i < filled ? glow : 'none',
          }}
        >
          {isBranch
            ? (i < filled ? '✦' : '◇')
            : (i < filled ? '★' : '☆')
          }
        </span>
      ))}
    </div>
  );
};
