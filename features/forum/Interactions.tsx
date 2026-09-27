import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { invalidateQueries, useForumQuery } from '../../hooks/useForumQuery';
import { forum } from '../../services/forum';
import type { PollInput, Post } from '../../types/forum';

export const interactionStyles = StyleSheet.create({
  input: { color: colors.text, backgroundColor: colors.bgRaised, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, minHeight: 48, fontSize: 16 },
  box: { gap: spacing.md, paddingVertical: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
export function PollEditor({ value, onChange }: { value: PollInput | undefined; onChange: (v: PollInput | undefined) => void }) {
  return <View style={interactionStyles.box}>
    <Button variant="secondary" label={value ? 'Anketi kaldır' : 'Anket ekle (isteğe bağlı)'} onPress={() => onChange(value ? undefined : { question: '', options: ['', ''] })} />
    {value && <>
      <TextInput accessibilityLabel="Anket sorusu" placeholder="Anket sorusu" placeholderTextColor={colors.textSubtle} style={interactionStyles.input} value={value.question} maxLength={200} onChangeText={question => onChange({ ...value, question })} />
      {value.options.map((option, i) => <View key={i} style={{ gap: spacing.xs }}>
        <TextInput accessibilityLabel={`Anket seçeneği ${i + 1}`} placeholder={`Seçenek ${i + 1}`} placeholderTextColor={colors.textSubtle} style={interactionStyles.input} value={option} maxLength={100} onChangeText={label => onChange({ ...value, options: value.options.map((o, n) => n === i ? label : o) })} />
        {value.options.length > 2 && <Button variant="ghost" label={`Seçenek ${i + 1} kaldır`} onPress={() => onChange({ ...value, options: value.options.filter((_, n) => n !== i) })} />}
      </View>)}
      {value.options.length < 6 && <Button variant="ghost" label="Seçenek ekle" onPress={() => onChange({ ...value, options: [...value.options, ''] })} />}
      <AppText variant="caption" tone="subtle">2–6 farklı seçenek. Her üyenin bir oyu vardır; seçim değiştirilebilir.</AppText>
    </>}
  </View>;
}
export function ReplyComposer({ topicId, quote, clearQuote, onSent }: { topicId: string; quote: Post | null; clearQuote: () => void; onSent: () => void }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await forum.reply({ topicId, body, quotePostId: quote?.id });
      setBody(''); clearQuote(); invalidateQueries('forum:'); onSent();
    } catch (e) { setError(e instanceof Error ? e.message : 'Yanıt gönderilemedi.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <View style={interactionStyles.box}>
    <AppText variant="h2">Yanıt yaz</AppText>
    {quote && <View><AppText tone="gold">{quote.author.username} mesajına alıntı</AppText><AppText numberOfLines={3}>{quote.body}</AppText><Button variant="ghost" label="Alıntıyı kaldır" onPress={clearQuote} /></View>}
    <TextInput accessibilityLabel="Yanıt mesajı" multiline editable={!busy} value={body} onChangeText={setBody} maxLength={10000} placeholder="Yanıtın… Bir üyeden @kullanici_adi ile bahset." placeholderTextColor={colors.textSubtle} style={[interactionStyles.input, { minHeight: 130, textAlignVertical: 'top' }]} />
    <AppText variant="caption" tone="subtle">{body.length}/10000 · @bahsetmeler kayıtlı kullanıcılarla eşleştirilir.</AppText>
    {error ? <AppText accessibilityRole="alert" tone="danger">{error}</AppText> : null}
    <Button label="Yanıtı gönder" loading={busy} disabled={!body.trim()} onPress={() => void submit()} />
    {forum.mode === 'demo' && <AppText variant="caption" tone="subtle">Demo: yanıtlar, beğeniler, bildirimler ve oylar yalnızca bu oturumda saklanır.</AppText>}
  </View>;
}
export function TopicPoll({ topicId, locked }: { topicId: string; locked: boolean }) {
  const poll = useForumQuery(`forum:poll:${topicId}`, () => forum.getPoll(topicId));
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const vote = async (id: string) => {
    if (!poll.data || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await forum.vote(poll.data.id, id); await poll.refetch(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Oy kaydedilemedi.'); }
    finally { pending.current = false; setBusy(false); }
  };
  if (poll.error) return <View><AppText tone="danger">{poll.error.message}</AppText><Button label="Anketi tekrar yükle" onPress={poll.refetch} /></View>;
  if (!poll.data) return null;
  const p = poll.data;
  return <View style={interactionStyles.box}>
    <AppText variant="h2">{p.question}</AppText>
    {p.options.map(o => <View key={o.id}>
      <Button variant={p.myOptionId === o.id ? 'primary' : 'secondary'} label={`${p.myOptionId === o.id ? '✓ ' : ''}${o.label}`} disabled={locked || busy} onPress={() => void vote(o.id)} />
      <AppText variant="caption" tone="muted">{o.votes} oy · %{p.totalVotes ? Math.round(o.votes / p.totalVotes * 100) : 0}</AppText>
    </View>)}
    <AppText variant="caption" tone="subtle">{p.totalVotes} oy · {locked ? 'Oylama kapalı' : 'Seçimini değiştirebilirsin'}</AppText>
    {error ? <AppText tone="danger" accessibilityRole="alert">{error}</AppText> : null}
  </View>;
}
