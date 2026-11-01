import {DEFAULT_CHARTS, POSITIONS, gradeSpot, validSpot, type Action, type ChartSet, type PracticeSpot} from './training.ts';
import {formatRange, parseRange} from './ranges.ts';

export const NOTEBOOK_KEY = 'poker-lab-notebook-v1';
export interface Attempt {id: string; at: string; spot: PracticeSpot; action: Action; mode: 'practice' | 'review'}
export interface Mistake {
  key: string; spot: PracticeSpot; firstAt: string; lastAt: string; errors: number; reviewStreak: number; archived: boolean;
}
export interface Notebook {version: 1; charts: ChartSet; attempts: Attempt[]; mistakes: Mistake[]}
export function emptyNotebook(): Notebook {return {version: 1, charts: {...DEFAULT_CHARTS}, attempts: [], mistakes: []};}
export function mistakeKey(spot: PracticeSpot): string {return `${spot.position}:${spot.hand}:${spot.reference}`;}
const validDate = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));

export function recordAttempt(book: Notebook, attempt: Attempt): Notebook {
  if (book.attempts.some(item => item.id === attempt.id)) return book;
  const compatible = gradeSpot(attempt.spot, attempt.action).compatible;
  const key = mistakeKey(attempt.spot);
  const previous = book.mistakes.find(item => item.key === key);
  let mistakes = book.mistakes;
  if (!compatible) {
    const next: Mistake = {key, spot: attempt.spot, firstAt: previous?.firstAt ?? attempt.at, lastAt: attempt.at,
      errors: (previous?.errors ?? 0) + 1, reviewStreak: 0, archived: false};
    mistakes = [next, ...mistakes.filter(item => item.key !== key)].slice(0, 200);
  } else if (attempt.mode === 'review' && previous) {
    mistakes = mistakes.map(item => item.key === key ? {...item, lastAt: attempt.at, reviewStreak: Math.min(2, item.reviewStreak + 1)} : item);
  }
  return {...book, mistakes, attempts: [...book.attempts, attempt].slice(-500)};
}

export function decodeNotebook(raw: string | null): Notebook | null {
  if (!raw || raw.length > 2000000) return null;
  try {
    const book = JSON.parse(raw) as Notebook;
    if (book.version !== 1 || !book.charts || typeof book.charts !== 'object'
      || !Array.isArray(book.attempts) || book.attempts.length > 500
      || !Array.isArray(book.mistakes) || book.mistakes.length > 200) return null;
    const charts = Object.fromEntries(POSITIONS.map(position => {
      parseRange(book.charts[position]);
      return [position, book.charts[position]];
    })) as ChartSet;
    const attemptIds = new Set<string>(), mistakeKeys = new Set<string>();
    for (const attempt of book.attempts) {
      if (!attempt || typeof attempt.id !== 'string' || !attempt.id || attempt.id.length > 160 || attemptIds.has(attempt.id)
        || !validDate(attempt.at) || !validSpot(attempt.spot) || !['raise', 'fold'].includes(attempt.action)
        || !['practice', 'review'].includes(attempt.mode)) return null;
      attemptIds.add(attempt.id);
    }
    for (const item of book.mistakes) {
      if (!item || !validSpot(item.spot) || item.key !== mistakeKey(item.spot) || mistakeKeys.has(item.key)
        || !validDate(item.firstAt) || !validDate(item.lastAt) || Date.parse(item.lastAt) < Date.parse(item.firstAt)
        || !Number.isInteger(item.errors) || item.errors < 1 || item.errors > 1000000
        || !Number.isInteger(item.reviewStreak) || item.reviewStreak < 0 || item.reviewStreak > 2
        || typeof item.archived !== 'boolean') return null;
      mistakeKeys.add(item.key);
    }
    // Reconstruct only known fields; imported counters are never trusted as a skill score.
    return {version: 1, charts, attempts: book.attempts.map(a => ({id: a.id, at: a.at, spot: a.spot, action: a.action, mode: a.mode})),
      mistakes: book.mistakes.map(m => ({key: m.key, spot: m.spot, firstAt: m.firstAt, lastAt: m.lastAt,
        errors: m.errors, reviewStreak: m.reviewStreak, archived: m.archived}))};
  } catch {return null;}
}

export function mergeNotebooks(current: Notebook, incoming: Notebook): Notebook {
  const attempts = [...new Map([...current.attempts, ...incoming.attempts].map(a => [a.id, a])).values()]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-500);
  const mistakes = new Map(current.mistakes.map(m => [m.key, m]));
  for (const item of incoming.mistakes) {
    const old = mistakes.get(item.key);
    if (!old || Date.parse(item.lastAt) > Date.parse(old.lastAt)) mistakes.set(item.key, item);
  }
  return {version: 1, charts: current.charts, attempts,
    mistakes: [...mistakes.values()].sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt)).slice(0, 200)};
}

export function notebookStats(book: Notebook) {
  const correct = book.attempts.filter(a => gradeSpot(a.spot, a.action).compatible).length;
  return {total: book.attempts.length, correct, due: book.mistakes.filter(m => !m.archived && m.reviewStreak < 2).length,
    mastered: book.mistakes.filter(m => !m.archived && m.reviewStreak === 2).length};
}
