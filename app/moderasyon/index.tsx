import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Container, EmptyState, ErrorState, Pill, PressableScale, ScreenHeader, SkeletonRow, TextField } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { ActionBox, Chip, modStyles } from '../../features/moderation/ModParts';
import { ReportCaseCard } from '../../features/moderation/ReportCaseCard';
import { invalidateQueries, useForumQuery } from '../../hooks/useForumQuery';
import { useOpenReportCount, useStaff } from '../../hooks/useModeration';
import { useResponsive } from '../../hooks/useResponsive';
import { formatRelativeTime } from '../../lib/format';
import { actionInfo, logDetail, logTargetHref } from '../../lib/moderation';
import { moderation } from '../../services/moderation';
import type { HiddenTopic, ModLogEntry } from '../../types/moderation';

type Tab = 'sikayetler' | 'uyeler' | 'gizlenenler' | 'kayit';
const TABS: Array<{ key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'sikayetler', label: 'Şikâyetler', icon: 'flag-outline' },
  { key: 'uyeler', label: 'Üyeler', icon: 'people-outline' },
  { key: 'gizlenenler', label: 'Gizlenenler', icon: 'eye-off-outline' },
  { key: 'kayit', label: 'Kayıt', icon: 'time-outline' },
];

export default function ModerationScreen() {
  const { isStaff, demo } = useStaff();
  const params = useLocalSearchParams<{ sekme?: string }>();
  const initial = TABS.find((t) => t.key === params.sekme)?.key ?? 'sikayetler';
  const [tab, setTab] = useState<Tab>(initial);
  const openCount = useOpenReportCount();
  const { isWide } = useResponsive();

  if (!isStaff) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Moderasyon" />
        <EmptyState icon="shield-outline" title="Bu sayfa moderatörler içindir." message="Uygunsuz bir mesaj gördüysen mesajın “⋯” menüsünden bildirebilirsin." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Moderasyon" right={demo ? <Pill label="Demo" /> : null} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => invalidateQueries('mod:')} tintColor={colors.gold} />}
      >
        <Container style={{ paddingTop: spacing.xl, gap: spacing.xl, maxWidth: 880 }}>
          <View style={styles.tabs} accessibilityRole="tablist">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <PressableScale
                  key={t.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t.key === 'sikayetler' && openCount ? `${t.label}, ${openCount} açık` : t.label}
                  onPress={() => setTab(t.key)}
                  style={[styles.tab, on && styles.tabOn, !isWide && { flexBasis: '47%' }]}
                >
                  <Ionicons name={t.icon} size={16} color={on ? colors.textOnGold : colors.textMuted} />
                  <AppText variant="small" style={{ fontWeight: '800', color: on ? colors.textOnGold : colors.textMuted }}>
                    {t.label}
                  </AppText>
                  {t.key === 'sikayetler' && openCount > 0 ? (
                    <View style={[styles.count, on && { backgroundColor: colors.textOnGold }]}>
                      <AppText variant="caption" style={{ fontWeight: '800', color: on ? colors.goldSoft : colors.textOnGold, fontSize: 11 }}>
                        {openCount}
                      </AppText>
                    </View>
                  ) : null}
                </PressableScale>
              );
            })}
          </View>

          {tab === 'sikayetler' ? <ReportsTab /> : null}
          {tab === 'uyeler' ? <MembersTab /> : null}
          {tab === 'gizlenenler' ? <HiddenTab /> : null}
          {tab === 'kayit' ? <LogTab /> : null}
        </Container>
      </ScrollView>
    </View>
  );
}

function ReportsTab() {
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const q = useForumQuery(`mod:reports:${status}`, () => moderation.reportQueue(status), { staleTime: 20_000 });
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={modStyles.row}>
        <Chip label="Açık" active={status === 'open'} onPress={() => setStatus('open')} />
        <Chip label="Kapananlar" active={status === 'closed'} onPress={() => setStatus('closed')} />
      </View>
      {q.isLoading ? (
        <SkeletonRow />
      ) : q.error ? (
        <ErrorState message={q.error.message} onRetry={q.refetch} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={status === 'open' ? 'checkmark-done-circle-outline' : 'archive-outline'}
          title={status === 'open' ? 'Bekleyen şikâyet yok.' : 'Henüz kapanan şikâyet yok.'}
          message={status === 'open' ? 'Yeni bir şikâyet geldiğinde burada, en yenisi üstte görünür.' : undefined}
        />
      ) : (
        (q.data ?? []).map((c) => <ReportCaseCard key={c.postId} item={c} />)
      )}
    </View>
  );
}

function MembersTab() {
  const [name, setName] = useState('');
  const recent = useForumQuery('mod:log:recent-users', () => moderation.log({ limit: 100 }), { staleTime: 30_000 });
  const users = [
    ...new Map(
      (recent.data ?? [])
        .filter((e) => e.targetType === 'user')
        .map((e) => [e.targetLabel, e] as const),
    ).values(),
  ].slice(0, 8);
  const go = () => {
    const u = name.trim().replace(/^@/, '');
    if (u.length >= 3) router.push(`/moderasyon/uye/${u.toLowerCase()}`);
  };
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <TextField label="Kullanıcı adı" value={name} onChangeText={setName} placeholder="@kullanici_adi" autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={go} />
        </View>
        <Button label="İncele" icon="search-outline" onPress={go} disabled={name.trim().replace(/^@/, '').length < 3} style={{ marginTop: 24 }} />
      </View>
      <AppText variant="small" tone="muted">
        Üye sayfasında susturma (yazamaz), yasaklama (yazamaz, beğenemez, takip edemez), geçmiş yaptırımlar ve rol ayarı bulunur.
      </AppText>
      {users.length > 0 ? (
        <View>
          <AppText variant="caption" tone="subtle" uppercase style={styles.caption}>
            Son işlem yapılan üyeler
          </AppText>
          <View style={styles.list}>
            {users.map((e) => {
              const a = actionInfo(e.action);
              return (
                <PressableScale key={e.id} accessibilityRole="link" onPress={() => router.push(`/moderasyon/uye/${e.targetLabel}`)} style={({ hovered }) => [styles.listRow, hovered && styles.hovered]}>
                  <Ionicons name={a.icon} size={18} color={a.tone === 'danger' ? colors.danger : colors.gold} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{e.targetLabel}</AppText>
                    <AppText variant="caption" tone="subtle">
                      {a.label} · {formatRelativeTime(e.createdAt)}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function HiddenTab() {
  const q = useForumQuery('mod:hidden', () => moderation.hiddenTopics(), { staleTime: 30_000 });
  const [restoring, setRestoring] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (q.isLoading) return <SkeletonRow />;
  if (q.error) return <ErrorState message={q.error.message} onRetry={q.refetch} />;
  const items: HiddenTopic[] = q.data ?? [];
  if (items.length === 0) return <EmptyState icon="eye-outline" title="Gizlenmiş konu yok." />;
  return (
    <View style={styles.list}>
      {items.map((t) => (
        <View key={t.id} style={styles.listRow}>
          <Ionicons name="eye-off-outline" size={18} color={colors.textSubtle} style={{ alignSelf: 'flex-start', marginTop: 3 }} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{t.title}</AppText>
            <AppText variant="caption" tone="subtle">
              {t.category} · {t.author} · {formatRelativeTime(t.hiddenAt)} gizlendi{t.hiddenBy ? ` (${t.hiddenBy})` : ''}
            </AppText>
            {t.reason ? (
              <AppText variant="small" tone="muted">
                Gerekçe: {t.reason}
              </AppText>
            ) : null}
            {restoring === t.id ? (
              <ActionBox
                title="Konuyu geri getir"
                confirmLabel="Geri getir"
                required={false}
                busy={busy}
                error={error}
                onCancel={() => setRestoring(null)}
                onConfirm={async (reason) => {
                  setBusy(true);
                  setError(null);
                  try {
                    await moderation.setTopicFlag(t.id, 'hidden', false, reason);
                    setRestoring(null);
                    invalidateQueries('mod:');
                    invalidateQueries('forum:');
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Geri getirilemedi.');
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ) : (
              <View style={[modStyles.row, { marginTop: spacing.sm }]}>
                <Button label="Geri getir" variant="secondary" icon="arrow-undo-outline" onPress={() => setRestoring(t.id)} />
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function LogTab() {
  const first = useForumQuery('mod:log:first', () => moderation.log({ limit: 40 }), { staleTime: 15_000 });
  const [older, setOlder] = useState<ModLogEntry[]>([]);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setOlder([]);
    setMore((first.data?.length ?? 0) >= 40);
  }, [first.data]);
  if (first.isLoading) return <SkeletonRow />;
  if (first.error) return <ErrorState message={first.error.message} onRetry={first.refetch} />;
  const items = [...(first.data ?? []), ...older];
  if (items.length === 0) return <EmptyState icon="time-outline" title="Henüz moderasyon işlemi yok." />;
  const loadMore = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoading(true);
    try {
      const page = await moderation.log({ before: last.id, limit: 40 });
      setOlder((o) => [...o, ...page]);
      setMore(page.length >= 40);
    } finally {
      setLoading(false);
    }
  };
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.list}>
        {items.map((e) => (
          <LogRow key={e.id} e={e} />
        ))}
      </View>
      {more ? (
        <View style={{ alignItems: 'center' }}>
          <Button label="Daha eski kayıtlar" variant="secondary" loading={loading} onPress={() => void loadMore()} />
        </View>
      ) : null}
      <AppText variant="caption" tone="subtle" style={{ textAlign: 'center' }}>
        Kayıtlar silinemez ve değiştirilemez; her işlem yapan kişiyle birlikte saklanır.
      </AppText>
    </View>
  );
}

function LogRow({ e }: { e: ModLogEntry }) {
  const a = actionInfo(e.action);
  const detail = logDetail(e);
  const href = logTargetHref(e);
  const color = a.tone === 'danger' ? colors.danger : a.tone === 'gold' ? colors.gold : colors.textMuted;
  return (
    <PressableScale
      accessibilityRole={href ? 'link' : 'text'}
      disabled={!href}
      onPress={href ? () => router.push(href as never) : undefined}
      style={({ hovered }) => [styles.listRow, hovered && href ? styles.hovered : null]}
    >
      <View style={[styles.logIcon, { borderColor: color }]}>
        <Ionicons name={a.icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="small">
          <AppText variant="small" style={{ fontWeight: '800', color: colors.text }}>
            {a.label}
          </AppText>
          {e.targetLabel ? ` · ${e.targetLabel}` : ''}
        </AppText>
        {detail || e.reason ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {[detail, e.reason].filter(Boolean).join(' · ')}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="subtle">
          {e.actor?.username ?? 'sistem'} · {formatRelativeTime(e.createdAt)}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  tabOn: { backgroundColor: colors.gold },
  count: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold },
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  caption: { letterSpacing: 1.2, marginBottom: spacing.sm },
  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  hovered: { backgroundColor: colors.surfaceHover },
  logIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
});
