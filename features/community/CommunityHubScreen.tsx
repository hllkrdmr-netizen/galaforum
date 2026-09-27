import { router } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Container, EmptyState, ErrorState, IconButton, SectionHeader, SkeletonRow } from '../../components/ui';
import { colors, spacing } from '../../constants/theme';
import { useForumQuery } from '../../hooks/useForumQuery';
import { community } from '../../services/community';
import { forum } from '../../services/forum';
import { TopicRow } from '../forum/TopicRow';
import { ActiveMembers, MeetupRow } from './CommunityParts';

export function CommunityHubScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const meetups = useForumQuery('community:meetups:', () => community.listMeetups());
  const members = useForumQuery('community:active', () => community.activeMembers(8));
  const talk = useForumQuery('forum:section:community', async () => {
    const pages = await Promise.all(['taraftar-tribun', 'mac-oncesi-bulusmalar'].map((s) => forum.getCategoryTopics(s, 0, 5)));
    return pages
      .flatMap((p) => p.items)
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
      .slice(0, 5);
  });
  const create = () => router.push('/bulusma-olustur');
  const upcoming = (meetups.data ?? []).slice(0, 3);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 140 }}>
      <Container style={{ paddingTop: insets.top + spacing.xl }}>
        <View style={styles.titleRow}>
          <Ionicons name="people-outline" size={24} color={colors.gold} />
          <AppText variant="h1" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
            Topluluk
          </AppText>
          {width >= 420 ? (
            <Button label="Buluşma aç" icon="add" variant="secondary" onPress={create} />
          ) : (
            <IconButton icon="add" label="Buluşma aç" tone="gold" onPress={create} />
          )}
        </View>
        <AppText variant="small" tone="muted" style={{ marginTop: spacing.xs }}>
          Maç günü buluşmaları, aktif üyeler ve tribün kültürü.
        </AppText>
      </Container>

      <Container style={styles.section}>
        <SectionHeader title="Yaklaşan buluşmalar" actionLabel="Tümü" onAction={() => router.push('/bulusmalar')} />
        <View style={styles.list}>
          {meetups.isLoading ? (
            <SkeletonRow />
          ) : meetups.error ? (
            <ErrorState compact message={meetups.error.message} onRetry={meetups.refetch} />
          ) : upcoming.length === 0 ? (
            <EmptyState compact icon="location-outline" title="Yaklaşan buluşma yok." actionLabel="İlk buluşmayı sen aç" onAction={create} />
          ) : (
            upcoming.map((m, i) => <MeetupRow key={m.id} meetup={m} isLast={i === upcoming.length - 1} />)
          )}
        </View>
      </Container>

      <Container style={styles.section}>
        <SectionHeader title="Aktif üyeler" />
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
  section: { marginTop: spacing.xxl },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
