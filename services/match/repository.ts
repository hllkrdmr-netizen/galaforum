import type { Lineup, Match, MatchDetail, ReactionCounts, ReactionType, SquadPlayer } from '../../types/match';

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
}
