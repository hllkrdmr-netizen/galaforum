import { applyMatchPatch, emptyReactions, goalSide, milestoneEvent, validateLineup, validateMatchInput, validateNewEvent } from '../../lib/match';
import type { Lineup, Match, MatchDetail, MatchEvent, ReactionCounts, ReactionType, SquadPlayer } from '../../types/match';
import { ForumError } from '../forum/repository';
import type { MatchRepository } from './repository';

const MIN = 60_000;

interface DemoMatchSeed extends Omit<Match, 'status' | 'minute' | 'homeScore' | 'awayScore'> {
  events: Array<Omit<MatchEvent, 'id' | 'matchId' | 'createdAt'>>;
  /** Fixed status for matches that are not driven by the clock (postponed). */
  fixedStatus?: Match['status'];
}

function atLocal(dayOffset: number, hour: number, now: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/**
 * Demo fixtures relative to "now" (clearly labelled Demo in the UI; not real fixtures).
 * The live match advances with the clock: first half, half-time (15 min), second half, full time.
 */
export function buildDemoMatches(now: number = Date.now()): DemoMatchSeed[] {
  return [
    {
      id: 'm-canli',
      competition: 'Süper Lig',
      homeTeam: 'Galatasaray',
      awayTeam: 'Trabzonspor',
      kickoffAt: new Date(now - 72 * MIN).toISOString(),
      venue: 'RAMS Park',
      topicId: 't-mac-canli',
      events: [
        { minute: 1, extraMinute: null, type: 'kickoff', side: null, player: null, detail: null },
        { minute: 23, extraMinute: null, type: 'goal', side: 'home', player: null, detail: 'Ceza sahası dışından sert şut' },
        { minute: 31, extraMinute: null, type: 'yellow', side: 'away', player: null, detail: 'Taktik faul' },
        { minute: 45, extraMinute: 2, type: 'halftime', side: null, player: null, detail: null },
        { minute: 51, extraMinute: null, type: 'goal', side: 'away', player: null, detail: 'Hızlı kontra atak' },
        { minute: 55, extraMinute: null, type: 'sub', side: 'home', player: null, detail: 'Orta sahaya taze kan' },
      ],
    },
    {
      id: 'm-deplasman',
      competition: 'Süper Lig',
      homeTeam: 'Beşiktaş',
      awayTeam: 'Galatasaray',
      kickoffAt: atLocal(3, 20, now),
      venue: 'Deplasman',
      topicId: 't-mac-deplasman',
      events: [],
    },
    {
      id: 'm-avrupa',
      competition: 'UEFA Şampiyonlar Ligi',
      homeTeam: 'Galatasaray',
      awayTeam: 'Ajax',
      kickoffAt: atLocal(6, 22, now),
      venue: 'RAMS Park',
      topicId: 't-mac-avrupa',
      events: [],
    },
    {
      id: 'm-gecen',
      competition: 'Süper Lig',
      homeTeam: 'Galatasaray',
      awayTeam: 'Kasımpaşa',
      kickoffAt: atLocal(-4, 19, now),
      venue: 'RAMS Park',
      topicId: 't-mac-gecen',
      events: [
        { minute: 1, extraMinute: null, type: 'kickoff', side: null, player: null, detail: null },
        { minute: 18, extraMinute: null, type: 'goal', side: 'away', player: null, detail: 'Duran top' },
        { minute: 45, extraMinute: 1, type: 'halftime', side: null, player: null, detail: null },
        { minute: 62, extraMinute: null, type: 'goal', side: 'home', player: null, detail: 'Kafa golü' },
        { minute: 84, extraMinute: null, type: 'penalty_goal', side: 'home', player: null, detail: 'Penaltı' },
        { minute: 90, extraMinute: 4, type: 'fulltime', side: null, player: null, detail: null },
      ],
    },
  ];
}

/** Clock model used by the demo: 45' first half, 15' break, second half to 90', then full time. */
export function demoClock(kickoffAt: string, now: number): Pick<Match, 'status' | 'minute'> {
  const elapsed = Math.floor((now - new Date(kickoffAt).getTime()) / MIN);
  if (elapsed < 0) return { status: 'scheduled', minute: null };
  if (elapsed < 47) return { status: 'live', minute: Math.max(1, Math.min(45, elapsed + 1)) };
  if (elapsed < 62) return { status: 'halftime', minute: 45 };
  if (elapsed < 111) return { status: 'live', minute: Math.min(90, elapsed - 16) };
  return { status: 'finished', minute: null };
}

function scoreAt(events: DemoMatchSeed['events'], minute: number | null, finished: boolean) {
  const counted = events.filter((e) => finished || (minute != null && e.minute <= minute));
  const goals = (side: 'home' | 'away') =>
    counted.filter(
      (e) =>
        ((e.type === 'goal' || e.type === 'penalty_goal') && e.side === side) ||
        (e.type === 'own_goal' && e.side !== side && e.side != null),
    ).length;
  return { homeScore: goals('home'), awayScore: goals('away'), counted };
}

export function createDemoMatchRepository(seed = buildDemoMatches(), clock: () => number = Date.now): MatchRepository {
  const reactions = new Map<string, ReactionCounts>();
  const lineups: Array<Lineup & { id: string; createdAt: number }> = [];
  let lastReaction = 0;

  const toMatch = (s: DemoMatchSeed): { match: Match; events: MatchEvent[] } => {
    const now = clock();
    const c = s.fixedStatus ? { status: s.fixedStatus, minute: null } : demoClock(s.kickoffAt, now);
    const finished = c.status === 'finished';
    const started = c.status !== 'scheduled' && c.status !== 'postponed';
    const { homeScore, awayScore, counted } = scoreAt(s.events, c.status === 'halftime' ? 47 : c.minute, finished);
    const kickoff = new Date(s.kickoffAt).getTime();
    const events: MatchEvent[] = (started ? counted : [])
      .map((e, i) => ({
        ...e,
        id: `${s.id}-e${i}`,
        matchId: s.id,
        createdAt: new Date(kickoff + (e.minute + (e.minute > 45 ? 15 : 0)) * MIN).toISOString(),
      }))
      .sort((a, b) => b.minute - a.minute || (b.extraMinute ?? 0) - (a.extraMinute ?? 0));
    return {
      match: {
        id: s.id,
        competition: s.competition,
        homeTeam: s.homeTeam,
        awayTeam: s.awayTeam,
        kickoffAt: s.kickoffAt,
        venue: s.venue,
        status: c.status,
        minute: c.minute,
        homeScore: started ? homeScore : null,
        awayScore: started ? awayScore : null,
        topicId: s.topicId,
      },
      events,
    };
  };

  // Staff edits "freeze" a demo match: from then on it no longer follows the demo clock.
  const managed = new Map<string, { match: Match; events: MatchEvent[] }>();
  let serial = 0;
  const view = (id: string) => {
    const m = managed.get(id);
    if (m) return { match: { ...m.match }, events: m.events.map((e) => ({ ...e })) };
    const s = seed.find((x) => x.id === id);
    return s ? toMatch(s) : null;
  };
  const freeze = (id: string) => {
    let m = managed.get(id);
    if (!m) {
      const v = view(id);
      if (!v) throw new ForumError('Maç bulunamadı.', 'not_found');
      m = v;
      managed.set(id, m);
    }
    return m;
  };
  const sortEvents = (events: MatchEvent[]) =>
    events.sort((a, b) => b.minute - a.minute || (b.extraMinute ?? 0) - (a.extraMinute ?? 0) || b.createdAt.localeCompare(a.createdAt));
  const newEvent = (matchId: string, e: Omit<MatchEvent, 'id' | 'matchId' | 'createdAt'>): MatchEvent => ({
    ...e,
    id: `${matchId}-x${++serial}`,
    matchId,
    createdAt: new Date(clock() + serial).toISOString(),
  });

  return {
    mode: 'demo',

    async listMatches() {
      const ids = [...new Set([...seed.map((s) => s.id), ...managed.keys()])];
      return ids
        .map((id) => view(id)?.match)
        .filter((m): m is Match => Boolean(m))
        .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
    },

    async getMatch(id): Promise<MatchDetail | null> {
      const v = view(id);
      if (!v) return null;
      return { match: v.match, events: v.events, reactions: { ...(reactions.get(id) ?? emptyReactions()) } };
    },

    async react(matchId, type: ReactionType) {
      const v = view(matchId);
      if (!v) throw new ForumError('Maç bulunamadı.', 'not_found');
      const { match } = v;
      if (match.status !== 'live' && match.status !== 'halftime') throw new ForumError('Tepkiler yalnızca maç sırasında açık.', 'validation');
      const now = clock();
      if (now - lastReaction < 3000) throw new ForumError('Biraz yavaş: 3 saniyede bir tepki verebilirsin.', 'validation');
      lastReaction = now;
      const counts = { ...(reactions.get(matchId) ?? emptyReactions()) };
      counts[type] += 1;
      reactions.set(matchId, counts);
      return { ...counts };
    },

    async getSquad(): Promise<SquadPlayer[]> {
      // No official squad list in demo mode; players are typed into the builder.
      return [];
    },

    async saveLineup(lineup) {
      const error = validateLineup(lineup);
      if (error) throw new ForumError(error, 'validation');
      const id = `l-${clock().toString(36)}-${lineups.length}`;
      lineups.push({ ...lineup, players: { ...lineup.players }, id, createdAt: clock() });
      return { id };
    },

    async getMyLineup(matchId) {
      const mine = lineups.filter((l) => l.matchId === matchId).sort((a, b) => b.createdAt - a.createdAt)[0];
      return mine ? { id: mine.id, matchId: mine.matchId, formation: mine.formation, players: { ...mine.players } } : null;
    },

    subscribe(_matchId, _topicId, onChange) {
      // Demo clock advances every minute; refresh on a gentle interval.
      const timer = setInterval(onChange, 20_000);
      return () => clearInterval(timer);
    },

    async createMatch(input) {
      const problem = validateMatchInput(input);
      if (problem) throw new ForumError(problem, 'validation');
      const id = `m-demo-${++serial}`;
      managed.set(id, {
        match: {
          id,
          competition: input.competition.trim(),
          homeTeam: input.homeTeam.trim(),
          awayTeam: input.awayTeam.trim(),
          kickoffAt: new Date(input.kickoffAt).toISOString(),
          venue: input.venue.trim(),
          status: 'scheduled',
          minute: null,
          homeScore: null,
          awayScore: null,
          topicId: null,
        },
        events: [],
      });
      return { id };
    },

    async updateMatch(id, patch) {
      const m = freeze(id);
      const next = applyMatchPatch(m.match, patch);
      if (next.homeTeam.trim().toLocaleLowerCase('tr-TR') === next.awayTeam.trim().toLocaleLowerCase('tr-TR')) {
        throw new ForumError('Ev sahibi ve deplasman takımı aynı olamaz.', 'validation');
      }
      const milestone = milestoneEvent(m.match.status, next.status, m.match.minute);
      if (milestone && !m.events.some((e) => e.type === milestone.type)) {
        m.events.push(newEvent(id, { minute: milestone.minute, extraMinute: null, type: milestone.type, side: null, player: null, detail: null }));
        sortEvents(m.events);
      }
      m.match = next;
    },

    async addEvent(matchId, event) {
      const problem = validateNewEvent(event);
      if (problem) throw new ForumError(problem, 'validation');
      const m = freeze(matchId);
      if (m.match.status === 'scheduled' || m.match.status === 'postponed') throw new ForumError('Olay eklemek için önce maçı başlat.', 'validation');
      const e = newEvent(matchId, { ...event, player: event.player?.trim() || null, detail: event.detail?.trim() || null });
      m.events.push(e);
      sortEvents(m.events);
      const scored = goalSide(event.type, event.side);
      if (scored === 'home') m.match = { ...m.match, homeScore: (m.match.homeScore ?? 0) + 1, awayScore: m.match.awayScore ?? 0 };
      if (scored === 'away') m.match = { ...m.match, awayScore: (m.match.awayScore ?? 0) + 1, homeScore: m.match.homeScore ?? 0 };
      return { id: e.id };
    },

    async deleteEvent(eventId) {
      const ids = [...new Set([...seed.map((s) => s.id), ...managed.keys()])];
      const owner = ids.find((id) => view(id)?.events.some((e) => e.id === eventId));
      if (!owner) throw new ForumError('Olay bulunamadı; sayfayı yenile.', 'not_found');
      const m = freeze(owner);
      const e = m.events.find((x) => x.id === eventId)!;
      m.events = m.events.filter((x) => x.id !== eventId);
      const scored = goalSide(e.type, e.side);
      if (scored === 'home') m.match = { ...m.match, homeScore: Math.max(0, (m.match.homeScore ?? 0) - 1) };
      if (scored === 'away') m.match = { ...m.match, awayScore: Math.max(0, (m.match.awayScore ?? 0) - 1) };
    },
  };
}
