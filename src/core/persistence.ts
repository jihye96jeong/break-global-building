// Best score, best combo and settings in localStorage. Every access survives a blocked or full storage.
const KEY = 'world-breaker-save-v2';

export interface Save {
  bestScore: number;
  bestCombo: number;
  sound: boolean;
  tutorialSeen: boolean;
  showHpNumbers: boolean;
}
const DEFAULTS: Save = { bestScore: 0, bestCombo: 0, sound: true, tutorialSeen: false, showHpNumbers: false };

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

export function writeSave(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: play on */ }
}

/** Fold a finished run into the save. Returns whether the score is a new record. */
export function recordRun(save: Save, score: number, maxCombo: number) {
  const record = score > save.bestScore;
  save.bestScore = Math.max(save.bestScore, score);
  save.bestCombo = Math.max(save.bestCombo, maxCombo);
  writeSave(save);
  return record;
}
