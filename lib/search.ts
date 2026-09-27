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
