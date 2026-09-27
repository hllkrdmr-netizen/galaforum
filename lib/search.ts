import type { SearchOptions, SearchSince } from '../types/forum';

/** Turkish-aware normalisation for case/diacritic-insensitive matching (İ/ı, Ş/ş, Ğ/ğ, Ü/ü, Ö/ö, Ç/ç). */
export function normalizeTr(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits a query into normalised terms; every term must be present for a match. */
export function queryTerms(query: string): string[] {
  return normalizeTr(query)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function matchesAll(haystack: string, terms: string[]): boolean {
  if (terms.length === 0) return false;
  const h = normalizeTr(haystack);
  return terms.every((t) => h.includes(t));
}

/** Escapes LIKE/ILIKE wildcards so user input is matched literally in Postgres. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export const MIN_QUERY_LENGTH = 2;


const SINCE_MS: Record<Exclude<SearchSince, 'all'>, number> = {
  '24h': 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
  '30d': 30 * 24 * 3_600_000,
};

/** Lower bound for "activity since" filters; null means no lower bound. */
export function sinceToDate(since: SearchSince | undefined, now: number = Date.now()): Date | null {
  if (!since || since === 'all') return null;
  return new Date(now - SINCE_MS[since]);
}

/** A search runs with a query of at least MIN_QUERY_LENGTH chars, or with an author filter alone. */
export function canSearch(query: string, options: SearchOptions = {}): boolean {
  const q = query.trim();
  if (q.length > 100) return false;
  return q.length >= MIN_QUERY_LENGTH || (q.length === 0 && Boolean(options.author));
}

/** Counts how many query terms appear in the text — a simple, predictable relevance score. */
export function termScore(text: string, terms: string[]): number {
  const h = normalizeTr(text);
  return terms.reduce((sum, t) => sum + (h.includes(t) ? 1 : 0), 0);
}
