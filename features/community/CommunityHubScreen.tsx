import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Container, EmptyState, ErrorState, IconButton, PressableScale, SectionHeader, Skeleton, SkeletonRow } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../constants/theme';
import { useForumQuery } from '../../hooks/useForumQuery';
import { community } from '../../services/community';
import { forum } from '../../services/forum';
import { TopicRow } from '../forum/TopicRow';
import { ActiveMembers } from './CommunityParts';
import { FeaturedMeetupCard, MeetupCard } from './MeetupCards';

function Stat({ value, label, icon }: { value: number; label: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Ionicons name={icon} size={16} color={colors.gold} />
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText variant="caption" tone="subtle">
        {label}
      </AppText>
    </View>
  );
}

export function CommunityHubScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const meetups = useForumQuery('community:meetups:', () => community.listMeetups());
  const members = useForumQuery('community:active', () => community.activeMembers(10));
  const talk = useForumQuery('forum:section:community', async () => {
    const pages = await Promise.all(['taraftar-tribun', 'mac-oncesi-bulusmalar'].map((s) => forum.getCategoryTopics(s, 0, 5)));
    return pages
      .flatMap((p) => p.items)
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
      .slice(0, 5);
  });
  const create = () => router.push('/bulusma-olustur');
  const list = meetups.data ?? [];
  const [featured, ...others] = list;
  const cities = [...new Set(list.map((m) => m.city))];
  const attending = list.reduce((sum, m) => sum + m.attendeeCount, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 140 }}>
      <Container style={{ paddingTop: insets.top + spacing.xl }}>
        <View style={styles.titleRow}>
          <Ionicons name="people" size={24} color={colors.gold} />
          <AppText variant="h1" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
            Topluluk
          </AppText>
          {width >= 420 ? (
            <Button label="Buluşma aç" icon="add" onPress={create} />
          ) : (
            <IconButton icon="add" label="Buluşma aç" tone="gold" onPress={create} />
          )}
        </View>
        <AppText variant="small" tone="muted" style={{ marginTop: spacing.xs }}>
          Maç günü buluşmaları, ortak yolculuklar ve tribünün en aktif sesleri.
        </AppText>

        <View style={styles.stats}>
          <Stat value={list.length} label="buluşma" icon="calendar" />
          <Stat value={attending} label="katılımcı" icon="people" />
          <Stat value={cities.length} label="şehir" icon="location" />
        </View>

        {cities.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cities}>
            {cities.map((c) => (
              <PressableScale
                key={c}
                accessibilityRole="link"
                accessibilityLabel={`${c} buluşmaları`}
                onPress={() => router.push({ pathname: '/bulusmalar', params: { sehir: c } })}
                style={styles.city}
              >
                <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                <AppText variant="caption" style={{ fontWeight: '700', color: colors.textMuted }}>
                  {c}
                </AppText>
              </PressableScale>
            ))}
          </ScrollView>
        ) : null}
      </Container>

      <Container style={styles.section}>
        {meetups.isLoading ? (
          <Skeleton height={260} rounded={radius.xl} />
        ) : meetups.error ? (
          <ErrorState compact message={meetups.error.message} onRetry={meetups.refetch} />
        ) : !featured ? (
          <EmptyState icon="location-outline" title="Yaklaşan buluşma yok." message="Maç öncesi bir buluşma noktası belirle, taraftarları topla." actionLabel="İlk buluşmayı sen aç" onAction={create} />
        ) : (
          <View style={[styles.grid, wide && styles.gridWide]}>
            <View style={wide ? { flex: 1.2 } : undefined}>
              <FeaturedMeetupCard meetup={featured} onChanged={() => void meetups.refetch()} />
            </View>
            {others.length > 0 ? (
              <View style={[{ gap: spacing.md }, wide ? { flex: 1 } : { marginTop: spacing.md }]}>
                {others.slice(0, 2).map((m) => (
                  <MeetupCard key={m.id} meetup={m} />
                ))}
                <PressableScale accessibilityRole="link" onPress={() => router.push('/bulusmalar')} style={styles.allLink}>
                  <AppText variant="small" tone="gold" style={{ fontWeight: '800' }}>
                    Tüm buluşmalar
                  </AppText>
                  <Ionicons name="arrow-forward" size={14} color={colors.gold} />
                </PressableScale>
              </View>
            ) : null}
          </View>
        )}
      </Container>

      <Container style={styles.section}>
        <SectionHeader title="Bu ayın en aktifleri" />
        {members.isLoading ? (
          <SkeletonRow />
        ) : members.error ? (
          <ErrorState compact message={members.error.message} onRetry={members.refetch} />
        ) : (members.data ?? []).length === 0 ? (
          <AppText variant="small" tone="subtle">
            Son 30 günde mesaj yazan üye yok.
          </AppText>
        ) : (
          <ActiveMembers members={members.data ?? []} />
        )}
      </Container>

      <Container style={styles.section}>
        <SectionHeader title="Tribün ve buluşma konuşmaları" actionLabel="Tümü" onAction={() => router.push('/kategori/taraftar-tribun')} />
        <View style={styles.list}>
          {talk.isLoading ? (
            <SkeletonRow />
          ) : talk.error ? (
            <ErrorState compact message={talk.error.message} onRetry={talk.refetch} />
          ) : (
            (talk.data ?? []).map((t) => <TopicRow key={t.id} topic={t} />)
          )}
        </View>
      </Container>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, fontWeight: '800', color: colors.text },
  cities: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  city: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: { marginTop: spacing.xxl },
  grid: {},
  gridWide: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  allLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
