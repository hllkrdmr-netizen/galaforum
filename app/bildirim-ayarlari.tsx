import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, Card, Container, ErrorState, ScreenHeader, SkeletonRow } from '../components/ui';
import { colors, radius, spacing } from '../constants/theme';
import { Notice } from '../features/auth/AuthLayout';
import { SignInPrompt } from '../features/auth/SignInPrompt';
import { invalidateQueries, useForumQuery } from '../hooks/useForumQuery';
import { useAuth } from '../lib/auth/AuthProvider';
import { changeSetting, NOTIFICATION_GROUPS } from '../lib/notifications';
import { enablePushOnThisDevice, getPushProvider } from '../lib/push';
import type { PushStatus } from '../lib/push';
import { notifications } from '../services/notifications';
import type { NotificationGroup, NotificationSetting } from '../types/notification';

export default function NotificationSettingsScreen() {
  const { status, user } = useAuth();
  const enabled = status === 'signedIn' || status === 'unavailable';
  const q = useForumQuery(`notif:settings:${user?.id ?? 'demo'}`, () => notifications.getSettings(), { enabled, staleTime: 5 * 60_000 });
  const [local, setLocal] = useState<NotificationSetting[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) setLocal(q.data);
  }, [q.data]);

  const update = async (group: NotificationGroup, patch: Partial<Pick<NotificationSetting, 'inApp' | 'push'>>) => {
    if (!local) return;
    const before = local;
    const current = local.find((s) => s.group === group);
    if (!current) return;
    const next = changeSetting(current, patch);
    setLocal(local.map((s) => (s.group === group ? next : s)));
    setError(null);
    try {
      await notifications.setSetting(next);
      invalidateQueries('notif:');
    } catch (e) {
      setLocal(before);
      setError(e instanceof Error ? e.message : 'Ayar kaydedilemedi.');
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Bildirim ayarları" />
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <Container style={{ paddingTop: spacing.xl, gap: spacing.xl, maxWidth: 760 }}>
          {status === 'signedOut' ? (
            <SignInPrompt message="Bildirim tercihlerini düzenlemek için giriş yap." />
          ) : (
            <>
              <PushCard />
              {error ? <Notice tone="error">{error}</Notice> : null}
              {q.isLoading || (!local && !q.error) ? (
                <SkeletonRow />
              ) : q.error ? (
                <ErrorState message={q.error.message} onRetry={q.refetch} />
              ) : local ? (
                <View>
                  <View style={styles.headRow}>
                    <AppText variant="caption" tone="subtle" uppercase style={{ flex: 1, letterSpacing: 1.2 }}>
                      Ne zaman haber verelim?
                    </AppText>
                    <AppText variant="caption" tone="subtle" style={styles.col}>
                      Uygulama
                    </AppText>
                    <AppText variant="caption" tone="subtle" style={styles.col}>
                      Anlık
                    </AppText>
                  </View>
                  <View style={styles.list}>
                    {NOTIFICATION_GROUPS.map((g) => {
                      const s = local.find((x) => x.group === g.group);
                      if (!s) return null;
                      return (
                        <View key={g.group} style={styles.row}>
                          <View style={styles.icon}>
                            <Ionicons name={g.icon} size={18} color={s.inApp ? colors.gold : colors.textSubtle} />
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <AppText variant="bodyStrong" tone={s.inApp ? 'default' : 'muted'}>
                              {g.label}
                            </AppText>
                            <AppText variant="caption" tone="subtle">
                              {g.hint}
                            </AppText>
                          </View>
                          <View style={styles.col}>
                            <Toggle label={`${g.label}, uygulama içi`} value={s.inApp} onChange={(v) => void update(g.group, { inApp: v })} />
                          </View>
                          <View style={styles.col}>
                            <Toggle label={`${g.label}, anlık bildirim`} value={s.push} onChange={(v) => void update(g.group, { push: v })} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  <AppText variant="caption" tone="subtle" style={{ marginTop: spacing.md }}>
                    Uygulama içi kapalı olan bir tür için anlık bildirim de gönderilmez. Aynı konudaki yanıtlar ve beğeniler
                    okunana kadar tek bildirimde toplanır.
                  </AppText>
                </View>
              ) : null}
            </>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onChange}
      trackColor={{ false: 'rgba(245,239,230,0.14)', true: colors.wineBright }}
      thumbColor={value ? colors.goldSoft : '#C9BFB3'}
      /* react-native-web colours the "on" thumb separately (defaults to teal). */
      {...(Platform.OS === 'web' ? ({ activeThumbColor: colors.goldSoft } as object) : null)}
    />
  );
}

const PUSH_COPY: Record<PushStatus, { title: string; body: string; icon: keyof typeof Ionicons.glyphMap }> = {
  unsupported: {
    title: 'Anlık bildirimler bu sürümde kapalı',
    body:
      Platform.OS === 'web'
        ? 'Web’de telefon bildirimi gönderilmiyor. Yeni bildirimleri üstteki zil simgesinden takip edebilirsin.'
        : 'Uygulama içi bildirimler çalışıyor. Telefona anlık bildirim, uygulamanın mağaza sürümüyle açılacak; tercihlerin şimdiden kaydediliyor.',
    icon: 'phone-portrait-outline',
  },
  undetermined: {
    title: 'Bu cihazda anlık bildirimleri aç',
    body: 'Maç başladığında, gol olduğunda ya da biri sana yanıt verdiğinde telefonuna haber gelsin.',
    icon: 'notifications-outline',
  },
  denied: {
    title: 'Bildirim izni kapalı',
    body: 'Anlık bildirim almak için cihaz ayarlarından GalaForum’a bildirim izni ver.',
    icon: 'notifications-off-outline',
  },
  granted: {
    title: 'Anlık bildirimler bu cihazda açık',
    body: 'Hangi durumlarda bildirim geleceğini aşağıdan seçebilirsin.',
    icon: 'checkmark-circle-outline',
  },
};

function PushCard() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPushProvider()
      .getStatus()
      .then((s) => active && setStatus(s))
      .catch(() => active && setStatus('unsupported'));
    return () => {
      active = false;
    };
  }, []);

  if (!status) return null;
  const copy = PUSH_COPY[status];

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await enablePushOnThisDevice(notifications);
      setStatus(result === 'enabled' ? 'granted' : result === 'denied' ? 'denied' : 'unsupported');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Bildirimler açılamadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tone={status === 'granted' ? 'default' : 'wine'}>
      <View style={styles.pushRow}>
        <View style={styles.pushIcon}>
          <Ionicons name={copy.icon} size={22} color={colors.gold} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="bodyStrong">{copy.title}</AppText>
          <AppText variant="small" tone="muted">
            {copy.body}
          </AppText>
          {message ? (
            <AppText variant="small" style={{ color: colors.danger }}>
              {message}
            </AppText>
          ) : null}
        </View>
      </View>
      {status === 'undetermined' ? (
        <Button label="Bildirimleri aç" icon="notifications-outline" loading={busy} onPress={() => void enable()} style={{ alignSelf: 'flex-start', marginTop: spacing.lg }} />
      ) : status === 'denied' && Platform.OS !== 'web' ? (
        <Button label="Cihaz ayarlarını aç" variant="secondary" icon="settings-outline" onPress={() => void Linking.openSettings()} style={{ alignSelf: 'flex-start', marginTop: spacing.lg }} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  col: { width: 64, alignItems: 'center', textAlign: 'center' },
  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 68,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217,164,65,0.08)',
  },
  pushRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  pushIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217,164,65,0.10)',
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
});
