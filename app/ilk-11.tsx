import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Container, PressableScale, ScreenHeader, TextField } from '../components/ui';
import { colors, radius, spacing } from '../constants/theme';
import { Notice } from '../features/auth/AuthLayout';
import { SignInPrompt } from '../features/auth/SignInPrompt';
import { LineupBuilder } from '../features/match/LineupBuilder';
import { invalidateQueries, useForumQuery } from '../hooks/useForumQuery';
import { changeFormation, FORMATION_LIST, FORMATIONS, lineupToText, matchTitle, validateLineup } from '../lib/match';
import { forum } from '../services/forum';
import { matches } from '../services/match';
import type { Formation, Lineup } from '../types/match';

export default function LineupScreen() {
  const { mac } = useLocalSearchParams<{ mac?: string }>();
  const matchId = mac ? String(mac) : null;
  const detail = useForumQuery(`match:detail:${matchId}`, () => matches.getMatch(matchId!), { enabled: Boolean(matchId) });
  const squad = useForumQuery('match:squad', () => matches.getSquad(), { staleTime: 10 * 60_000 });
  const saved = useForumQuery(`match:lineup:${matchId}`, () => matches.getMyLineup(matchId));
  const match = detail.data?.match ?? null;

  const [lineup, setLineup] = useState<Lineup>({ matchId, formation: '4-2-3-1', players: {} });
  const [custom, setCustom] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);

  // Restore the member's last saved lineup for this match once.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (restored || saved.isLoading) return;
    if (saved.data) {
      setLineup({ ...saved.data, matchId });
      setCustom(Object.values(saved.data.players));
    }
    setRestored(true);
  }, [saved.data, saved.isLoading, restored, matchId]);

  const squadNames = (squad.data ?? []).map((p) => p.name);
  const pool = [...new Set([...squadNames, ...custom])];
  const filled = Object.keys(lineup.players).length;
  const total = FORMATIONS[lineup.formation].length;

  const addName = () => {
    const n = newName.trim().replace(/\s+/g, ' ');
    if (n.length < 2 || n.length > 40) return setMessage({ tone: 'error', text: 'Oyuncu adı 2–40 karakter olmalı.' });
    if (pool.some((p) => p.toLocaleLowerCase('tr-TR') === n.toLocaleLowerCase('tr-TR'))) return setNewName('');
    setCustom((c) => [...c, n]);
    setNewName('');
    setMessage(null);
  };

  const save = async () => {
    setBusy('save');
    setMessage(null);
    try {
      await matches.saveLineup(lineup);
      invalidateQueries('match:lineup:');
      setMessage({ tone: 'success', text: 'İlk 11’in kaydedildi.' });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Kaydedilemedi.' });
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    const problem = validateLineup(lineup);
    if (problem) return setMessage({ tone: 'error', text: problem });
    setBusy('share');
    setMessage(null);
    try {
      const body = lineupToText(lineup, match);
      if (match?.topicId) {
        await forum.reply({ topicId: match.topicId, body });
        invalidateQueries('forum:');
        router.push(`/konu/${match.topicId}`);
      } else {
        const { id } = await forum.createTopic({
          categorySlug: 'mac-taktik',
          title: `İlk 11 önerim: ${lineup.formation}`,
          body,
        });
        invalidateQueries('forum:');
        router.push(`/konu/${id}`);
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Paylaşılamadı.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="İlk 11" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Container style={{ paddingTop: spacing.xl, gap: spacing.lg, maxWidth: 620 }}>
          <View>
            <AppText variant="h1" accessibilityRole="header">
              İlk 11’ini kur
            </AppText>
            <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>
              {match ? `${matchTitle(match)} · ` : ''}Oyuncuyu sahaya sürükle ya da önce pozisyona, sonra oyuncuya dokun.
            </AppText>
          </View>

          <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Diziliş">
            {FORMATION_LIST.map((f: Formation) => {
              const on = lineup.formation === f;
              return (
                <PressableScale
                  key={f}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={f}
                  onPress={() => setLineup((l) => changeFormation(l, f))}
                  style={[styles.formation, on && styles.formationOn]}
                >
                  <AppText variant="small" style={{ fontWeight: '800', color: on ? colors.goldSoft : colors.textMuted }}>
                    {f}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>

          <LineupBuilder lineup={lineup} pool={pool} onChange={setLineup} />

          <View style={styles.addRow}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Oyuncu ekle"
                value={newName}
                onChangeText={setNewName}
                placeholder="Oyuncu adı"
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={addName}
                hint={squadNames.length ? undefined : 'Resmi kadro listesi eklenene kadar oyuncuları kendin yazabilirsin.'}
              />
            </View>
            <Button label="Ekle" variant="secondary" onPress={addName} style={{ marginTop: 24 }} />
          </View>

          <AppText variant="caption" tone="subtle">
            {filled}/{total} pozisyon dolu
          </AppText>

          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          <SignInPrompt message="İlk 11’ini kaydetmek ve paylaşmak için giriş yap." />

          <View style={styles.row}>
            <Button label={match?.topicId ? 'Maç konusunda paylaş' : 'Konu olarak paylaş'} icon="share-social-outline" loading={busy === 'share'} disabled={filled < total} onPress={() => void share()} />
            <Button label="Kaydet" variant="secondary" loading={busy === 'save'} disabled={filled < total} onPress={() => void save()} />
            <Button label="Temizle" variant="ghost" disabled={filled === 0} onPress={() => setLineup((l) => ({ ...l, players: {} }))} />
          </View>
        </Container>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  formation: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  formationOn: { borderColor: colors.gold, backgroundColor: 'rgba(217,164,65,0.12)' },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
