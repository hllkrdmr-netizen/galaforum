const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** Compact Turkish relative time: "az önce", "5 dk önce", "3 sa önce", "dün", "4 gün önce", "12 Eyl". */
export function formatRelativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Math.max(0, now - t);
  if (diff < MINUTE) return 'az önce';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} dk önce`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} sa önce`;
  if (diff < 2 * DAY) return 'dün';
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} gün önce`;
  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`;
}

/** Full date for accessibility labels and post headers, e.g. "27 Eyl 2026, 14:05". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

/** Compact counts in Turkish style: 950 → "950", 1250 → "1,2 B", 2_400_000 → "2,4 Mn". */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n < 1000) return String(Math.max(0, Math.round(n)));
  if (n < 1_000_000) return `${trimDecimal(n / 1000)} B`;
  return `${trimDecimal(n / 1_000_000)} Mn`;
}

function trimDecimal(v: number): string {
  const fixed = v >= 100 ? Math.round(v).toString() : (Math.floor(v * 10) / 10).toFixed(1);
  return fixed.replace(/\.0$/, '').replace('.', ',');
}

/** Single-line preview of a post body (strips quote markers and collapses whitespace). */
export function toPreview(body: string, max = 140): string {
  const clean = body
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('>'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function initials(name: string): string {
  const parts = name.replace(/[_.-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const second = parts.length > 1 ? parts[1][0] ?? '' : parts[0][1] ?? '';
  return (first + second).toLocaleUpperCase('tr-TR');
}
