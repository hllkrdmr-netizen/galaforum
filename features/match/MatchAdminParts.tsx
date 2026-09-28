import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, TextField } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { ADMIN_EVENT_TYPES, EVENT_LABEL, validateMatchInput, validateNewEvent } from '../../lib/match';
import { parseDateTime } from '../../lib/meetups';
import type { Match, MatchEventType, MatchInput, NewMatchEvent } from '../../types/match';
import { Chip, modStyles } from '../moderation/ModParts';

const pad = (n: number) => String(n).padStart(2, '0');

function splitDate(iso: string | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '20:00' };
  const d = new Date(iso);
  return { date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** Create / edit match details. `onSubmit` may throw; the message is shown in the form. */
export function MatchForm({
  title,
  submitLabel,
  initial,
  onSubmit,
  onCancel,
}: {
  title: string;
  submitLabel: string;
  initial?: Match;
  onSubmit: (input: MatchInput) => Promise<void>;
  onCancel: () => void;
}) {
  const start = splitDate(initial?.kickoffAt);
  const [competition, setCompetition] = useState(initial?.competition ?? 'Süper Lig');
  const [homeTeam, setHomeTeam] = useState(initial?.homeTeam ?? 'Galatasaray');
  const [awayTeam, setAwayTeam] = useState(initial?.awayTeam ?? '');
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [venue, setVenue] = useState(initial?.venue ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const when = parseDateTime(date, time);
    if (!when) return setError('Tarih GG.AA.YYYY, saat SS:DD biçiminde olmalı.');
    const input: MatchInput = { competition, homeTeam, awayTeam, kickoffAt: when.toISOString(), venue };
    const problem = validateMatchInput(input);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await onSubmit(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <AppText variant="bodyStrong">{title}</AppText>
      <TextField label="Turnuva" value={competition} onChangeText={setCompetition} maxLength={80} placeholder="Süper Lig" />
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <TextField label="Ev sahibi" value={homeTeam} onChangeText={setHomeTeam} maxLength={60} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Deplasman" value={awayTeam} onChangeText={setAwayTeam} maxLength={60} placeholder="Rakip takım" />
        </View>
      </View>
      <Button
        label="Ev sahibi ↔ deplasman"
        variant="ghost"
        icon="swap-horizontal-outline"
        onPress={() => {
          setHomeTeam(awayTeam);
          setAwayTeam(homeTeam);
        }}
        style={{ alignSelf: 'flex-start' }}
      />
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <TextField label="Tarih" value={date} onChangeText={setDate} placeholder="GG.AA.YYYY" keyboardType="numbers-and-punctuation" maxLength={10} />
        </View>
        <View style={{ width: 120 }}>
          <TextField label="Saat" value={time} onChangeText={setTime} placeholder="SS:DD" keyboardType="numbers-and-punctuation" maxLength={5} />
        </View>
      </View>
      <TextField label="Stat (isteğe bağlı)" value={venue} onChangeText={setVenue} maxLength={120} placeholder="RAMS Park" />
      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}
      <View style={modStyles.row}>
        <Button label={submitLabel} loading={busy} onPress={() => void submit()} />
        <Button label="Vazgeç" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

/** Quick event entry: type → team → minute (+ optional player/detail). */
export function EventForm({ match, onSubmit }: { match: Match; onSubmit: (e: NewMatchEvent) => Promise<void> }) {
  const [type, setType] = useState<MatchEventType>('goal');
  const [side, setSide] = useState<'home' | 'away' | null>(null);
  const [minute, setMinute] = useState(match.minute ? String(match.minute) : '');
  const [extra, setExtra] = useState('');
  const [player, setPlayer] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async () => {
    const ev: NewMatchEvent = {
      minute: Number.parseInt(minute, 10),
      extraMinute: extra.trim() ? Number.parseInt(extra, 10) : null,
      type,
      side,
      player: player.trim() || null,
      detail: detail.trim() || null,
    };
    const problem = Number.isNaN(ev.minute) ? 'Dakikayı yaz.' : validateNewEvent(ev);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await onSubmit(ev);
      setDone(`${ev.minute}' ${EVENT_LABEL[type]} eklendi.`);
      setPlayer('');
      setDetail('');
      setExtra('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Olay eklenemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <AppText variant="bodyStrong">Olay ekle</AppText>
      <View style={modStyles.chips}>
        {ADMIN_EVENT_TYPES.map((t) => (
          <Chip key={t} label={EVENT_LABEL[t]} active={type === t} onPress={() => setType(t)} />
        ))}
      </View>
      <View style={modStyles.chips}>
        <Chip label={match.homeTeam} active={side === 'home'} onPress={() => setSide(side === 'home' ? null : 'home')} />
        <Chip label={match.awayTeam} active={side === 'away'} onPress={() => setSide(side === 'away' ? null : 'away')} />
      </View>
      {type === 'own_goal' ? (
        <AppText variant="caption" tone="subtle">
          Kendi kalesine golde topu kendi ağlarına gönderen oyuncunun takımını seç; gol diğer takıma yazılır.
        </AppText>
      ) : null}
      <View style={styles.pair}>
        <View style={{ width: 110 }}>
          <TextField label="Dakika" value={minute} onChangeText={setMinute} keyboardType="number-pad" maxLength={3} placeholder="23" />
        </View>
        <View style={{ width: 110 }}>
          <TextField label="Uzatma" value={extra} onChangeText={setExtra} keyboardType="number-pad" maxLength={2} placeholder="+2" />
        </View>
        <View style={{ flex: 1, minWidth: 160 }}>
          <TextField label="Oyuncu (isteğe bağlı)" value={player} onChangeText={setPlayer} maxLength={80} />
        </View>
      </View>
      <TextField label="Not (isteğe bağlı)" value={detail} onChangeText={setDetail} maxLength={200} placeholder="Ceza sahası dışından sert şut" />
      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}
      {done ? (
        <AppText variant="small" style={{ color: colors.success }}>
          {done}
        </AppText>
      ) : null}
      <Button label="Olayı ekle" icon="add-circle-outline" loading={busy} onPress={() => void submit()} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
