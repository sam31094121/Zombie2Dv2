import { useSyncExternalStore } from 'react';

export interface HudLayout {
  cardWidth: number;
  topOffset: number;
  sideOffset: number;
  headerGap: number;
  headerMarginBottom: number;
  labelFontSize: number;
  badgeFontSize: number;
  badgePaddingX: number;
  badgePaddingY: number;
  hpHeight: number;
  xpHeight: number;
  barGap: number;
  barLabelFontSize: number;
  barValueFontSize: number;
  compactBarLabelFontSize: number;
  compactBarValueFontSize: number;
  respawnHeight: number;
  respawnFontSize: number;
  respawnMarginBottom: number;
}

const FALLBACK_VIEWPORT = { width: 1280, height: 720 };
let cachedViewport = FALLBACK_VIEWPORT;

function readViewport() {
  if (typeof window === 'undefined') return cachedViewport;

  const width = window.innerWidth || FALLBACK_VIEWPORT.width;
  const height = window.innerHeight || FALLBACK_VIEWPORT.height;

  if (cachedViewport.width === width && cachedViewport.height === height) {
    return cachedViewport;
  }

  cachedViewport = { width, height };
  return cachedViewport;
}

function subscribeViewport(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('resize', callback);
  window.addEventListener('orientationchange', callback);
  return () => {
    window.removeEventListener('resize', callback);
    window.removeEventListener('orientationchange', callback);
  };
}

export function getHudLayout(width: number, height: number): HudLayout {
  const safeWidth = Math.max(320, width);
  const safeHeight = Math.max(320, height);
  const shortSide = Math.min(safeWidth, safeHeight);
  const longSide = Math.max(safeWidth, safeHeight);
  const isPortrait = safeHeight >= safeWidth;
  const isMobileLike = shortSide <= 820;

  let scale = shortSide / 900;
  if (isMobileLike) scale *= isPortrait ? 0.84 : 0.9;
  if (longSide >= 1600) scale *= 1.06;
  scale = Math.max(0.62, Math.min(1.02, scale));

  const cardWidth = Math.round(Math.max(180, Math.min(320, 280 * scale + (isPortrait ? -12 : 0))));
  const topOffset = Math.round(Math.max(8, Math.min(20, 14 * scale)));
  const sideOffset = Math.round(Math.max(8, Math.min(18, 14 * scale)));
  const labelFontSize = Math.round(Math.max(13, Math.min(28, 20 * scale)));
  const badgeFontSize = Math.round(Math.max(10, Math.min(18, 13 * scale)));
  const badgePaddingX = Math.round(Math.max(7, Math.min(12, 10 * scale)));
  const badgePaddingY = Math.round(Math.max(4, Math.min(7, 6 * scale)));
  const hpHeight = Math.round(Math.max(12, Math.min(18, 18 * scale)));
  const xpHeight = Math.round(Math.max(7, Math.min(11, 10 * scale)));
  const barLabelFontSize = Math.round(Math.max(10, Math.min(14, 12 * scale)));
  const barValueFontSize = Math.round(Math.max(10, Math.min(14, 12 * scale)));
  const compactBarLabelFontSize = Math.round(Math.max(8, Math.min(12, 10 * scale)));
  const compactBarValueFontSize = Math.round(Math.max(8, Math.min(12, 10 * scale)));
  const respawnHeight = Math.round(Math.max(12, Math.min(18, 16 * scale)));
  const respawnFontSize = Math.round(Math.max(10, Math.min(13, 12 * scale)));

  return {
    cardWidth,
    topOffset,
    sideOffset,
    headerGap: Math.round(Math.max(4, Math.min(10, 8 * scale))),
    headerMarginBottom: Math.max(4, Math.round(4 * scale)),
    labelFontSize,
    badgeFontSize,
    badgePaddingX,
    badgePaddingY,
    hpHeight,
    xpHeight,
    barGap: Math.max(3, Math.round(4 * scale)),
    barLabelFontSize,
    barValueFontSize,
    compactBarLabelFontSize,
    compactBarValueFontSize,
    respawnHeight,
    respawnFontSize,
    respawnMarginBottom: Math.max(3, Math.round(4 * scale)),
  };
}

export function useHudLayout() {
  const viewport = useSyncExternalStore(subscribeViewport, readViewport, () => FALLBACK_VIEWPORT);
  return getHudLayout(viewport.width, viewport.height);
}
