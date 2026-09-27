import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, PressableScale } from '../../components/ui';
import { colors, spacing } from '../../constants/theme';
import { invalidateQueries } from '../../hooks/useForumQuery';
import { moderation } from '../../services/moderation';
import type { Post } from '../../types/forum';
import { ActionBox } from './ModParts';

/** Menu entry shown to staff in a post's "⋯" menu (opening posts are handled by hiding the topic). */
export function RemovePostMenuItem({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={styles.menuItem}>
      <Ionicons name="trash-outline" size={16} color={colors.danger} />
      <AppText variant="small" style={{ color: colors.danger }}>
        Mesajı kaldır
      </AppText>
    </PressableScale>
  );
}

export function RemovePostBox({ post, onClose }: { post: Post; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  if (removed) {
    return (
      <View style={styles.done} accessibilityRole="alert">
        <AppText variant="small" tone="muted" style={{ flex: 1 }}>
          Mesaj kaldırıldı ve yazarına bildirildi.
        </AppText>
        <Button
          label="Geri al"
          variant="ghost"
          onPress={async () => {
            await moderation.restorePost(post.id, 'Kaldırma geri alındı').catch(() => undefined);
            invalidateQueries(`forum:topic:${post.topicId}:`);
            onClose();
          }}
        />
      </View>
    );
  }

  return (
    <ActionBox
      title={`${post.author.username} kullanıcısının mesajını kaldır`}
      confirmLabel="Mesajı kaldır"
      required
      danger
      busy={busy}
      error={error}
      onCancel={onClose}
      onConfirm={async (reason) => {
        setBusy(true);
        setError(null);
        try {
          await moderation.removePost(post.id, reason);
          setRemoved(true);
          invalidateQueries('mod:');
          // Let the moderator see the confirmation (and undo) before the post leaves the list.
          setTimeout(() => invalidateQueries(`forum:topic:${post.topicId}:`), 4000);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Mesaj kaldırılamadı.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <AppText variant="small" tone="muted">
        Mesaj konudan kalkar, açık şikâyetleri kapanır ve yazara gerekçe bildirilir. Moderasyon kaydından geri getirilebilir.
      </AppText>
    </ActionBox>
  );
}

const styles = StyleSheet.create({
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.lg },
  done: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
});
