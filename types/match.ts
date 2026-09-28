export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed';

export interface Match {
  id: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  venue: string;
  status: MatchStatus;
  /** Official minute while live (e.g. 67). Null before kickoff / after full time. */
  minute: number | null;
  homeScore: number | null;
  awayScore: number | null;
  /** Auto-generated discussion topic: "<Ev> – <Deplasman> | Canlı Maç Konusu". */
  topicId: string | null;
}

export type MatchEventType = 'goal' | 'own_goal' | 'penalty_goal' | 'penalty_miss' | 'yellow' | 'red' | 'sub' | 'var' | 'kickoff' | 'halftime' | 'fulltime';

export interface MatchEvent {
  id: string;
  matchId: string;
  minute: number;
  /** Stoppage time, e.g. 45+2 → minute 45, extra 2 */
  extraMinute: number | null;
  type: MatchEventType;
  side: 'home' | 'away' | null;
  player: string | null;
  detail: string | null;
  createdAt: string;
}

export type ReactionType = 'gol' | 'alkis' | 'heyecan' | 'uzgun';

export type ReactionCounts = Record<ReactionType, number>;

export interface MatchDetail {
  match: Match;
  events: MatchEvent[];
  reactions: ReactionCounts;
}

export type Formation = '4-2-3-1' | '4-3-3' | '3-4-3' | '4-4-2';

export interface LineupSlot {
  /** Slot key, e.g. "GK", "LB", "CM1" */
  key: string;
  /** Short Turkish position label */
  label: string;
  /** Pitch position in percent: x 0 (left) → 100 (right), y 0 (own goal) → 100 (opponent goal) */
  x: number;
  y: number;
}

export interface Lineup {
  id?: string;
  matchId: string | null;
  formation: Formation;
  /** slot key → player name */
  players: Record<string, string>;
}

export interface SquadPlayer {
  id: string;
  name: string;
  number: number | null;
  position: 'GK' | 'DF' | 'MF' | 'FW';
}

// ---------------------------------------------------------------- staff match administration
export interface MatchInput {
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  venue: string;
}

export interface MatchPatch {
  competition?: string;
  homeTeam?: string;
  awayTeam?: string;
  kickoffAt?: string;
  venue?: string;
  status?: MatchStatus;
  minute?: number | null;
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface NewMatchEvent {
  minute: number;
  extraMinute: number | null;
  type: MatchEventType;
  /** Team of the player involved (an own goal counts for the other side). */
  side: 'home' | 'away' | null;
  player: string | null;
  detail: string | null;
}
