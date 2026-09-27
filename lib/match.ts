import type {
  Formation,
  Lineup,
  LineupSlot,
  Match,
  MatchEvent,
  MatchEventType,
  MatchStatus,
  ReactionCounts,
  ReactionType,
} from '../types/match';

// ---------------------------------------------------------------- formations
const GK: LineupSlot = { key: 'GK', label: 'KL', x: 50, y: 11 };
const BACK4: LineupSlot[] = [
  { key: 'LB', label: 'SLB', x: 13, y: 27 },
  { key: 'LCB', label: 'STP', x: 37, y: 22 },
  { key: 'RCB', label: 'STP', x: 63, y: 22 },
  { key: 'RB', label: 'SĞB', x: 87, y: 27 },
];

export const FORMATIONS: Record<Formation, LineupSlot[]> = {
  '4-2-3-1': [
    GK,
    ...BACK4,
    { key: 'DM1', label: 'ÖL', x: 35, y: 44 },
    { key: 'DM2', label: 'ÖL', x: 65, y: 44 },
    { key: 'LW', label: 'SLK', x: 15, y: 66 },
    { key: 'AM', label: '10', x: 50, y: 63 },
    { key: 'RW', label: 'SĞK', x: 85, y: 66 },
    { key: 'ST', label: 'FV', x: 50, y: 85 },
  ],
  '4-3-3': [
    GK,
    ...BACK4,
    { key: 'CM1', label: 'OS', x: 25, y: 49 },
    { key: 'DM', label: 'ÖL', x: 50, y: 43 },
    { key: 'CM2', label: 'OS', x: 75, y: 49 },
    { key: 'LW', label: 'SLK', x: 16, y: 76 },
    { key: 'ST', label: 'FV', x: 50, y: 84 },
    { key: 'RW', label: 'SĞK', x: 84, y: 76 },
  ],
  '3-4-3': [
    GK,
    { key: 'LCB', label: 'STP', x: 25, y: 23 },
    { key: 'CB', label: 'STP', x: 50, y: 20 },
    { key: 'RCB', label: 'STP', x: 75, y: 23 },
    { key: 'LM', label: 'SLO', x: 11, y: 51 },
    { key: 'CM1', label: 'OS', x: 38, y: 46 },
    { key: 'CM2', label: 'OS', x: 62, y: 46 },
    { key: 'RM', label: 'SĞO', x: 89, y: 51 },
    { key: 'LW', label: 'SLK', x: 20, y: 78 },
    { key: 'ST', label: 'FV', x: 50, y: 85 },
    { key: 'RW', label: 'SĞK', x: 80, y: 78 },
  ],
  '4-4-2': [
    GK,
    ...BACK4,
    { key: 'LM', label: 'SLO', x: 12, y: 53 },
    { key: 'CM1', label: 'OS', x: 38, y: 48 },
    { key: 'CM2', label: 'OS', x: 62, y: 48 },
    { key: 'RM', label: 'SĞO', x: 88, y: 53 },
    { key: 'ST1', label: 'FV', x: 36, y: 82 },
    { key: 'ST2', label: 'FV', x: 64, y: 82 },
  ],
};

export const FORMATION_LIST = Object.keys(FORMATIONS) as Formation[];

/** Keeps players whose slot key exists in the new formation (e.g. GK, back four), drops the rest. */
export function changeFormation(lineup: Lineup, formation: Formation): Lineup {
  const keys = new Set(FORMATIONS[formation].map((s) => s.key));
  const players = Object.fromEntries(Object.entries(lineup.players).filter(([k]) => keys.has(k)));
  return { ...lineup, formation, players };
}

/** Places a player in a slot; a player can only appear once, so any previous slot is cleared. */
export function assignPlayer(lineup: Lineup, slotKey: string, name: string): Lineup {
  const clean = name.trim().replace(/\s+/g, ' ');
  const players: Record<string, string> = {};
  for (const [k, v] of Object.entries(lineup.players)) if (v !== clean) players[k] = v;
  if (clean) players[slotKey] = clean;
  return { ...lineup, players };
}

export function clearSlot(lineup: Lineup, slotKey: string): Lineup {
  const players = { ...lineup.players };
  delete players[slotKey];
  return { ...lineup, players };
}

export function validateLineup(lineup: Lineup): string | null {
  const slots = FORMATIONS[lineup.formation];
  if (!slots) return 'Geçersiz diziliş.';
  const names = slots.map((s) => lineup.players[s.key]?.trim() ?? '');
  const missing = names.filter((n) => !n).length;
  if (missing > 0) return `${missing} pozisyon boş. İlk 11’i tamamla.`;
  if (names.some((n) => n.length < 2 || n.length > 40)) return 'Oyuncu adları 2–40 karakter olmalı.';
  const lower = names.map((n) => n.toLocaleLowerCase('tr-TR'));
  if (new Set(lower).size !== lower.length) return 'Aynı oyuncu iki kez seçilemez.';
  return null;
}

const LINE_NAMES: Array<[string, (s: LineupSlot) => boolean]> = [
  ['Kaleci', (s) => s.key === 'GK'],
  ['Savunma', (s) => s.key !== 'GK' && s.y < 35],
  ['Orta saha', (s) => s.y >= 35 && s.y < 72],
  ['Hücum', (s) => s.y >= 72],
];

/** Plain-text lineup for sharing into a topic (forum posts are text; renders well everywhere). */
export function lineupToText(lineup: Lineup, match?: Pick<Match, 'homeTeam' | 'awayTeam'> | null): string {
  const slots = FORMATIONS[lineup.formation];
  const header = match ? `${match.homeTeam} – ${match.awayTeam} için ilk 11’im (${lineup.formation})` : `İlk 11’im (${lineup.formation})`;
  const lines = LINE_NAMES.map(([title, test]) => {
    const players = slots
      .filter(test)
      .sort((a, b) => a.x - b.x)
      .map((s) => lineup.players[s.key]?.trim())
      .filter(Boolean);
    return players.length ? `${title}: ${players.join(' – ')}` : null;
  }).filter(Boolean);
  return [header, '', ...lines].join('\n');
}

// ---------------------------------------------------------------- match state
export function matchTitle(m: Pick<Match, 'homeTeam' | 'awayTeam'>): string {
  return `${m.homeTeam} – ${m.awayTeam}`;
}

export function matchTopicTitle(m: Pick<Match, 'homeTeam' | 'awayTeam'>): string {
  return `${matchTitle(m)} | Canlı Maç Konusu`;
}

export function isLive(status: MatchStatus): boolean {
  return status === 'live' || status === 'halftime';
}

export function statusLabel(m: Pick<Match, 'status' | 'minute'>): string {
  switch (m.status) {
    case 'live':
      return m.minute != null ? `${m.minute}'` : 'Canlı';
    case 'halftime':
      return 'Devre arası';
    case 'finished':
      return 'Maç sonu';
    case 'postponed':
      return 'Ertelendi';
    default:
      return 'Başlamadı';
  }
}

export function scoreLabel(m: Pick<Match, 'homeScore' | 'awayScore' | 'status'>): string {
  if (m.status === 'scheduled' || m.status === 'postponed' || m.homeScore == null || m.awayScore == null) return '–';
  return `${m.homeScore} – ${m.awayScore}`;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

export function countdown(targetIso: string, now: number = Date.now()): CountdownParts {
  const diff = Math.max(0, new Date(targetIso).getTime() - now);
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: diff === 0,
  };
}

const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** "Çarşamba, 30 Eylül · 20:00" in the device time zone. */
export function kickoffLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${DAYS_TR[d.getDay()]}, ${d.getDate()} ${MONTHS_TR[d.getMonth()]} · ${hh}:${mm}`;
}

export function eventMinuteLabel(e: Pick<MatchEvent, 'minute' | 'extraMinute'>): string {
  return e.extraMinute ? `${e.minute}+${e.extraMinute}'` : `${e.minute}'`;
}

export const EVENT_LABEL: Record<MatchEventType, string> = {
  goal: 'Gol',
  own_goal: 'Kendi kalesine gol',
  penalty_goal: 'Penaltı golü',
  penalty_miss: 'Kaçan penaltı',
  yellow: 'Sarı kart',
  red: 'Kırmızı kart',
  sub: 'Oyuncu değişikliği',
  var: 'VAR',
  kickoff: 'Maç başladı',
  halftime: 'Devre arası',
  fulltime: 'Maç sonu',
};

export const REACTIONS: Array<{ type: ReactionType; label: string }> = [
  { type: 'gol', label: 'Gol!' },
  { type: 'alkis', label: 'Alkış' },
  { type: 'heyecan', label: 'Heyecan' },
  { type: 'uzgun', label: 'Üzgün' },
];

export function emptyReactions(): ReactionCounts {
  return { gol: 0, alkis: 0, heyecan: 0, uzgun: 0 };
}

/** Upcoming first by kickoff; used by the hub to pick "next match". */
export function nextMatch(matches: Match[], now: number = Date.now()): Match | null {
  return (
    matches
      .filter((m) => m.status === 'scheduled' && new Date(m.kickoffAt).getTime() >= now - 3 * 3_600_000)
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0] ?? null
  );
}
