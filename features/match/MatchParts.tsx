import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Button, Pill, PressableScale } from '../../components/ui';
import { colors, fonts, radius, shadows, spacing } from '../../constants/theme';
import { useNow } from '../../hooks/useNow';
import { countdown, EVENT_LABEL, eventMinuteLabel, isLive, kickoffLabel, matchTitle, scoreLabel, statusLabel } from '../../lib/match';
import type { Match, MatchEvent } from '../../types/match';

type IconName = keyof typeof Ionicons.glyphMap;

const NATIVE_DRIVER = Platform.OS !== 'web';

/** Small pulsing dot used for LIVE states (static when reduce-motion is on). */
export function LiveDot() {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (reduce || cancelled) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(v, { toValue: 0.35, duration: 700, useNativeDriver: NATIVE_DRIVER }),
            Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: NATIVE_DRIVER }),
          ]),
        );
        loop.start();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [v]);
  return <Animated.View style={[styles.liveDot, { opacity: v }]} />;
}

export function StatusBadge({ match }: { match: Pick<Match, 'status' | 'minute'> }) {
  if (isLive(match.status)) {
    return (
      <View style={styles.liveBadge} accessibilityLabel={`Canlı, ${statusLabel(match)}`}>
        <LiveDot />
        <AppText variant="caption" style={{ color: '#FFD9D4', fontWeight: '800' }}>
          CANLI · {statusLabel(match)}
        </AppText>
      </View>
    );
  }
  if (match.status === 'finished') return <Pill label="Maç sonu" />;
  if (match.status === 'postponed') return <Pill label="Ertelendi" tone="wine" />;
  return <Pill label="Yaklaşan" tone="gold" />;
}

function isGalatasaray(name: string) {
  return name.toLocaleLowerCase('tr-TR').startsWith('galatasaray');
}

function Team({ name, align }: { name: string; align: 'left' | 'right' }) {
  const isGs = isGalatasaray(name);
  return (
    <View style={[styles.team, align === 'right' && { alignItems: 'flex-end' }]}>
      <AppText
        variant="h2"
        numberOfLines={2}
        style={[{ textAlign: align }, isGs && { color: colors.goldSoft }]}
        accessibilityLabel={name}
      >
        {name}
      </AppText>
    </View>
  );
}

/** Narrow screens: one row per team with the score on the right, so long club names never break mid-word. */
function StackedTeams({ match, showScore }: { match: Match; showScore: boolean }) {
  const rows: Array<[string, number | null]> = [
    [match.homeTeam, match.homeScore],
    [match.awayTeam, match.awayScore],
  ];
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map(([name, score]) => (
        <View key={name} style={styles.stackRow}>
          <AppText variant="h2" numberOfLines={1} style={[{ flex: 1 }, isGalatasaray(name) && { color: colors.goldSoft }]}>
            {name}
          </AppText>
          {showScore ? <AppText style={styles.stackScore}>{score ?? '–'}</AppText> : null}
        </View>
      ))}
    </View>
  );
}

/** Large scoreboard used in the live room header. */
export function Scoreboard({ match }: { match: Match }) {
  const live = isLive(match.status);
  const { width } = useWindowDimensions();
  const narrow = width < 560;
  const started = match.status !== 'scheduled' && match.status !== 'postponed';
  return (
    <View style={[styles.board, shadows.soft]} accessibilityRole="summary" accessibilityLabel={`${matchTitle(match)}, ${scoreLabel(match)}, ${statusLabel(match)}`}>
      <LinearGradient colors={['#2A070E', '#150609']} style={StyleSheet.absoluteFill} />
      <View style={styles.boardTop}>
        <AppText variant="overline" tone="gold" uppercase>
          {match.competition}
        </AppText>
        <StatusBadge match={match} />
      </View>
      {narrow ? (
        <StackedTeams match={match} showScore={started} />
      ) : (
        <View style={styles.boardRow}>
          <Team name={match.homeTeam} align="left" />
          <View style={styles.scoreBox}>
            <AppText style={[styles.score, live && { color: colors.text }]}>{scoreLabel(match)}</AppText>
          </View>
          <Team name={match.awayTeam} align="right" />
        </View>
      )}
      <AppText variant="caption" tone="subtle" style={{ textAlign: narrow ? 'left' : 'center' }}>
        {kickoffLabel(match.kickoffAt)}
        {match.venue ? ` · ${match.venue}` : ''}
      </AppText>
    </View>
  );
}

export function CountdownBlocks({ kickoffAt }: { kickoffAt: string }) {
  const now = useNow(1000);
  const c = countdown(kickoffAt, now);
  if (c.done) {
    return (
      <AppText variant="bodyStrong" tone="gold">
        Başlama saati geldi — canlı yayın akışı birazdan güncellenecek.
      </AppText>
    );
  }
  const parts: Array<[number, string]> = [
    [c.days, 'Gün'],
    [c.hours, 'Saat'],
    [c.minutes, 'Dakika'],
    [c.seconds, 'Saniye'],
  ];
  return (
    <View
      style={styles.countdown}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`Maça ${c.days} gün ${c.hours} saat ${c.minutes} dakika kaldı`}
    >
      {parts.map(([v, label]) => (
        <View key={label} style={styles.cdBlock}>
          <AppText style={styles.cdValue}>{String(v).padStart(2, '0')}</AppText>
          <AppText variant="caption" tone="subtle" uppercase>
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Hub hero for the next match: teams, date, venue, countdown and the two primary actions. */
export function NextMatchCard({ match }: { match: Match }) {
  const { width } = useWindowDimensions();
  const narrow = width < 560;
  return (
    <View style={[styles.next, shadows.soft]}>
      <LinearGradient colors={['#3A0A17', '#1A0609', '#0F0507']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.boardTop}>
        <AppText variant="overline" tone="gold" uppercase>
          Sıradaki maç · {match.competition}
        </AppText>
        <StatusBadge match={match} />
      </View>
      {narrow ? (
        <StackedTeams match={match} showScore={false} />
      ) : (
        <View style={styles.boardRow}>
          <Team name={match.homeTeam} align="left" />
          <AppText style={styles.vs}>vs</AppText>
          <Team name={match.awayTeam} align="right" />
        </View>
      )}
      <View style={styles.metaLine}>
        <Ionicons name="calendar-outline" size={14} color={colors.textSubtle} />
        <AppText variant="small" tone="muted">
          {kickoffLabel(match.kickoffAt)}
        </AppText>
        {match.venue ? (
          <>
            <Ionicons name="location-outline" size={14} color={colors.textSubtle} />
            <AppText variant="small" tone="muted">
              {match.venue}
            </AppText>
          </>
        ) : null}
      </View>
      <CountdownBlocks kickoffAt={match.kickoffAt} />
      <View style={styles.actions}>
        <Button label="Maç Detayı" icon="stats-chart-outline" onPress={() => router.push(`/mac/${match.id}`)} />
        {match.topicId ? (
          <Button label="Tartışmaya Katıl" variant="secondary" icon="chatbubbles-outline" onPress={() => router.push(`/konu/${match.topicId}`)} />
        ) : null}
      </View>
    </View>
  );
}

/** Prominent banner for a match that is live right now. */
export function LiveMatchBanner({ match }: { match: Match }) {
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`Canlı maç: ${matchTitle(match)} ${scoreLabel(match)}, ${statusLabel(match)}. Canlı odaya gir.`}
      onPress={() => router.push(`/mac/${match.id}`)}
      style={({ hovered }) => [styles.liveBanner, hovered && { borderColor: colors.gold }]}
    >
      <LinearGradient colors={['rgba(140,29,51,0.55)', 'rgba(42,7,14,0.9)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, gap: 4 }}>
        <StatusBadge match={match} />
        <AppText variant="h2" numberOfLines={1}>
          {match.homeTeam} <AppText variant="h2" tone="gold">{scoreLabel(match)}</AppText> {match.awayTeam}
        </AppText>
        <AppText variant="caption" tone="muted">
          {match.competition} · Canlı maç odası açık
        </AppText>
      </View>
      <View style={styles.enter}>
        <AppText variant="small" tone="gold" style={{ fontWeight: '800' }}>
          Odaya gir
        </AppText>
        <Ionicons name="arrow-forward" size={16} color={colors.gold} />
      </View>
    </PressableScale>
  );
}

/** Compact fixture/result row for lists. */
export function MatchRow({ match, isLast }: { match: Match; isLast?: boolean }) {
  const d = new Date(match.kickoffAt);
  const day = Number.isNaN(d.getTime()) ? '' : `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${matchTitle(match)}, ${scoreLabel(match)}, ${kickoffLabel(match.kickoffAt)}`}
      onPress={() => router.push(`/mac/${match.id}`)}
      style={({ hovered }) => [styles.row, !isLast && styles.divider, hovered && { backgroundColor: colors.surfaceHover }]}
    >
      <View style={styles.date}>
        <AppText variant="bodyStrong">{day}</AppText>
        <AppText variant="caption" tone="subtle">
          {String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}
        </AppText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {matchTitle(match)}
        </AppText>
        <AppText variant="caption" tone="subtle" numberOfLines={1}>
          {match.competition}
          {match.venue ? ` · ${match.venue}` : ''}
        </AppText>
      </View>
      {match.status === 'scheduled' ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      ) : (
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <AppText variant="h3" tone={isLive(match.status) ? 'gold' : 'default'}>
            {scoreLabel(match)}
          </AppText>
          <AppText variant="caption" tone="subtle">
            {statusLabel(match)}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

const EVENT_ICON: Record<MatchEvent['type'], { icon: IconName; color: string }> = {
  goal: { icon: 'football', color: colors.goldSoft },
  own_goal: { icon: 'football-outline', color: colors.textMuted },
  penalty_goal: { icon: 'football', color: colors.goldSoft },
  penalty_miss: { icon: 'close-circle-outline', color: colors.textMuted },
  yellow: { icon: 'square', color: '#E8C547' },
  red: { icon: 'square', color: '#D9453B' },
  sub: { icon: 'swap-vertical', color: colors.info },
  var: { icon: 'tv-outline', color: colors.textMuted },
  kickoff: { icon: 'play-circle-outline', color: colors.textMuted },
  halftime: { icon: 'pause-circle-outline', color: colors.textMuted },
  fulltime: { icon: 'flag-outline', color: colors.textMuted },
};

export function EventTimeline({ events, match }: { events: MatchEvent[]; match: Match }) {
  if (events.length === 0) {
    return (
      <AppText variant="small" tone="subtle">
        Henüz önemli bir an yok.
      </AppText>
    );
  }
  return (
    <View style={{ gap: 0 }}>
      {events.map((e, i) => {
        const meta = EVENT_ICON[e.type];
        const team = e.side === 'home' ? match.homeTeam : e.side === 'away' ? match.awayTeam : null;
        const important = e.type === 'goal' || e.type === 'penalty_goal' || e.type === 'own_goal' || e.type === 'red';
        return (
          <View key={e.id} style={[styles.event, i > 0 && styles.divider]} accessible accessibilityLabel={`${eventMinuteLabel(e)} ${EVENT_LABEL[e.type]}${team ? `, ${team}` : ''}${e.player ? `, ${e.player}` : ''}`}>
            <AppText variant="bodyStrong" tone={important ? 'gold' : 'muted'} style={styles.eventMin}>
              {eventMinuteLabel(e)}
            </AppText>
            <Ionicons name={meta.icon} size={16} color={meta.color} />
            <View style={{ flex: 1 }}>
              <AppText variant={important ? 'bodyStrong' : 'small'}>
                {EVENT_LABEL[e.type]}
                {team ? ` · ${team}` : ''}
              </AppText>
              {e.player || e.detail ? (
                <AppText variant="caption" tone="subtle">
                  {[e.player, e.detail].filter(Boolean).join(' — ')}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A4E' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(217,69,59,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,78,0.45)',
    alignSelf: 'flex-start',
  },
  board: { borderRadius: radius.xl, overflow: 'hidden', padding: spacing.xl, gap: spacing.lg, borderWidth: 1, borderColor: colors.borderGold },
  boardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  team: { flex: 1 },
  scoreBox: { minWidth: 96, alignItems: 'center' },
  score: { fontFamily: fonts.display, fontSize: 44, lineHeight: 50, fontWeight: '800', color: colors.goldSoft, letterSpacing: 1 },
  vs: { fontFamily: fonts.display, fontSize: 22, fontWeight: '800', color: colors.textSubtle, paddingHorizontal: spacing.sm },
  next: { borderRadius: radius.xl, overflow: 'hidden', padding: spacing.xl, gap: spacing.lg, borderWidth: 1, borderColor: colors.borderGold },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  countdown: { flexDirection: 'row', gap: spacing.sm },
  cdBlock: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(11,5,7,0.55)',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  cdValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, fontWeight: '800', color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,90,78,0.45)',
  },
  enter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  date: { width: 52, alignItems: 'center' },
  event: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  eventMin: { width: 60 },
  stackRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stackScore: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, fontWeight: '800', color: colors.goldSoft, minWidth: 32, textAlign: 'right' },
});
