import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card, Container, EmptyState, ErrorState, Pill, ScreenHeader, SectionHeader, SkeletonRow } from '../../../components/ui';
import { colors, radius, spacing } from '../../../constants/theme';
import { ActionBox, Chip, modStyles } from '../../../features/moderation/ModParts';
import { invalidateQueries, useForumQuery } from '../../../hooks/useForumQuery';
import { useStaff } from '../../../hooks/useModeration';
import { formatRelativeTime } from '../../../lib/format';
import { durationLabel, isStaffRole, ROLE_LABEL, ROLES, SANCTION_DURATIONS, SANCTION_LABEL, untilLabel } from '../../../lib/moderation';
import { moderation } from '../../../services/moderation';
import type { UserRole } from '../../../types/forum';
import type { SanctionKind } from '../../../types/moderation';

const KIND_HELP: Record<SanctionKind, string> = {
  mute: 'Konu açamaz, yanıt yazamaz, buluşma açamaz. Okuyabilir, beğenebilir.',
  ban: 'Hiçbir şey yazamaz; beğeni, oy, takip, tepki ve şikâyet de kapanır.',
};

export default function MemberModerationScreen() {
  const { username = '' } = useLocalSearchParams<{ username: string }>();
  const { isStaff, isAdmin } = useStaff();
  const q = useForumQuery(`mod:member:${username}`, () => moderation.member(username), { enabled: isStaff, staleTime: 15_000 });
  const [kind, setKind] = useState<SanctionKind>('mute');
  const [hours, setHours] = useState<number | null>(24);
  const [mode, setMode] = useState<null | 'sanction' | 'revoke' | 'role'>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await fn();
      setMode(null);
      setDone(message);
      invalidateQueries('mod:');
      invalidateQueries('forum:profile:');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  if (!isStaff) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Üye" />
        <EmptyState icon="shield-outline" title="Bu sayfa moderatörler içindir." />
      </View>
    );
  }

  const m = q.data;
  const staffTarget = m ? isStaffRole(m.author.role) : false;
  const selectedDuration = SANCTION_DURATIONS.find((d) => d.hours === hours)?.label ?? durationLabel(hours);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Üye incelemesi" />
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }} keyboardShouldPersistTaps="handled">
        <Container style={{ paddingTop: spacing.xl, gap: spacing.xl, maxWidth: 760 }}>
          {q.isLoading ? (
            <SkeletonRow />
          ) : q.error ? (
            <ErrorState message={q.error.message} onRetry={q.refetch} />
          ) : !m ? (
            <EmptyState icon="person-outline" title="Üye bulunamadı." message="Kullanıcı adını kontrol et; hesap silinmiş olabilir." actionLabel="Panele dön" onAction={() => router.replace('/moderasyon?sekme=uyeler')} />
          ) : (
            <>
              <Card>
                <View style={styles.identity}>
                  <Avatar name={m.author.username} uri={m.author.avatarUrl} size={56} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText variant="h2">{m.author.username}</AppText>
                    <View style={modStyles.row}>
                      <Pill label={ROLE_LABEL[m.author.role ?? 'user']} tone={staffTarget ? 'wine' : 'neutral'} />
                      {m.activeSanction ? <Pill label={`${SANCTION_LABEL[m.activeSanction.kind]} aktif`} tone="wine" icon="shield" /> : null}
                      <AppText variant="caption" tone="subtle">
                        {formatRelativeTime(m.joinedAt)} katıldı
                      </AppText>
                    </View>
                  </View>
                </View>
                <View style={styles.stats}>
                  {[
                    { label: 'Mesaj', value: m.postCount },
                    { label: 'Kaldırılan', value: m.removedPostCount },
                    { label: 'Açık şikâyet', value: m.openReportCount },
                    { label: 'Yaptırım', value: m.sanctions.length },
                  ].map((s) => (
                    <View key={s.label} style={styles.stat}>
                      <AppText variant="h2" style={s.label !== 'Mesaj' && s.value > 0 ? { color: colors.goldSoft } : undefined}>
                        {s.value}
                      </AppText>
                      <AppText variant="caption" tone="subtle">
                        {s.label}
                      </AppText>
                    </View>
                  ))}
                </View>
                <View style={[modStyles.row, { marginTop: spacing.lg }]}>
                  <Button label="Profili aç" variant="secondary" icon="person-outline" onPress={() => router.push(`/uye/${m.author.username}`)} />
                  <Button label="Mesajları" variant="ghost" icon="search-outline" onPress={() => router.push({ pathname: '/ara', params: { uye: m.author.username } })} />
                </View>
              </Card>

              {done ? (
                <View style={styles.done} accessibilityRole="alert">
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <AppText variant="small" style={{ color: colors.success }}>
                    {done}
                  </AppText>
                </View>
              ) : null}

              {m.activeSanction ? (
                <View style={styles.active}>
                  <AppText variant="bodyStrong">
                    {SANCTION_LABEL[m.activeSanction.kind]} · {untilLabel(m.activeSanction.endsAt)}
                  </AppText>
                  <AppText variant="small" tone="muted">
                    Gerekçe: {m.activeSanction.reason}
                  </AppText>
                  {mode === 'revoke' ? (
                    <ActionBox
                      title="Yaptırımı kaldır"
                      confirmLabel="Kaldır"
                      required={false}
                      busy={busy}
                      error={error}
                      onCancel={() => setMode(null)}
                      onConfirm={(reason) => void run(() => moderation.revokeSanction(m.activeSanction!.id, reason), 'Yaptırım kaldırıldı; üyeye bildirildi.')}
                    />
                  ) : (
                    <View style={[modStyles.row, { marginTop: spacing.sm }]}>
                      <Button label="Yaptırımı kaldır" variant="secondary" icon="shield-checkmark-outline" onPress={() => setMode('revoke')} />
                    </View>
                  )}
                </View>
              ) : null}

              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Yaptırım uygula" />
                {staffTarget ? (
                  <AppText variant="small" tone="muted">
                    Moderatör ve yöneticilere yaptırım uygulanamaz. Gerekirse bir yönetici önce rolünü değiştirir.
                  </AppText>
                ) : (
                  <>
                    <View style={modStyles.row}>
                      <Chip icon="volume-mute-outline" label="Sustur" active={kind === 'mute'} onPress={() => setKind('mute')} />
                      <Chip icon="ban-outline" label="Yasakla" danger active={kind === 'ban'} onPress={() => setKind('ban')} />
                    </View>
                    <AppText variant="small" tone="muted">
                      {KIND_HELP[kind]}
                    </AppText>
                    <View style={modStyles.row}>
                      {SANCTION_DURATIONS.map((d) => (
                        <Chip key={d.label} label={d.label} active={hours === d.hours} onPress={() => setHours(d.hours)} />
                      ))}
                    </View>
                    {mode === 'sanction' ? (
                      <ActionBox
                        title={`${m.author.username}: ${SANCTION_LABEL[kind].toLocaleLowerCase('tr-TR')} · ${selectedDuration}`}
                        confirmLabel={kind === 'ban' ? 'Yasakla' : 'Sustur'}
                        required
                        danger
                        busy={busy}
                        error={error}
                        onCancel={() => setMode(null)}
                        onConfirm={(reason) =>
                          void run(() => moderation.sanction(m.author.username, kind, hours, reason), `${kind === 'ban' ? 'Yasak' : 'Susturma'} uygulandı; üyeye gerekçesiyle bildirildi.`)
                        }
                      />
                    ) : (
                      <View style={modStyles.row}>
                        <Button
                          label={`${kind === 'ban' ? 'Yasakla' : 'Sustur'} · ${selectedDuration}`}
                          icon={kind === 'ban' ? 'ban-outline' : 'volume-mute-outline'}
                          onPress={() => {
                            setError(null);
                            setMode('sanction');
                          }}
                        />
                      </View>
                    )}
                  </>
                )}
              </View>

              {isAdmin ? (
                <View style={{ gap: spacing.md }}>
                  <SectionHeader title="Rol" />
                  <View style={modStyles.row}>
                    {ROLES.map((r) => (
                      <Chip key={r} label={ROLE_LABEL[r]} active={(role ?? m.author.role ?? 'user') === r} onPress={() => setRole(r)} />
                    ))}
                  </View>
                  <AppText variant="small" tone="muted">
                    Moderatörler şikâyetleri, konuları ve yaptırımları yönetir; yöneticiler ayrıca rol verir. Kendi rolünü değiştiremezsin.
                  </AppText>
                  {role && role !== m.author.role ? (
                    <View style={modStyles.row}>
                      <Button label={`${ROLE_LABEL[role]} yap`} loading={busy && mode === 'role'} onPress={() => {
                        setMode('role');
                        void run(() => moderation.setRole(m.author.username, role), `Rol güncellendi: ${ROLE_LABEL[role]}.`).then(() => setRole(null));
                      }} />
                      <Button label="Vazgeç" variant="ghost" onPress={() => setRole(null)} />
                    </View>
                  ) : null}
                  {error && mode === 'role' ? (
                    <AppText variant="small" tone="danger">
                      {error}
                    </AppText>
                  ) : null}
                </View>
              ) : null}

              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Geçmiş" />
                {m.sanctions.length === 0 ? (
                  <AppText variant="small" tone="subtle">
                    Bu üyeye daha önce yaptırım uygulanmamış.
                  </AppText>
                ) : (
                  <View style={styles.list}>
                    {m.sanctions.map((s) => {
                      const expired = s.endsAt ? new Date(s.endsAt).getTime() < Date.now() : false;
                      const state = s.revokedAt ? 'kaldırıldı' : expired ? 'süresi doldu' : 'aktif';
                      return (
                        <View key={s.id} style={styles.listRow}>
                          <Ionicons name={s.kind === 'ban' ? 'ban-outline' : 'volume-mute-outline'} size={18} color={state === 'aktif' ? colors.danger : colors.textSubtle} />
                          <View style={{ flex: 1, gap: 2 }}>
                            <AppText variant="small" style={{ fontWeight: '700' }}>
                              {SANCTION_LABEL[s.kind]} · {state}
                            </AppText>
                            <AppText variant="caption" tone="muted">
                              {s.reason}
                            </AppText>
                            <AppText variant="caption" tone="subtle">
                              {formatRelativeTime(s.createdAt)}
                              {s.by ? ` · ${s.by}` : ''}
                              {s.endsAt ? ` · bitiş: ${untilLabel(s.endsAt).replace('’e kadar', '')}` : ' · süresiz'}
                            </AppText>
                          </View>
                        </View>
                      );
                    })}
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
  stats: { flexDirection: 'row', marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  done: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  active: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(228,106,94,0.45)',
    backgroundColor: 'rgba(107,20,38,0.2)',
  },
  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
