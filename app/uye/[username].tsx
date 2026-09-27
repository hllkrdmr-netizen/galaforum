import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Button,
  Container,
  EmptyState,
  ErrorState,
  Pill,
  PressableScale,
  ScreenHeader,
  SectionHeader,
  Skeleton,
  SkeletonRow,
} from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { useForumQuery } from '../../hooks/useForumQuery';
import { useAuth } from '../../lib/auth/AuthProvider';
import { formatCount, formatRelativeTime } from '../../lib/format';
import { forum } from '../../services/forum';

const ROLE_LABEL = { user: null, verified: 'Onaylı Üye', moderator: 'Moderatör', admin: 'Yönetici' } as const;
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function joined(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ProfileScreen() {
  const { username = '' } = useLocalSearchParams<{ username: string }>();
  const { profile: me } = useAuth();
  const profile = useForumQuery(`forum:profile:${username}`, () => forum.getProfile(username));
  const p = profile.data;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Profil" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <Container style={{ paddingTop: spacing.xxl, maxWidth: 760 }}>
          {profile.isLoading ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton width={72} height={72} rounded={36} />
              <Skeleton width="40%" height={24} />
              <SkeletonRow />
            </View>
          ) : profile.error ? (
            <ErrorState message={profile.error.message} onRetry={profile.refetch} />
          ) : !p ? (
            <EmptyState icon="person-outline" title="Üye bulunamadı." message="Hesap silinmiş ya da kullanıcı adı değişmiş olabilir." />
          ) : (
            <>
              <View style={styles.identity}>
                <Avatar name={p.author.username} uri={p.author.avatarUrl} size={72} />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="h1" accessibilityRole="header" numberOfLines={1}>
                    {p.author.username}
                  </AppText>
                  <View style={styles.metaRow}>
                    {p.author.role && ROLE_LABEL[p.author.role] ? <Pill label={ROLE_LABEL[p.author.role]!} tone="gold" /> : null}
                    <AppText variant="caption" tone="subtle">
                      {joined(p.joinedAt)} tarihinden beri üye
                    </AppText>
                  </View>
                </View>
              </View>

              <View style={styles.stats} accessibilityRole="summary">
                {[
                  { label: 'Konu', value: p.topicCount },
                  { label: 'Mesaj', value: p.postCount },
                  { label: 'Beğeni', value: p.likesReceived },
                ].map((s) => (
                  <View key={s.label} style={styles.stat}>
                    <AppText variant="h1">{formatCount(s.value)}</AppText>
                    <AppText variant="caption" tone="subtle" uppercase>
                      {s.label}
                    </AppText>
                  </View>
                ))}
              </View>

              <View style={styles.actions}>
                <Button
                  label="Tüm mesajları"
                  variant="secondary"
                  icon="search-outline"
                  onPress={() => router.push({ pathname: '/ara', params: { uye: p.author.username } })}
                />
                {me?.id === p.author.id ? (
                  <Button label="Hesap ayarları" variant="ghost" icon="settings-outline" onPress={() => router.push('/hesap')} />
                ) : null}
              </View>

              <View style={{ marginTop: spacing.xxxl }}>
                <SectionHeader overline="Konular" title="Son açtığı konular" />
                {p.recentTopics.length === 0 ? (
                  <EmptyState compact icon="chatbubbles-outline" title="Henüz konu açmamış." />
                ) : (
                  <View style={styles.group}>
                    {p.recentTopics.map((t, i) => (
                      <PressableScale
                        key={t.id}
                        accessibilityRole="link"
                        onPress={() => router.push(`/konu/${t.id}`)}
                        style={({ hovered }) => [styles.topic, i > 0 && styles.divider, hovered && { backgroundColor: colors.surfaceHover }]}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <AppText variant="bodyStrong" numberOfLines={2}>
                            {t.title}
                          </AppText>
                          <AppText variant="caption" tone="subtle">
                            {t.category.name} · {formatCount(t.replyCount)} yanıt · {formatRelativeTime(t.lastActivityAt)}
                          </AppText>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
                      </PressableScale>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.xxl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl },
  group: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  topic: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
