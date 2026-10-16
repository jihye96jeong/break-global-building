// Static images only. A single-file build pre-fills window.__WB_ASSETS with data URIs.
const cache = new Map<string, Promise<HTMLImageElement | null>>();
const assetUrl = (src: string) => (window as unknown as { __WB_ASSETS?: Record<string, string> }).__WB_ASSETS?.[src] ?? src;

/** Resolves to null (never rejects, never hangs) when an image is missing: the game then draws a fallback. */
export function loadImage(src: string, timeoutMs = 8000): Promise<HTMLImageElement | null> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      const timer = window.setTimeout(() => resolve(null), timeoutMs);
      img.onload = () => { window.clearTimeout(timer); resolve(img); };
      img.onerror = () => { window.clearTimeout(timer); resolve(null); };
      img.src = assetUrl(src);
    });
    cache.set(src, p);
  }
  return p;
}

/** Already-loaded image or null; never waits. */
const ready = new Map<string, HTMLImageElement | null>();
export function preload(srcs: string[]) {
  return Promise.all(srcs.map(async (s) => { ready.set(s, await loadImage(s)); }));
}
export const imageNow = (src: string) => ready.get(src) ?? null;
export { assetUrl };
