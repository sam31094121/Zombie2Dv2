// ── SpriteLoader.ts ───────────────────────────────────────────────────────────
// 自動去黑背景 + 快取精靈圖
// ─────────────────────────────────────────────────────────────────────────────

const _cache  = new Map<string, HTMLCanvasElement>();
const _loading = new Set<string>();

/** 把純黑像素變透明（一次性，載入後快取） */
function removeBlackBg(img: HTMLImageElement): HTMLCanvasElement {
  const c   = document.createElement('canvas');
  c.width   = img.naturalWidth;
  c.height  = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const id  = ctx.getImageData(0, 0, c.width, c.height);
  const d   = id.data;
  for (let i = 0; i < d.length; i += 4) {
    // 純黑 / 近黑 → 透明
    if (d[i] < 25 && d[i + 1] < 25 && d[i + 2] < 25) d[i + 3] = 0;
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

/** 取得已快取的 canvas；若尚未載入則觸發載入並回傳 null */
export function getSprite(url: string): HTMLCanvasElement | null {
  if (_cache.has(url))   return _cache.get(url)!;
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

// ── 屠夫幀列表（依檔名 1~5 排序）────────────────────────────────────────────
export const BUTCHER_FRAME_URLS: string[] = [1, 2, 3, 4, 5].map(
  i => `/sprites/butcher_${i}.png`
);

// 預載入
if (typeof window !== 'undefined') {
  BUTCHER_FRAME_URLS.forEach(url => getSprite(url));
}
