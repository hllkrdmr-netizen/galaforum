import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Pill } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { formatDateTime, formatRelativeTime } from '../../lib/format';
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

export function PostItem({ post, index }: { post: Post; index: number }) {
  const role = post.author.role ? ROLE_LABEL[post.author.role] : undefined;
  return (
    <View style={[styles.wrap, post.isOpeningPost && styles.opening]} accessibilityLabel={`${post.author.username}, ${formatDateTime(post.createdAt)}`}>
      <View style={styles.head}>
        <Avatar name={post.author.username} uri={post.author.avatarUrl} size={40} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <AppText variant="bodyStrong">{post.author.username}</AppText>
            {role ? <Pill label={role.label} tone={role.tone} /> : null}
          </View>
          <AppText variant="caption" tone="subtle">
            {formatRelativeTime(post.createdAt)} · {formatDateTime(post.createdAt)}
          </AppText>
        </View>
        <AppText variant="caption" tone="subtle">
          #{index + 1}
        </AppText>
      </View>
      <View style={styles.body}>
        {blocks(post.body).map((b, i) =>
          b.quote ? (
            <View key={i} style={styles.quote}>
              <AppText variant="small" tone="muted" style={{ fontStyle: 'italic' }}>
                {b.text}
              </AppText>
            </View>
          ) : (
            <AppText key={i} variant="body" style={styles.para} selectable>
              {b.text}
            </AppText>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  opening: {
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderGold,
    marginBottom: spacing.lg,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  body: { marginTop: spacing.md, gap: spacing.md, maxWidth: 720 },
  para: { fontSize: 16, lineHeight: 26 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.borderGold,
    backgroundColor: 'rgba(217,164,65,0.05)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 4,
  },
});
