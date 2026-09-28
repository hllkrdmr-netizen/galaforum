import type { Lineup, Match, MatchDetail, MatchInput, MatchPatch, NewMatchEvent, ReactionCounts, ReactionType, SquadPlayer } from '../../types/match';

/** Data access for the match hub, live room and lineup builder (demo and Supabase implementations). */
export interface MatchRepository {
  readonly mode: 'demo' | 'supabase';
  /** Matches from the last 30 days and the next 60 days, ordered by kickoff. */
  listMatches(): Promise<Match[]>;
  getMatch(id: string): Promise<MatchDetail | null>;
  react(matchId: string, type: ReactionType): Promise<ReactionCounts>;
  getSquad(): Promise<SquadPlayer[]>;
  saveLineup(lineup: Lineup): Promise<{ id: string }>;
  getMyLineup(matchId: string | null): Promise<Lineup | null>;
  /**
   * Live updates for a match room (score/minute, events, new posts in its topic).
   * Returns an unsubscribe function. Implementations may fall back to polling.
   */
  subscribe(matchId: string, topicId: string | null, onChange: () => void): () => void;

  // Staff only (moderators/admins); every change is written to the moderation log.
  createMatch(input: MatchInput): Promise<{ id: string }>;
  /** Status changes also add kickoff / half-time / full-time events and reset or default score and minute. */
  updateMatch(id: string, patch: MatchPatch): Promise<void>;
  /** Goals update the score automatically. */
  addEvent(matchId: string, event: NewMatchEvent): Promise<{ id: string }>;
  deleteEvent(eventId: string): Promise<void>;
}
