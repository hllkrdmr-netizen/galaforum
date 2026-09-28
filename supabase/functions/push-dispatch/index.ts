/**
 * push-dispatch — Supabase Edge Function that delivers queued notifications to phones via Expo Push.
 *
 * Flow: claim_push_batch() (Phase 7 migration) marks up to N pending notifications as sent and returns them
 * with the recipients' device tokens → this function sends them to https://exp.host/--/api/v2/push/send in
 * chunks of 100 → tokens Expo reports as DeviceNotRegistered are disabled (disable_push_tokens), and
 * notifications none of whose messages were accepted are marked failed (mark_push_failed).
 *
 * Deploy:   supabase functions deploy push-dispatch --no-verify-jwt
 * Secrets:  supabase secrets set PUSH_CRON_SECRET=<random>  [EXPO_ACCESS_TOKEN=<token> if "enhanced security" is on]
 * Schedule: every minute with pg_cron + pg_net (see docs/RELEASE.md, "Anlık bildirim").
 *
 * The file has no imports (plain fetch against PostgREST) so the app's TypeScript check and the Node unit
 * tests can load it; Deno-only calls are guarded.
 */

declare const Deno:
  | {
      env: { get(name: string): string | undefined };
      serve(handler: (req: Request) => Response | Promise<Response>): void;
    }
  | undefined;

// ---------------------------------------------------------------- message text (Turkish)
export interface ClaimedRow {
  notification_id: string;
  user_id: string;
  kind: string;
  actor_username: string | null;
  actor_count: number;
  topic_id: string | null;
  post_id: string | null;
  meetup_id: string | null;
  match_id: string | null;
  data: Record<string, unknown> | null;
  tokens: string[];
}

export interface PushData {
  notificationId: string;
  kind: string;
  topicId: string | null;
  postId: string | null;
  matchId: string | null;
  meetupId: string | null;
  actorUsername: string | null;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: PushData;
  sound: 'default';
  channelId: 'default';
  priority: 'high';
}

const MAX_BODY = 178;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const clip = (s: string) => (s.length > MAX_BODY ? `${s.slice(0, MAX_BODY - 1)}…` : s);

function actorName(row: ClaimedRow): string {
  const name = row.actor_username || 'Bir üye';
  return row.actor_count > 1 ? `${name} ve ${row.actor_count - 1} kişi daha` : name;
}

function scoreLine(d: Record<string, unknown>): string {
  const title = text(d.match_title);
  const [home, away] = title.split(' – ');
  if (typeof d.home_score === 'number' && typeof d.away_score === 'number' && away) return `${home} ${d.home_score} – ${d.away_score} ${away}`;
  return title;
}

const MODERATION: Record<string, string> = {
  post_removed: 'Bir mesajın topluluk kurallarına aykırı olduğu için kaldırıldı.',
  topic_hidden: 'Açtığın bir konu yayından kaldırıldı.',
  muted: 'Hesabın geçici olarak susturuldu.',
  banned: 'Hesabın yasaklandı.',
  sanction_revoked: 'Hesabındaki kısıtlama kaldırıldı.',
  role_changed: 'Rolün güncellendi.',
};

/** Title and body for one notification (what the lock screen shows). */
export function pushText(row: ClaimedRow): { title: string; body: string } {
  const d = row.data ?? {};
  const who = actorName(row);
  const topic = text(d.topic_title);
  const excerpt = text(d.excerpt);
  switch (row.kind) {
    case 'reply':
      return { title: topic || 'Yeni yanıt', body: clip(`${who} yanıt yazdı${excerpt ? `: ${excerpt}` : '.'}`) };
    case 'quote':
      return { title: topic || 'Alıntı', body: clip(`${who} mesajını alıntıladı${excerpt ? `: ${excerpt}` : '.'}`) };
    case 'mention':
      return { title: topic || 'Senden bahsedildi', body: clip(`${who} senden bahsetti${excerpt ? `: ${excerpt}` : '.'}`) };
    case 'like':
      return { title: topic || 'Beğeni', body: clip(`${who} mesajını beğendi.`) };
    case 'follow':
      return { title: 'Yeni takipçi', body: `${who} seni takip etmeye başladı.` };
    case 'category_topic':
      return { title: text(d.category_name) || 'Yeni konu', body: clip(`${who} yeni konu açtı: ${topic}`) };
    case 'meetup_join':
      return { title: text(d.meetup_title) || 'Buluşma', body: `${who} buluşmana katıldı.` };
    case 'meetup_cancelled':
      return { title: 'Buluşma iptal edildi', body: clip(text(d.meetup_title) || 'Katıldığın bir buluşma iptal edildi.') };
    case 'match_start':
      return { title: text(d.match_title) || 'Maç', body: 'Maç başladı! Canlı odaya katıl.' };
    case 'match_goal': {
      const minute = typeof d.minute === 'number' ? `${d.minute}${typeof d.extra_minute === 'number' ? `+${d.extra_minute}` : ''}' ` : '';
      const label = d.event_type === 'own_goal' ? 'Kendi kalesine gol' : d.event_type === 'penalty_goal' ? 'Penaltı golü' : 'GOL';
      const team = text(d.team);
      return { title: `${label}! ${minute}${team}`.trim(), body: clip([text(d.player), text(d.match_title)].filter(Boolean).join(' · ') || 'Canlı odada gör.') };
    }
    case 'match_end':
      return { title: 'Maç sona erdi', body: clip(scoreLine(d) || 'Sonucu gör.') };
    case 'badge':
      return { title: 'Yeni rozet kazandın', body: text(d.badge_name) || 'Profilinde gör.' };
    case 'moderation':
      return { title: 'GalaForum ekibi', body: MODERATION[text(d.action)] ?? 'Hesabınla ilgili bir bildirim var.' };
    default:
      return { title: 'GalaForum', body: 'Yeni bir bildirimin var.' };
  }
}

export function buildMessages(rows: ClaimedRow[]): ExpoMessage[] {
  const out: ExpoMessage[] = [];
  for (const row of rows) {
    const { title, body } = pushText(row);
    const data: PushData = {
      notificationId: row.notification_id,
      kind: row.kind,
      topicId: row.topic_id,
      postId: row.post_id,
      matchId: row.match_id,
      meetupId: row.meetup_id,
      actorUsername: row.actor_username,
    };
    for (const to of row.tokens ?? []) out.push({ to, title, body, data, sound: 'default', channelId: 'default', priority: 'high' });
  }
  return out;
}

// ---------------------------------------------------------------- dispatch (testable core)
export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface DispatchDeps {
  rpc(name: string, args: Record<string, unknown>): Promise<unknown>;
  /** Sends ≤100 messages; resolves to one ticket per message in order, or throws on HTTP failure. */
  send(messages: ExpoMessage[]): Promise<ExpoTicket[]>;
}

export interface DispatchResult {
  claimed: number;
  messages: number;
  accepted: number;
  failedNotifications: string[];
  disabledTokens: string[];
}

export async function dispatch(deps: DispatchDeps, limit = 100): Promise<DispatchResult> {
  const rows = ((await deps.rpc('claim_push_batch', { p_limit: limit })) ?? []) as ClaimedRow[];
  const messages = buildMessages(rows);
  const okByNotification = new Map<string, boolean>();
  const disabled = new Set<string>();
  let accepted = 0;

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    let tickets: ExpoTicket[] = [];
    try {
      tickets = await deps.send(chunk);
    } catch {
      tickets = chunk.map(() => ({ status: 'error', message: 'request failed' }));
    }
    chunk.forEach((m, j) => {
      const t = tickets[j];
      const ok = t?.status === 'ok';
      if (ok) accepted += 1;
      if (t?.details?.error === 'DeviceNotRegistered') disabled.add(m.to);
      okByNotification.set(m.data.notificationId, (okByNotification.get(m.data.notificationId) ?? false) || ok);
    });
  }

  const failed = [...okByNotification].filter(([, ok]) => !ok).map(([id]) => id);
  if (disabled.size) await deps.rpc('disable_push_tokens', { p_tokens: [...disabled] });
  if (failed.length) await deps.rpc('mark_push_failed', { p_ids: failed });
  return { claimed: rows.length, messages: messages.length, accepted, failedNotifications: failed, disabledTokens: [...disabled] };
}

// ---------------------------------------------------------------- Edge Function entry (Deno only)
function env(name: string): string {
  const v = typeof Deno !== 'undefined' ? Deno.env.get(name) : undefined;
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

export function createDeps(): DispatchDeps {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const expoToken = typeof Deno !== 'undefined' ? Deno.env.get('EXPO_ACCESS_TOKEN') : undefined;
  return {
    async rpc(name, args) {
      const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`${name} failed: ${res.status} ${await res.text()}`);
      const body = await res.text();
      return body ? JSON.parse(body) : null;
    },
    async send(messages) {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) throw new Error(`expo push ${res.status}`);
      const json = (await res.json()) as { data?: ExpoTicket[] };
      return json.data ?? [];
    },
  };
}

if (typeof Deno !== 'undefined') {
  Deno.serve(async (req: Request) => {
    // Deployed without JWT verification so pg_cron can call it: the shared secret is mandatory.
    const secret = Deno?.env.get('PUSH_CRON_SECRET');
    if (!secret) return new Response('PUSH_CRON_SECRET is not set', { status: 500 });
    if (req.headers.get('x-cron-secret') !== secret) return new Response('forbidden', { status: 403 });
    try {
      const result = await dispatch(createDeps());
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500 });
    }
  });
}
