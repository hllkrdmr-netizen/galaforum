import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Container, EmptyState, ErrorState, IconButton, PressableScale, ScreenHeader, SkeletonRow } from '../components/ui';
import { colors, radius, spacing } from '../constants/theme';
import { SignInPrompt } from '../features/auth/SignInPrompt';
import { NotificationItem } from '../features/notifications/NotificationItem';
import { invalidateQueries, useForumQuery } from '../hooks/useForumQuery';
import { useUnreadNotifications } from '../hooks/useNotifications';
import { useAuth } from '../lib/auth/AuthProvider';
import { describeNotification, sectionByDay } from '../lib/notifications';
import { notifications } from '../services/notifications';
import type { AppNotification } from '../types/notification';

type Filter = 'all' | 'unread';
const PAGE = 30;

export default function NotificationsScreen() {
  const { status, user, profile } = useAuth();
  const enabled = status === 'signedIn' || status === 'unavailable';
  const [filter, setFilter] = useState<Filter>('all');
  const unread = useUnreadNotifications();

  const key = `notif:list:${user?.id ?? 'demo'}:${filter}`;
  const first = useForumQuery(key, () => notifications.list({ limit: PAGE, unreadOnly: filter === 'unread' }), { enabled, staleTime: 15_000 });

  // Older pages are appended locally; the first page stays live through the query cache.
  const [older, setOlder] = useState<AppNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setOlder([]);
    setCursor(first.data?.nextCursor ?? null);
  }, [key, first.data]);

  const firstItems = first.data?.items ?? [];
  const seen = new Set(firstItems.map((n) => n.id));
  const items = [...firstItems, ...older.filter((n) => !seen.has(n.id))];
  const sections = sectionByDay(items);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setActionError(null);
    try {
      const page = await notifications.list({ before: cursor, limit: PAGE, unreadOnly: filter === 'unread' });
      setOlder((o) => [...o, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Bildirimler yüklenemedi.');
    } finally {
      setLoadingMore(false);
    }
  };

  const open = useCallback(
    async (n: AppNotification) => {
      const href = describeNotification(n, profile?.username).href;
      if (!n.readAt) {
        // Optimistic: reflect locally right away, then refresh counters.
        setOlder((o) => o.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
        notifications
          .markRead([n.id])
          .then(() => invalidateQueries('notif:'))
          .catch(() => undefined);
      }
      if (href) router.push(href);
    },
    [profile?.username],
  );

  const markAll = async () => {
    setBusyAll(true);
    setActionError(null);
    try {
      await notifications.markRead();
      setOlder((o) => o.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })));
      invalidateQueries('notif:');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Bildirimler güncellenemedi.');
    } finally {
      setBusyAll(false);
    }
  };

  const settingsButton = enabled ? (
    <IconButton icon="options-outline" label="Bildirim ayarları" onPress={() => router.push('/bildirim-ayarlari')} />
  ) : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Bildirimler" right={settingsButton} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={
          enabled ? (
            <RefreshControl refreshing={first.isRefreshing} onRefresh={() => invalidateQueries('notif:')} tintColor={colors.gold} />
          ) : undefined
        }
      >
        <Container style={{ paddingTop: spacing.lg, maxWidth: 760 }}>
          {status === 'signedOut' ? (
            <>
              <EmptyState
                icon="notifications-outline"
                title="Bildirimlerin burada toplanır."
                message="Yanıtlar, bahsetmeler, yeni takipçiler ve maç uyarıları için giriş yap."
              />
              <SignInPrompt message="Bildirimlerini görmek için giriş yap." />
            </>
          ) : status === 'loading' ? (
            <SkeletonRow />
          ) : (
            <>
              <View style={styles.toolbar}>
                <View style={styles.segment} accessibilityRole="tablist">
                  <Segment label="Tümü" active={filter === 'all'} onPress={() => setFilter('all')} />
                  <Segment label={unread > 0 ? `Okunmamış · ${unread}` : 'Okunmamış'} active={filter === 'unread'} onPress={() => setFilter('unread')} />
                </View>
                {unread > 0 ? (
                  <Button label="Tümünü okundu say" icon="checkmark-done-outline" variant="ghost" loading={busyAll} onPress={() => void markAll()} />
                ) : null}
              </View>

              {actionError ? (
                <AppText variant="small" style={{ color: colors.danger, marginBottom: spacing.md }}>
                  {actionError}
                </AppText>
              ) : null}

              {first.isLoading ? (
                <SkeletonRow />
              ) : first.error ? (
                <ErrorState message={first.error.message} onRetry={first.refetch} />
              ) : items.length === 0 ? (
                <EmptyState
                  icon={filter === 'unread' ? 'checkmark-done-outline' : 'notifications-outline'}
                  title={filter === 'unread' ? 'Hepsini okudun.' : 'Henüz bildirimin yok.'}
                  message={
                    filter === 'unread'
                      ? 'Yeni bir yanıt ya da maç uyarısı geldiğinde burada görünür.'
                      : 'Konu açıp tartışmalara katıldıkça, üyeleri ve kategorileri takip ettikçe bildirimler gelir.'
                  }
                  actionLabel={filter === 'unread' ? 'Tümünü göster' : 'Gündeme git'}
                  onAction={filter === 'unread' ? () => setFilter('all') : () => router.push('/')}
                />
              ) : (
                sections.map((s) => (
                  <View key={s.title} style={styles.section}>
                    <AppText variant="caption" tone="subtle" uppercase style={styles.sectionTitle} accessibilityRole="header">
                      {s.title}
                    </AppText>
                    <View style={styles.list}>
                      {s.items.map((n) => (
                        <NotificationItem key={n.id} item={n} me={profile?.username} onOpen={(x) => void open(x)} />
                      ))}
                    </View>
                  </View>
                ))
              )}

              {cursor && items.length > 0 ? (
                <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
                  <Button label="Daha eski bildirimler" variant="secondary" loading={loadingMore} onPress={() => void loadMore()} />
                </View>
              ) : null}

              {notifications.mode === 'demo' && items.length > 0 ? (
                <AppText variant="caption" tone="subtle" style={{ marginTop: spacing.xl, textAlign: 'center' }}>
                  Demo modu: örnek bildirimler gösteriliyor.
                </AppText>
              ) : null}
            </>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.segmentItem, active && styles.segmentActive]}
    >
      <AppText variant="small" style={{ fontWeight: '700', color: active ? colors.textOnGold : colors.textMuted }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segmentItem: { minHeight: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.gold },
  section: { marginBottom: spacing.xl },
  sectionTitle: { letterSpacing: 1.2, marginBottom: spacing.sm, marginLeft: spacing.xs },
  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
});
