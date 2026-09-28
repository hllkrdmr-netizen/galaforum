import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Container, EmptyState, ErrorState, Pill, PressableScale, ScreenHeader, SkeletonRow } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { MatchForm } from '../../features/match/MatchAdminParts';
import { invalidateQueries, useForumQuery } from '../../hooks/useForumQuery';
import { useStaff } from '../../hooks/useModeration';
import { isLive, kickoffLabel, scoreLabel, statusLabel } from '../../lib/match';
import { matches } from '../../services/match';
import type { Match } from '../../types/match';

/** Staff: fixture list and "Yeni maç". Every change is written to the moderation log. */
export default function MatchAdminScreen() {
  const { isStaff, demo } = useStaff();
  const q = useForumQuery('match:list', () => matches.listMatches(), { enabled: isStaff, staleTime: 15_000 });
  const [creating, setCreating] = useState(false);

  if (!isStaff) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Maç yönetimi" />
        <EmptyState icon="shield-outline" title="Bu sayfa moderatörler içindir." />
      </View>
    );
  }

  const all = q.data ?? [];
  const groups: Array<{ title: string; items: Match[] }> = [
    { title: 'Şu an', items: all.filter((m) => isLive(m.status)) },
    { title: 'Yaklaşan', items: all.filter((m) => m.status === 'scheduled' || m.status === 'postponed') },
    { title: 'Biten', items: all.filter((m) => m.status === 'finished').reverse() },
  ];

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Maç yönetimi" right={demo ? <Pill label="Demo" /> : null} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => invalidateQueries('match:')} tintColor={colors.gold} />}
      >
        <Container style={{ paddingTop: spacing.xl, gap: spacing.xl, maxWidth: 760 }}>
          <AppText variant="small" tone="muted">
            Maç ekle, başlat, gol ve kartları gir, bitir. Her maç için “Canlı Maç Konusu” otomatik açılır; başlama, gol ve maç
            sonu bildirimleri kendiliğinden gider.
          </AppText>

          {creating ? (
            <MatchForm
              title="Yeni maç"
              submitLabel="Maçı ekle"
              onCancel={() => setCreating(false)}
              onSubmit={async (input) => {
                const { id } = await matches.createMatch(input);
                invalidateQueries('match:');
                invalidateQueries('forum:');
                setCreating(false);
                router.push(`/mac-yonetimi/${id}`);
              }}
            />
          ) : (
            <Button label="Yeni maç" icon="add-outline" onPress={() => setCreating(true)} style={{ alignSelf: 'flex-start' }} />
          )}

          {q.isLoading ? (
            <SkeletonRow />
          ) : q.error ? (
            <ErrorState message={q.error.message} onRetry={q.refetch} />
          ) : all.length === 0 ? (
            <EmptyState icon="football-outline" title="Henüz maç yok." message="İlk maçı “Yeni maç” ile ekle." />
          ) : (
            groups
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <View key={g.title}>
                  <AppText variant="caption" tone="subtle" uppercase style={styles.caption}>
                    {g.title}
                  </AppText>
                  <View style={styles.list}>
                    {g.items.map((m) => (
                      <PressableScale
                        key={m.id}
                        accessibilityRole="link"
                        accessibilityLabel={`${m.homeTeam} – ${m.awayTeam}, ${statusLabel(m)}. Yönet`}
                        onPress={() => router.push(`/mac-yonetimi/${m.id}`)}
                        style={({ hovered }) => [styles.row, hovered && { backgroundColor: colors.surfaceHover }]}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <AppText variant="bodyStrong" numberOfLines={1}>
                            {m.homeTeam} – {m.awayTeam}
                          </AppText>
                          <AppText variant="caption" tone="subtle" numberOfLines={1}>
                            {m.competition} · {kickoffLabel(m.kickoffAt)}
                          </AppText>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <AppText variant="bodyStrong" style={isLive(m.status) ? { color: colors.goldSoft } : undefined}>
                            {scoreLabel(m)}
                          </AppText>
                          <AppText variant="caption" tone={isLive(m.status) ? 'gold' : 'subtle'}>
                            {statusLabel(m)}
                          </AppText>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
                      </PressableScale>
                    ))}
                  </View>
                </View>
              ))
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  caption: { letterSpacing: 1.2, marginBottom: spacing.sm },
  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
