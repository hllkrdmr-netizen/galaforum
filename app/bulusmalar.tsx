import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Container, EmptyState, ErrorState, PressableScale, ScreenHeader, SkeletonRow } from '../components/ui';
import { colors, radius, spacing } from '../constants/theme';
import { MeetupRow } from '../features/community/CommunityParts';
import { useForumQuery } from '../hooks/useForumQuery';
import { community } from '../services/community';

export default function MeetupsScreen() {
  const { sehir } = useLocalSearchParams<{ sehir?: string }>();
  const city = sehir ? String(sehir) : '';
  const all = useForumQuery('community:meetups:', () => community.listMeetups());
  const list = useForumQuery(`community:meetups:${city}`, () => community.listMeetups(city || undefined), { enabled: Boolean(city) });
  const data = city ? list : all;
  const cities = [...new Set((all.data ?? []).map((m) => m.city))].sort((a, b) => a.localeCompare(b, 'tr'));

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Buluşmalar" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <Container style={{ paddingTop: spacing.lg, gap: spacing.md }}>
          <View style={styles.row}>
            <AppText variant="small" tone="muted" style={{ flex: 1 }}>
              Maç günü buluşmaları ve ortak yolculuklar.
            </AppText>
            <Button label="Buluşma aç" icon="add" variant="secondary" onPress={() => router.push('/bulusma-olustur')} />
          </View>
          {cities.length > 1 ? (
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Şehir">
              {['', ...cities].map((c) => {
                const on = city === c;
                return (
                  <PressableScale
                    key={c || 'all'}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => router.setParams({ sehir: c })}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <AppText variant="caption" style={{ fontWeight: '700', color: on ? colors.goldSoft : colors.textMuted }}>
                      {c || 'Tüm şehirler'}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          ) : null}
        </Container>
        <Container style={{ marginTop: spacing.md }}>
          <View style={styles.list}>
            {data.isLoading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : data.error ? (
              <ErrorState compact message={data.error.message} onRetry={data.refetch} />
            ) : (data.data ?? []).length === 0 ? (
              <EmptyState
                icon="location-outline"
                title={city ? `${city} için yaklaşan buluşma yok.` : 'Yaklaşan buluşma yok.'}
                actionLabel="Buluşma aç"
                onAction={() => router.push('/bulusma-olustur')}
              />
            ) : (
              (data.data ?? []).map((m, i, arr) => <MeetupRow key={m.id} meetup={m} isLast={i === arr.length - 1} />)
            )}
          </View>
        </Container>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(217,164,65,0.12)' },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
