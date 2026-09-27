import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card, Pill, PressableScale } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { invalidateQueries } from '../../hooks/useForumQuery';
import { formatRelativeTime } from '../../lib/format';
import { ROLE_LABEL, SANCTION_LABEL } from '../../lib/moderation';
import { moderation } from '../../services/moderation';
import type { ReportCase } from '../../types/moderation';
import { ActionBox, modStyles } from './ModParts';

type Mode = null | 'remove' | 'dismiss';

const STATUS_LABEL = { open: 'Açık', resolved: 'İşlem yapıldı', dismissed: 'Reddedildi' } as const;

export function ReportCaseCard({ item }: { item: ReportCase }) {
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const open = item.status === 'open';
  const reports = showAll ? item.reports : item.reports.slice(0, 3);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setMode(null);
      invalidateQueries('mod:');
      invalidateQueries('forum:');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tone={open ? 'wine' : 'default'}>
      <View style={styles.head}>
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`Konu: ${item.topicTitle}`}
          disabled={item.topicHidden}
          onPress={() => router.push(`/konu/${item.topicId}`)}
          style={{ flex: 1 }}
        >
          <AppText variant="caption" tone="subtle" numberOfLines={1}>
            {item.isOpeningPost ? 'Açılış mesajı · ' : ''}
            {item.topicHidden ? 'Gizli konu · ' : ''}
            {formatRelativeTime(item.postCreatedAt)} yazıldı
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {item.topicTitle}
          </AppText>
        </PressableScale>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Pill label={`${item.reportCount} şikâyet`} tone={open ? 'wine' : 'neutral'} icon="flag" />
          {!open ? <Pill label={STATUS_LABEL[item.status]} tone={item.status === 'resolved' ? 'success' : 'neutral'} /> : null}
        </View>
      </View>

      <View style={styles.author}>
        <Avatar name={item.author.username} uri={item.author.avatarUrl} size={28} />
        <AppText variant="small" style={{ fontWeight: '700' }}>
          {item.author.username}
        </AppText>
        {item.author.role && item.author.role !== 'user' ? <Pill label={ROLE_LABEL[item.author.role]} tone="gold" /> : null}
        {item.authorSanction ? <Pill label={`${SANCTION_LABEL[item.authorSanction]} aktif`} tone="wine" icon="shield" /> : null}
      </View>

      <View style={[styles.body, item.postRemoved && { opacity: 0.55 }]}>
        <AppText variant="small" tone="muted" numberOfLines={5}>
          {item.body}
        </AppText>
        {item.postRemoved ? (
          <AppText variant="caption" tone="danger" style={{ marginTop: 4 }}>
            Mesaj kaldırıldı
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: 6, marginTop: spacing.md }}>
        {reports.map((r, i) => (
          <AppText key={`${r.reporter}-${i}`} variant="small" tone="muted">
            <AppText variant="small" style={{ fontWeight: '700', color: colors.text }}>
              {r.reporter ?? 'silinmiş üye'}
            </AppText>
            {`: ${r.reason} · ${formatRelativeTime(r.createdAt)}`}
          </AppText>
        ))}
        {item.reports.length > 3 && !showAll ? (
          <PressableScale accessibilityRole="button" onPress={() => setShowAll(true)} style={{ alignSelf: 'flex-start' }}>
            <AppText variant="small" style={{ color: colors.goldSoft, fontWeight: '700' }}>
              +{item.reports.length - 3} şikâyet daha
            </AppText>
          </PressableScale>
        ) : null}
      </View>

      {open && !mode ? (
        <View style={[modStyles.row, { marginTop: spacing.lg }]}>
          <Button label={item.isOpeningPost ? 'Konuyu gizle' : 'Mesajı kaldır'} icon={item.isOpeningPost ? 'eye-off-outline' : 'trash-outline'} onPress={() => setMode('remove')} />
          <Button label="Şikâyeti reddet" variant="secondary" icon="checkmark-done-outline" onPress={() => setMode('dismiss')} />
          <Button label="Üyeyi incele" variant="ghost" icon="person-outline" onPress={() => router.push(`/moderasyon/uye/${item.author.username}`)} />
        </View>
      ) : null}
      {!open ? (
        <View style={[modStyles.row, { marginTop: spacing.md }]}>
          <Button label="Üyeyi incele" variant="ghost" icon="person-outline" onPress={() => router.push(`/moderasyon/uye/${item.author.username}`)} />
        </View>
      ) : null}

      {mode === 'remove' ? (
        <ActionBox
          title={item.isOpeningPost ? 'Konuyu herkesten gizle' : 'Mesajı kaldır'}
          confirmLabel={item.isOpeningPost ? 'Konuyu gizle' : 'Mesajı kaldır'}
          required
          danger
          busy={busy}
          error={error}
          onCancel={() => setMode(null)}
          onConfirm={(reason) =>
            void run(() =>
              item.isOpeningPost ? moderation.setTopicFlag(item.topicId, 'hidden', true, reason) : moderation.removePost(item.postId, reason),
            )
          }
        />
      ) : null}
      {mode === 'dismiss' ? (
        <ActionBox
          title="Şikâyeti reddet — kural ihlali yok"
          confirmLabel="Reddet"
          required={false}
          busy={busy}
          error={error}
          onCancel={() => setMode(null)}
          onConfirm={(note) => void run(() => moderation.dismissReports(item.postId, note))}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.md },
  body: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.borderStrong,
    backgroundColor: 'rgba(11,5,7,0.45)',
  },
});
