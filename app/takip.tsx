import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Container, EmptyState, ErrorState, PressableScale, ScreenHeader, SectionHeader, SkeletonRow } from '../components/ui';
import { CATEGORY_BY_SLUG } from '../constants/categories';
import { colors, spacing } from '../constants/theme';
import { CategoryIcon } from '../features/forum/CategoryIcon';
import { useForumQuery } from '../hooks/useForumQuery';
import { community } from '../services/community';
import { forum } from '../services/forum';

/** Everything the member follows: people, topics and categories. */
export default function FollowingScreen() {
  const q = useForumQuery('community:follows:page', async () => {
    const f = await community.getMyFollows();
    // Demo mode stores topic ids only; resolve titles from the forum.
    const topics = await Promise.all(
      f.topics.map(async (t) => (t.title ? t : { id: t.id, title: (await forum.getTopic(t.id, 0, 1))?.title ?? 'Konu' })),
    );
    return { ...f, topics };
  });
  const f = q.data;
  const empty = f && f.users.length + f.topics.length + f.categories.length === 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Takip ettiklerin" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <Container style={{ paddingTop: spacing.lg }}>
          {q.isLoading ? (
            <SkeletonRow />
          ) : q.error ? (
            <ErrorState message={q.error.message} onRetry={q.refetch} />
          ) : empty || !f ? (
            <EmptyState
              icon="notifications-outline"
              title="Henüz kimseyi ya da hiçbir şeyi takip etmiyorsun."
              message="Profillerdeki “Takip et”, konulardaki zil ve kategori sayfalarındaki düğmeyle takip edebilirsin."
            />
          ) : (
            <>
              {f.users.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader title="Üyeler" />
                  {f.users.map((u) => (
                    <Row key={u.id} onPress={() => router.push(`/uye/${u.username}`)} label={u.username} left={<Avatar name={u.username} uri={u.avatarUrl} size={32} />} />
                  ))}
                </View>
              ) : null}
              {f.topics.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader title="Konular" />
                  {f.topics.map((t) => (
                    <Row key={t.id} onPress={() => router.push(`/konu/${t.id}`)} label={t.title} left={<Ionicons name="notifications" size={18} color={colors.gold} />} />
                  ))}
                </View>
              ) : null}
              {f.categories.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader title="Kategoriler" />
                  {f.categories.map((slug) => {
                    const c = CATEGORY_BY_SLUG[slug];
                    return c ? <Row key={slug} onPress={() => router.push(`/kategori/${slug}`)} label={c.name} left={<CategoryIcon icon={c.icon} size={32} />} /> : null;
                  })}
                </View>
              ) : null}
            </>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function Row({ label, left, onPress }: { label: string; left: ReactNode; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={({ hovered }) => [styles.row, hovered && { backgroundColor: colors.surfaceHover }]}>
      {left}
      <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  section: { marginBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
