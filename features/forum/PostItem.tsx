import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { forum } from '../../services/forum';
import { invalidateQueries } from '../../hooks/useForumQuery';
import { interactionStyles } from './Interactions';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText, Avatar, Button, Pill, PressableScale } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { formatDateTime, formatPostTime } from '../../lib/format';
import type { Post, UserRole } from '../../types/forum';

const ROLE_LABEL: Partial<Record<UserRole, { label: string; tone: 'gold' | 'wine' | 'neutral' }>> = {
  moderator: { label: 'Moderatör', tone: 'wine' },
  admin: { label: 'Yönetici', tone: 'wine' },
  verified: { label: 'Onaylı Üye', tone: 'gold' },
};

/** Splits a post body into quote blocks (lines starting with ">") and regular paragraphs. */
function blocks(body: string) {
  const out: { quote: boolean; text: string }[] = [];
  for (const para of body.split(/\n{2,}/)) {
    const lines = para.split('\n');
    const isQuote = lines.every((l) => l.trimStart().startsWith('>'));
    out.push({ quote: isQuote, text: isQuote ? lines.map((l) => l.replace(/^\s*>\s?/, '')).join('\n') : para });
  }
  return out;
}

function Action({ icon, label, a11y, onPress, disabled, active }: {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  a11y: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(active) }}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered }) => [styles.action, hovered && { backgroundColor: colors.surfaceHover }]}
    >
      <Ionicons name={icon} size={18} color={active ? colors.wineBright : colors.textSubtle} />
      {label !== undefined ? (
        <AppText variant="caption" tone="subtle" style={{ fontWeight: '700' }}>
          {label}
        </AppText>
      ) : null}
    </PressableScale>
  );
}

export function PostItem({ post, index, onQuote }: { post: Post; index: number; onQuote?: (post: Post) => void }) {
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [message, setMessage] = useState('');
  const act = async (report: boolean) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      if (report) { await forum.report(post.id, reason); setReporting(false); setReason(''); setMessage('Bildirimin alındı.'); }
      else { await forum.setLike(post.id, !post.likedByMe); invalidateQueries(`forum:topic:${post.topicId}:`); }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'İşlem tamamlanamadı.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const role = post.author.role ? ROLE_LABEL[post.author.role] : undefined;
  const likes = post.likeCount ?? 0;
  return (
    <View style={styles.wrap} accessibilityLabel={`${post.author.username}, ${formatDateTime(post.createdAt)}`}>
      <View style={styles.head}>
        <PressableScale accessibilityRole="link" accessibilityLabel={`${post.author.username} profili`} onPress={() => router.push(`/uye/${post.author.username}`)}>
          <Avatar name={post.author.username} uri={post.author.avatarUrl} size={36} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <AppText variant="bodyStrong">{post.author.username}</AppText>
            {role ? <Pill label={role.label} tone={role.tone} /> : null}
          </View>
          <AppText variant="caption" tone="subtle" accessibilityLabel={formatDateTime(post.createdAt)}>
            {formatPostTime(post.createdAt)}
          </AppText>
        </View>
        <AppText variant="caption" tone="subtle">
          #{index + 1}
        </AppText>
      </View>
      <View style={styles.body}>
        {post.quote && <View style={styles.quote}><AppText variant="caption" tone="subtle" style={{ fontWeight: '700' }}>{post.quote.username} yazdı:</AppText><AppText variant="small" tone="muted">{post.quote.body}</AppText></View>}
        {blocks(post.body).map((b, i) =>
          b.quote ? (
            <View key={i} style={styles.quote}>
              <AppText variant="small" tone="muted" style={{ fontStyle: 'italic' }}>
                {b.text}
              </AppText>
            </View>
          ) : (
            <AppText key={i} variant="body" style={[styles.para, post.isOpeningPost && styles.openingPara]} selectable>
              {b.text.split(/(@[a-zA-Z0-9_]{3,24})/g).map((part, n) => {
                const user = post.mentions?.find(u => `@${u.username}`.toLowerCase() === part.toLowerCase());
                return user ? <AppText key={n} tone="gold" accessibilityRole="link" onPress={() => router.push(`/uye/${user.username}`)}>{part}</AppText> : part;
              })}
            </AppText>
          ),
        )}
      </View>
      <View style={styles.actions}>
        <Action
          icon={post.likedByMe ? 'heart' : 'heart-outline'}
          label={likes > 0 ? String(likes) : ''}
          a11y={`${post.likedByMe ? 'Beğeniyi kaldır' : 'Beğen'}, ${likes} beğeni`}
          active={post.likedByMe}
          disabled={busy}
          onPress={() => void act(false)}
        />
        {onQuote ? <Action icon="chatbox-ellipses-outline" a11y="Alıntıla" onPress={() => onQuote(post)} /> : null}
        <View style={{ flex: 1 }} />
        <Action icon="ellipsis-horizontal" a11y="Diğer seçenekler" onPress={() => setMenu((m) => !m)} />
      </View>
      {menu && !reporting ? (
        <View style={styles.menu}>
          <PressableScale accessibilityRole="button" onPress={() => { setMenu(false); setReporting(true); }} style={styles.menuItem}>
            <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
            <AppText variant="small">Bildir</AppText>
          </PressableScale>
        </View>
      ) : null}
      {reporting && <View style={interactionStyles.box}>
        <TextInput accessibilityLabel="Bildirim gerekçesi" value={reason} onChangeText={setReason} maxLength={1000} multiline placeholder="Bildirim gerekçesi (en az 5 karakter)" placeholderTextColor={colors.textSubtle} style={interactionStyles.input} />
        <View style={interactionStyles.actions}>
          <Button label="Bildirimi gönder" loading={busy} onPress={() => void act(true)} />
          <Button variant="ghost" label="Vazgeç" onPress={() => setReporting(false)} />
        </View>
      </View>}
      {message ? <AppText accessibilityRole="alert" variant="small" tone="muted">{message}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  body: { marginTop: spacing.md, gap: spacing.md, maxWidth: 720 },
  para: { fontSize: 16, lineHeight: 26 },
  openingPara: { fontSize: 17, lineHeight: 28 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 4,
    gap: 2,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, marginLeft: -spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, minWidth: 40, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  menu: { alignSelf: 'flex-end', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.bgRaised, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.lg },
});
