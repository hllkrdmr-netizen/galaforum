import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Container, EmptyState, ErrorState, IconButton, Pill, PressableScale, ScreenHeader, SectionHeader, SkeletonRow } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { EventForm, MatchForm } from '../../features/match/MatchAdminParts';
import { Chip, modStyles } from '../../features/moderation/ModParts';
import { invalidateQueries, useForumQuery } from '../../hooks/useForumQuery';
import { useStaff } from '../../hooks/useModeration';
import { EVENT_LABEL, eventMinuteLabel, isLive, kickoffLabel, scoreLabel, statusLabel, STATUS_OPTIONS } from '../../lib/match';
import { matches } from '../../services/match';
import type { MatchPatch } from '../../types/match';

/** Staff: run one match — status, minute, events (score follows goals), details. */
export default function MatchControlScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { isStaff, demo } = useStaff();
  const q = useForumQuery(`match:detail:${id}`, () => matches.getMatch(id), { enabled: isStaff, staleTime: 5_000 });
  const [editing, setEditing] = useState(false);
  const [fixScore, setFixScore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    invalidateQueries('match:');
    invalidateQueries('mod:');
  };
  const update = async (key: string, patch: MatchPatch) => {
    setBusy(key);
    setError(null);
    try {
      await matches.updateMatch(id, patch);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Güncellenemedi.');
    } finally {
      setBusy(null);
    }
  };

  if (!isStaff) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Maç" />
        <EmptyState icon="shield-outline" title="Bu sayfa moderatörler içindir." />
      </View>
    );
  }

  const d = q.data;
  const m = d?.match;
  const started = m ? m.status === 'live' || m.status === 'halftime' || m.status === 'finished' : false;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Maçı yönet"
        right={m ? <IconButton icon="radio-outline" label="Canlı maç odasını aç" onPress={() => router.push(`/mac/${m.id}`)} /> : null}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }} keyboardShouldPersistTaps="handled">
        <Container style={{ paddingTop: spacing.xl, gap: spacing.xl, maxWidth: 760 }}>
          {q.isLoading ? (
            <SkeletonRow />
          ) : q.error ? (
            <ErrorState message={q.error.message} onRetry={q.refetch} />
          ) : !m || !d ? (
            <EmptyState icon="football-outline" title="Maç bulunamadı." actionLabel="Maç listesine dön" onAction={() => router.replace('/mac-yonetimi')} />
          ) : (
            <>
              <Card tone={isLive(m.status) ? 'live' : 'wine'}>
                <View style={modStyles.row}>
                  <Pill label={statusLabel(m)} tone={isLive(m.status) ? 'wine' : 'neutral'} icon={isLive(m.status) ? 'radio' : undefined} />
                  {demo ? <Pill label="Demo" /> : null}
                </View>
                <View style={styles.board}>
                  <AppText variant="h3" style={{ flex: 1 }} numberOfLines={2}>
                    {m.homeTeam}
                  </AppText>
                  <AppText variant="h1" numberOfLines={1} style={styles.score} accessibilityLabel={`Skor ${scoreLabel(m)}`}>
                    {scoreLabel(m)}
                  </AppText>
                  <AppText variant="h3" style={{ flex: 1, textAlign: 'right' }} numberOfLines={2}>
                    {m.awayTeam}
                  </AppText>
                </View>
                <AppText variant="caption" tone="subtle">
                  {m.competition} · {kickoffLabel(m.kickoffAt)}
                  {m.venue ? ` · ${m.venue}` : ''}
                </AppText>
              </Card>

              {error ? (
                <AppText variant="small" tone="danger" accessibilityRole="alert">
                  {error}
                </AppText>
              ) : null}

              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Durum" />
                <View style={modStyles.chips}>
                  {STATUS_OPTIONS.map((o) => (
                    <Chip key={o.status} label={o.label} active={m.status === o.status} onPress={() => m.status !== o.status && void update(`status:${o.status}`, { status: o.status })} />
                  ))}
                </View>
                <AppText variant="caption" tone="subtle">
                  Canlıya alınca skor 0–0 olur ve “Maç başladı” bildirimi gider; devre arası ve maç sonu olayları kendiliğinden eklenir.
                  Maç sonunda sonuç bildirimi gönderilir.
                </AppText>
                {m.status === 'live' ? (
                  <View style={styles.minuteRow}>
                    <AppText variant="bodyStrong">Dakika {m.minute ?? '–'}'</AppText>
                    {[-1, 1, 5].map((step) => (
                      <Button
                        key={step}
                        label={step > 0 ? `+${step}` : String(step)}
                        variant="secondary"
                        loading={busy === `min${step}`}
                        onPress={() => void update(`min${step}`, { minute: Math.min(130, Math.max(0, (m.minute ?? 0) + step)) })}
                      />
                    ))}
                  </View>
                ) : null}
              </View>

              {started ? (
                <EventForm
                  key={m.minute ?? 0}
                  match={m}
                  onSubmit={async (ev) => {
                    await matches.addEvent(m.id, ev);
                    refresh();
                  }}
                />
              ) : (
                <AppText variant="small" tone="muted">
                  Gol, kart ve değişiklik girmek için maçı “Canlı” yap.
                </AppText>
              )}

              {started ? (
                <View style={{ gap: spacing.sm }}>
                  <PressableScale accessibilityRole="button" onPress={() => setFixScore((v) => !v)} style={styles.link}>
                    <AppText variant="small" style={{ color: colors.goldSoft, fontWeight: '700' }}>
                      {fixScore ? 'Skor düzeltmeyi kapat' : 'Skoru elle düzelt'}
                    </AppText>
                  </PressableScale>
                  {fixScore ? (
                    <View style={styles.box}>
                      <AppText variant="caption" tone="subtle">
                        Goller skoru kendiliğinden günceller; bunu yalnızca yanlış girilen bir skoru düzeltmek için kullan.
                      </AppText>
                      {(['home', 'away'] as const).map((side) => {
                        const value = (side === 'home' ? m.homeScore : m.awayScore) ?? 0;
                        const patch = (v: number): MatchPatch => (side === 'home' ? { homeScore: v } : { awayScore: v });
                        return (
                          <View key={side} style={styles.minuteRow}>
                            <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                              {side === 'home' ? m.homeTeam : m.awayTeam}: {value}
                            </AppText>
                            <Button label="−1" variant="secondary" disabled={value === 0} onPress={() => void update(`${side}-`, patch(value - 1))} />
                            <Button label="+1" variant="secondary" onPress={() => void update(`${side}+`, patch(value + 1))} />
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Olaylar" />
                {d.events.length === 0 ? (
                  <AppText variant="small" tone="subtle">
                    Henüz olay yok.
                  </AppText>
                ) : (
                  <View style={styles.list}>
                    {d.events.map((e) => (
                      <View key={e.id} style={styles.eventRow}>
                        <AppText variant="bodyStrong" style={styles.minute}>
                          {eventMinuteLabel(e)}
                        </AppText>
                        <View style={{ flex: 1, gap: 2 }}>
                          <AppText variant="small" style={{ fontWeight: '700' }}>
                            {EVENT_LABEL[e.type]}
                            {e.side ? ` · ${e.side === 'home' ? m.homeTeam : m.awayTeam}` : ''}
                          </AppText>
                          {e.player || e.detail ? (
                            <AppText variant="caption" tone="muted">
                              {[e.player, e.detail].filter(Boolean).join(' · ')}
                            </AppText>
                          ) : null}
                        </View>
                        {confirmDelete === e.id ? (
                          <View style={modStyles.row}>
                            <Button
                              label="Sil"
                              loading={busy === `del:${e.id}`}
                              onPress={async () => {
                                setBusy(`del:${e.id}`);
                                setError(null);
                                try {
                                  await matches.deleteEvent(e.id);
                                  setConfirmDelete(null);
                                  refresh();
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : 'Olay silinemedi.');
                                } finally {
                                  setBusy(null);
                                }
                              }}
                            />
                            <Button label="Vazgeç" variant="ghost" onPress={() => setConfirmDelete(null)} />
                          </View>
                        ) : (
                          <IconButton icon="trash-outline" label={`${eventMinuteLabel(e)} ${EVENT_LABEL[e.type]} olayını sil`} onPress={() => setConfirmDelete(e.id)} />
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Bilgiler" />
                {editing ? (
                  <MatchForm
                    title="Maç bilgilerini düzenle"
                    submitLabel="Kaydet"
                    initial={m}
                    onCancel={() => setEditing(false)}
                    onSubmit={async (input) => {
                      await matches.updateMatch(m.id, input);
                      refresh();
                      setEditing(false);
                    }}
                  />
                ) : (
                  <View style={modStyles.row}>
                    <Button label="Bilgileri düzenle" variant="secondary" icon="create-outline" onPress={() => setEditing(true)} />
                    {m.topicId ? (
                      <Button label="Maç konusu" variant="ghost" icon="chatbubbles-outline" onPress={() => router.push(`/konu/${m.topicId}`)} />
                    ) : null}
                  </View>
                )}
              </View>

              <View style={styles.note}>
                <Ionicons name="document-text-outline" size={16} color={colors.textSubtle} />
                <AppText variant="caption" tone="subtle" style={{ flex: 1 }}>
                  Bu ekrandaki her değişiklik moderasyon kaydına işlenir (Moderasyon → Kayıt).
                </AppText>
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
  board: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  minuteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  link: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' },
  box: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  minute: { width: 58, color: colors.goldSoft },
  score: { color: colors.goldSoft, flexShrink: 0, fontSize: 34, lineHeight: 40 },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
