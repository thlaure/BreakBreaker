import { CONFIG } from '../sim/config';

export interface Prefs {
  muted: boolean;
  runToggle: boolean;
}

const PREFS_KEY = 'bb:prefs';
const DEFAULT_PREFS: Prefs = { muted: false, runToggle: false };

const recordKey = (cause: 'ko' | 'quit'): string => `bb:${CONFIG.rulesVersion}:${cause === 'ko' ? 'record' : 'record-quit'}`;

/** localStorage may be missing or throw (private mode, blocked data): every access is guarded. */
function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the game keeps working without persistence */
  }
}

/** Best score of the given kind (KO sessions and voluntary stops are kept apart), or null. */
export function loadRecord(cause: 'ko' | 'quit' = 'ko'): number | null {
  const v = read(recordKey(cause));
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Keeps only an improvement over the stored record of that kind. */
export function saveRecord(score: number, cause: 'ko' | 'quit'): void {
  if (!Number.isFinite(score)) return;
  const best = loadRecord(cause);
  if (best === null || score > best) write(recordKey(cause), score);
}

export function loadPrefs(): Prefs {
  const v = read(PREFS_KEY);
  if (typeof v !== 'object' || v === null) return { ...DEFAULT_PREFS };
  const o = v as Record<string, unknown>;
  return {
    muted: typeof o.muted === 'boolean' ? o.muted : DEFAULT_PREFS.muted,
    runToggle: typeof o.runToggle === 'boolean' ? o.runToggle : DEFAULT_PREFS.runToggle,
  };
}

export function savePrefs(prefs: Prefs): void {
  write(PREFS_KEY, { muted: prefs.muted, runToggle: prefs.runToggle });
}
