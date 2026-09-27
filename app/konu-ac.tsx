import { PollEditor } from '../features/forum/Interactions';
import type { PollInput } from '../types/forum';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Container, PressableScale, ScreenHeader } from '../components/ui';
import { CATEGORY_BY_SLUG, DEFAULT_CATEGORIES } from '../constants/categories';
import { colors, fonts, radius, spacing } from '../constants/theme';
import { CategoryIcon } from '../features/forum/CategoryIcon';
import { invalidateQueries } from '../hooks/useForumQuery';
import { POST_BODY_MAX, TOPIC_TITLE_MAX, hasErrors, validateTopicInput } from '../lib/validation';
import type { TopicValidationErrors } from '../lib/validation';
import { ForumError, forum } from '../services/forum';

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

export default function CreateTopicScreen() {
  const params = useLocalSearchParams<{ kategori?: string }>();
  const [categorySlug, setCategorySlug] = useState(params.kategori && CATEGORY_BY_SLUG[params.kategori] ? params.kategori : '');
  const [title, setTitle] = useState('');
  const [poll, setPoll] = useState<PollInput>();
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<TopicValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const publish = async () => {
    const input = { categorySlug, title, body, poll };
    const v = validateTopicInput(input);
    setErrors(v);
    setSubmitError(null);
    if (hasErrors(v)) return;
    setSubmitting(true);
    try {
      const { id } = await forum.createTopic(input);
      invalidateQueries('forum:');
      router.replace(`/konu/${id}`);
    } catch (e) {
      setSubmitError(e instanceof ForumError ? e.message : 'Konu yayımlanamadı. Lütfen tekrar dene.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Konu Aç" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Container style={{ maxWidth: 760, paddingTop: spacing.xxl }}>
          <AppText variant="h1" accessibilityRole="header">Yeni tartışma</AppText>
          <AppText variant="small" tone="muted" style={{ marginTop: spacing.xs }}>
            Açmadan önce aramayı kullan; benzer bir konu varsa oraya katılmak tartışmayı güçlendirir.
          </AppText>

          <AppText variant="overline" tone="gold" uppercase style={styles.label}>
            1 · Kategori
          </AppText>
          <View style={styles.cats} accessibilityRole="radiogroup">
            {DEFAULT_CATEGORIES.map((c) => {
              const selected = c.slug === categorySlug;
              return (
                <PressableScale
                  key={c.slug}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={c.name}
                  onPress={() => setCategorySlug(c.slug)}
                  style={[styles.cat, selected && styles.catSelected]}
                >
                  <CategoryIcon icon={c.icon} size={28} />
                  <AppText variant="small" style={{ fontWeight: '600', color: selected ? colors.goldSoft : colors.text }}>
                    {c.name}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
          {errors.categorySlug ? <AppText variant="caption" tone="danger">{errors.categorySlug}</AppText> : null}

          <AppText variant="overline" tone="gold" uppercase style={styles.label}>
            2 · Başlık
          </AppText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={TOPIC_TITLE_MAX}
            placeholder="Tartışmanın özünü tek cümlede anlat"
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel="Konu başlığı"
            style={[styles.input, errors.title && styles.inputError, webNoOutline]}
          />
          <View style={styles.helpRow}>
            <AppText variant="caption" tone="danger">{errors.title ?? ''}</AppText>
            <AppText variant="caption" tone="subtle">{title.trim().length}/{TOPIC_TITLE_MAX}</AppText>
          </View>

          <AppText variant="overline" tone="gold" uppercase style={styles.label}>
            3 · Mesaj
          </AppText>
          <TextInput
            value={body}
            onChangeText={setBody}
            maxLength={POST_BODY_MAX}
            multiline
            textAlignVertical="top"
            placeholder="Görüşünü gerekçeleriyle yaz. Alıntı için satırın başına > koyabilirsin."
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel="Konu mesajı"
            style={[styles.input, styles.textarea, errors.body && styles.inputError, webNoOutline]}
          />
          <View style={styles.helpRow}>
            <AppText variant="caption" tone="danger">{errors.body ?? ''}</AppText>
            <AppText variant="caption" tone="subtle">{body.trim().length}</AppText>
          </View>

          <PollEditor value={poll} onChange={setPoll} />

          {submitError ? (
            <View style={styles.alert} accessibilityRole="alert">
              <AppText variant="small" tone="danger">{submitError}</AppText>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Button label="Yayımla" icon="send" size="lg" loading={submitting} onPress={publish} />
            <Button label="Vazgeç" variant="ghost" size="lg" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          </View>
          {forum.mode === 'demo' ? (
            <AppText variant="caption" tone="subtle" style={{ marginTop: spacing.md }}>
              Demo modu: açtığın konu yalnızca bu oturumda saklanır. Kalıcı kayıt için hesap ve veritabanı bağlantısı gerekir.
            </AppText>
          ) : null}
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  label: { marginTop: spacing.xxl, marginBottom: spacing.sm },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 44,
  },
  catSelected: { borderColor: colors.gold, backgroundColor: 'rgba(217,164,65,0.10)' },
  input: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgRaised,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  textarea: { minHeight: 200, lineHeight: 24 },
  inputError: { borderColor: colors.danger },
  helpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs, minHeight: 16 },
  alert: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(228,106,94,0.4)', backgroundColor: 'rgba(228,106,94,0.08)' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl, flexWrap: 'wrap' },
});
