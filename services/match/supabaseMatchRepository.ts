import type { SupabaseClient } from '@supabase/supabase-js';

import { emptyReactions, validateLineup } from '../../lib/match';
import type { Formation, Match, MatchDetail, MatchEvent, ReactionCounts, SquadPlayer } from '../../types/match';
import { ForumError } from '../forum/repository';
import type { MatchRepository } from './repository';

interface MatchRow {
  id: string;
  competition: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  venue: string;
  status: Match['status'];
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  topic_id: string | null;
}
interface EventRow {
  id: string;
  match_id: string;
  minute: number;
  extra_minute: number | null;
  type: MatchEvent['type'];
  side: MatchEvent['side'];
  player: string | null;
  detail: string | null;
  created_at: string;
}

const MATCH_COLS = 'id, competition, home_team, away_team, kickoff_at, venue, status, minute, home_score, away_score, topic_id';

const toMatch = (r: MatchRow): Match => ({
  id: r.id,
  competition: r.competition,
  homeTeam: r.home_team,
  awayTeam: r.away_team,
  kickoffAt: r.kickoff_at,
  venue: r.venue,
  status: r.status,
  minute: r.minute,
  homeScore: r.home_score,
  awayScore: r.away_score,
  topicId: r.topic_id,
});

const toEvent = (r: EventRow): MatchEvent => ({
  id: r.id,
  matchId: r.match_id,
  minute: r.minute,
  extraMinute: r.extra_minute,
  type: r.type,
  side: r.side,
  player: r.player,
  detail: r.detail,
  createdAt: r.created_at,
});

function fail(error: { message: string; code?: string }, fallback: string): never {
  if (/fetch|network|timeout/i.test(error.message)) throw new ForumError('Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.', 'network');
  if (error.code === '28000') throw new ForumError('Bu işlem için giriş yapmalısın.', 'auth_required');
  if (error.message.includes('rate_limited')) throw new ForumError('Biraz yavaş: 3 saniyede bir tepki verebilirsin.', 'validation');
  if (error.message.includes('match_not_live')) throw new ForumError('Tepkiler yalnızca maç sırasında açık.', 'validation');
  throw new ForumError(fallback, 'unknown');
}

export function createSupabaseMatchRepository(sb: SupabaseClient): MatchRepository {
  return {
    mode: 'supabase',

    async listMatches() {
      const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const to = new Date(Date.now() + 60 * 86_400_000).toISOString();
      const { data, error } = await sb.from('matches').select(MATCH_COLS).gte('kickoff_at', from).lte('kickoff_at', to).order('kickoff_at').limit(60);
      if (error) fail(error, 'Maçlar yüklenemedi.');
      return ((data ?? []) as MatchRow[]).map(toMatch);
    },

    async getMatch(id): Promise<MatchDetail | null> {
      const [m, e, r] = await Promise.all([
        sb.from('matches').select(MATCH_COLS).eq('id', id).maybeSingle(),
        sb.from('match_events').select('*').eq('match_id', id).order('minute', { ascending: false }).order('extra_minute', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
        sb.rpc('match_reaction_counts', { p_match_id: id }),
      ]);
      const err = m.error ?? e.error ?? r.error;
      if (err) fail(err, 'Maç yüklenemedi.');
      if (!m.data) return null;
      return {
        match: toMatch(m.data as MatchRow),
        events: ((e.data ?? []) as EventRow[]).map(toEvent),
        reactions: { ...emptyReactions(), ...((r.data as ReactionCounts | null) ?? {}) },
      };
    },

    async react(matchId, type) {
      const { data: session } = await sb.auth.getSession();
      if (!session.session) throw new ForumError('Tepki vermek için giriş yapmalısın.', 'auth_required');
      const { data, error } = await sb.rpc('match_react', { p_match_id: matchId, p_type: type });
      if (error) fail(error, 'Tepki kaydedilemedi.');
      return { ...emptyReactions(), ...(data as ReactionCounts) };
    },

    async getSquad() {
      const { data, error } = await sb.from('squad_players').select('id, name, number, position').eq('active', true).order('position').order('number');
      if (error) fail(error, 'Kadro yüklenemedi.');
      return (data ?? []) as SquadPlayer[];
    },

    async saveLineup(lineup) {
      const problem = validateLineup(lineup);
      if (problem) throw new ForumError(problem, 'validation');
      const { data: session } = await sb.auth.getSession();
      if (!session.session) throw new ForumError('İlk 11’ini kaydetmek için giriş yapmalısın.', 'auth_required');
      const { data, error } = await sb
        .from('lineups')
        .insert({ match_id: lineup.matchId, formation: lineup.formation, players: lineup.players })
        .select('id')
        .single();
      if (error) fail(error, 'İlk 11 kaydedilemedi.');
      return { id: String((data as { id: string }).id) };
    },

    async getMyLineup(matchId) {
      const { data: session } = await sb.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) return null;
      let q = sb.from('lineups').select('id, match_id, formation, players').eq('user_id', uid);
      q = matchId ? q.eq('match_id', matchId) : q.is('match_id', null);
      const { data, error } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) fail(error, 'İlk 11 yüklenemedi.');
      if (!data) return null;
      const row = data as { id: string; match_id: string | null; formation: Formation; players: Record<string, string> };
      return { id: row.id, matchId: row.match_id, formation: row.formation, players: row.players };
    },

    subscribe(matchId, topicId, onChange) {
      // Selective realtime: this match row, its events and new posts in its room topic.
      let channel = sb
        .channel(`match-room:${matchId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` }, onChange);
      if (topicId) {
        channel = channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `topic_id=eq.${topicId}` }, onChange);
      }
      channel.subscribe();
      // Safety net if the socket drops (mobile networks): light polling.
      const timer = setInterval(onChange, 45_000);
      return () => {
        clearInterval(timer);
        void sb.removeChannel(channel);
      };
    },
  };
}
