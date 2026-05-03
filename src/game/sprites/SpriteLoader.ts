/// <reference types="vite/client" />

const _cache = new Map<string, HTMLCanvasElement>();
const _loading = new Set<string>();
const _chromaCache = new Map<string, HTMLCanvasElement>();
const _chromaLoading = new Set<string>();

function removeBlackBg(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const id = ctx.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 25 && d[i + 1] < 25 && d[i + 2] < 25) d[i + 3] = 0;
  }

  ctx.putImageData(id, 0, 0);
  return c;
}

function removeMagentaBg(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const id = ctx.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    // Covers #FF00FF plus soft anti-aliased magenta pixels around the sprite.
    const hotMagenta = r > 150 && b > 150 && g < 150;
    const edgeMagenta = r > 90 && b > 90 && g < 150 && (r + b) > g * 2.7 && Math.abs(r - b) < 130;
    if (hotMagenta || edgeMagenta) d[i + 3] = 0;
  }

  ctx.putImageData(id, 0, 0);
  return c;
}

export function getSprite(url: string): HTMLCanvasElement | null {
  if (_cache.has(url)) return _cache.get(url)!;
  if (_loading.has(url)) return null;

  _loading.add(url);
  const img = new Image();
  img.onload = () => {
    _cache.set(url, removeBlackBg(img));
    _loading.delete(url);
  };
  img.onerror = () => _loading.delete(url);
  img.src = url;
  return null;
}

export function getChromaSprite(url: string): HTMLCanvasElement | null {
  if (_chromaCache.has(url)) return _chromaCache.get(url)!;
  if (_chromaLoading.has(url)) return null;

  _chromaLoading.add(url);
  const img = new Image();
  img.onload = () => {
    _chromaCache.set(url, removeMagentaBg(img));
    _chromaLoading.delete(url);
  };
  img.onerror = () => _chromaLoading.delete(url);
  img.src = url;
  return null;
}

export const BUTCHER_FRAME_URLS: string[] = [1, 2, 3, 4, 5].map(
  i => `${import.meta.env.BASE_URL}sprites/butcher_${i}.png`
);

export const PLAYER_WALK_SHEET_URLS: Record<number, string> = {
  1: `${import.meta.env.BASE_URL}sprites/players/player1_walk_centered_8x3.png`,
  2: `${import.meta.env.BASE_URL}sprites/players/player2_walk_red_girl_4x3.png`,
};

if (typeof window !== 'undefined') {
  BUTCHER_FRAME_URLS.forEach(url => getSprite(url));
  Object.values(PLAYER_WALK_SHEET_URLS).forEach(url => getChromaSprite(url));
}
