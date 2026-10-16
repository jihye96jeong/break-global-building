// v5 §9: story progress in localStorage, separate from the endless records. Pure functions + an injectable storage
// so the unlock rules are testable; every write is read → update → write, and failures are reported, never hidden.
import { STORY_LEVELS } from './stages';

export const STORY_SAVE_KEY = 'world-breaker:story:v5';

export interface LevelRecord { cleared: boolean; bestStars: number; bestScore: number; bestCombo: number }
export interface StoryProgress {
  schemaVersion: 5;
  unlockedLevel: number; // 1..10
  highestClearedLevel: number; // 0..10
  levels: Record<string, LevelRecord>;
  totalStars: number; // derived: sum of bestStars
}

export const defaultProgress = (): StoryProgress => ({ schemaVersion: 5, unlockedLevel: 1, highestClearedLevel: 0, levels: {}, totalStars: 0 });

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

const clampInt = (v: unknown, lo: number, hi: number, d: number) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v as number)) : d);

/** Validate whatever was stored; anything broken falls back to defaults (and says so). */
export function parseProgress(raw: string | null): { progress: StoryProgress; corrupted: boolean } {
  if (!raw) return { progress: defaultProgress(), corrupted: false };
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || o.schemaVersion !== 5) throw new Error('schema');
    const p = defaultProgress();
    p.unlockedLevel = clampInt(o.unlockedLevel, 1, STORY_LEVELS, 1);
    p.highestClearedLevel = clampInt(o.highestClearedLevel, 0, STORY_LEVELS, 0);
    for (let l = 1; l <= STORY_LEVELS; l++) {
      const r = o.levels?.[l];
      if (!r) continue;
      p.levels[l] = { cleared: !!r.cleared, bestStars: clampInt(r.bestStars, 0, 3, 0), bestScore: Math.max(0, Number(r.bestScore) || 0), bestCombo: Math.max(0, Number(r.bestCombo) || 0) };
    }
    p.totalStars = totalStars(p);
    return { progress: p, corrupted: false };
  } catch { return { progress: defaultProgress(), corrupted: true }; }
}

export const totalStars = (p: StoryProgress) => Object.values(p.levels).reduce((a, r) => a + r.bestStars, 0);

/** v5 §9.2: the one gate for every way into a level (map, keyboard, URL, code). */
export function canEnterStoryLevel(level: unknown, p: StoryProgress) {
  return Number.isInteger(level) && (level as number) >= 1 && (level as number) <= STORY_LEVELS && (level as number) <= p.unlockedLevel;
}

/** Stars (v5 §8.3): 1 = cleared, 2 = cleared with ≥1 life lost but some left… i.e. lives left ≥ 2, 3 = no damage. */
export function starsFor(livesLeft: number, livesMax = 3) {
  if (livesLeft >= livesMax) return 3;
  if (livesLeft >= 2) return 2;
  return 1;
}

export interface ClearResult { progress: StoryProgress; newlyUnlocked: number | null; stars: number; newBestStars: boolean }

/** Fold one stage clear into the progress (pure). Bests only ever go up; unlock only moves forward by one. */
export function applyClear(prev: StoryProgress, level: number, score: number, combo: number, livesLeft: number): ClearResult {
  const p: StoryProgress = JSON.parse(JSON.stringify(prev));
  const stars = starsFor(livesLeft);
  const old = p.levels[level] ?? { cleared: false, bestStars: 0, bestScore: 0, bestCombo: 0 };
  p.levels[level] = { cleared: true, bestStars: Math.max(old.bestStars, stars), bestScore: Math.max(old.bestScore, score), bestCombo: Math.max(old.bestCombo, combo) };
  p.highestClearedLevel = Math.max(p.highestClearedLevel, level);
  const before = p.unlockedLevel;
  p.unlockedLevel = Math.min(STORY_LEVELS, Math.max(p.unlockedLevel, level + 1));
  p.totalStars = totalStars(p);
  return { progress: p, newlyUnlocked: p.unlockedLevel > before ? p.unlockedLevel : null, stars, newBestStars: stars > old.bestStars };
}

export class StoryStore {
  progress: StoryProgress;
  corrupted: boolean;
  private committed = new Set<string>(); // stage attempts already saved (a clear is committed exactly once)
  constructor(private kv: KV | null) {
    let raw: string | null = null;
    try { raw = kv?.getItem(STORY_SAVE_KEY) ?? null; } catch { raw = null; }
    const r = parseProgress(raw);
    this.progress = r.progress;
    this.corrupted = r.corrupted;
  }

  /** Commit a clear once per attempt id. Returns null if this attempt was already committed. */
  commitClear(attemptId: string, level: number, score: number, combo: number, livesLeft: number): (ClearResult & { saved: boolean }) | null {
    if (this.committed.has(attemptId)) return null;
    this.committed.add(attemptId);
    // read → update → write (another tab may have saved meanwhile)
    let latest = this.progress;
    try { const raw = this.kv?.getItem(STORY_SAVE_KEY); if (raw) { const r = parseProgress(raw); if (!r.corrupted) latest = r.progress; } } catch { /* keep memory copy */ }
    const res = applyClear(latest, level, score, combo, livesLeft);
    this.progress = res.progress;
    return { ...res, saved: this.write() };
  }

  write() {
    try { this.kv?.setItem(STORY_SAVE_KEY, JSON.stringify(this.progress)); return !!this.kv; } catch { return false; }
  }

  reset() {
    this.progress = defaultProgress();
    try { this.kv?.removeItem(STORY_SAVE_KEY); } catch { /* ignore */ }
  }
}
