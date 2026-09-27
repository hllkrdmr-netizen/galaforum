import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '../../components/ui';
import { DEFAULT_CATEGORIES } from '../../constants/categories';
import { colors, radius, spacing } from '../../constants/theme';
import { invalidateQueries } from '../../hooks/useForumQuery';
import { useStaff } from '../../hooks/useModeration';
import { moderation } from '../../services/moderation';
import type { TopicFlag } from '../../types/moderation';
import { ActionBox, Chip, modStyles } from './ModParts';

interface TopicLike {
  id: string;
  title: string;
  isPinned: boolean;
  isLocked: boolean;
  category: { slug: string };
}

type Mode = null | 'move' | 'hide';

/** Staff-only, collapsed by default: pin, lock, move and hide for the topic being read. */
export function TopicModTools({ topic }: { topic: TopicLike }) {
  const { isStaff, demo } = useStaff();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  if (!isStaff) return null;

  const run = async (key: string, fn: () => Promise<void>, message: string) => {
    setBusy(key);
    setError(null);
    setDone(null);
    try {
      await fn();
      invalidateQueries('forum:');
      invalidateQueries('mod:');
      setDone(message);
      setMode(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusy(null);
    }
  };

  const flag = (f: TopicFlag, on: boolean, message: string) => run(f, () => moderation.setTopicFlag(topic.id, f, on), message);

  return (
    <View style={styles.wrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Moderasyon araçları"
        onPress={() => setOpen((o) => !o)}
        style={({ hovered }) => [styles.toggle, open && styles.toggleOpen, hovered && { borderColor: colors.borderGold }]}
      >
        <Ionicons name="shield-half-outline" size={15} color={colors.gold} />
        <AppText variant="small" style={{ fontWeight: '700', color: colors.goldSoft }}>
          Moderasyon{demo ? ' (demo)' : ''}
        </AppText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSubtle} />
      </PressableScale>

      {open ? (
        <View style={styles.panel}>
          <View style={modStyles.row}>
            <Chip
              icon="pin-outline"
              label={topic.isPinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
              active={topic.isPinned}
              onPress={() => void flag('pinned', !topic.isPinned, topic.isPinned ? 'Sabitleme kaldırıldı.' : 'Konu sabitlendi.')}
            />
            <Chip
              icon={topic.isLocked ? 'lock-open-outline' : 'lock-closed-outline'}
              label={topic.isLocked ? 'Kilidi aç' : 'Kilitle'}
              active={topic.isLocked}
              onPress={() => void flag('locked', !topic.isLocked, topic.isLocked ? 'Konu yanıtlara açıldı.' : 'Konu kilitlendi.')}
            />
            <Chip icon="swap-horizontal-outline" label="Taşı" active={mode === 'move'} onPress={() => setMode(mode === 'move' ? null : 'move')} />
            <Chip icon="eye-off-outline" label="Gizle" danger active={mode === 'hide'} onPress={() => setMode(mode === 'hide' ? null : 'hide')} />
          </View>

          {busy && !mode ? (
            <AppText variant="caption" tone="subtle">
              Kaydediliyor…
            </AppText>
          ) : null}
          {done ? (
            <AppText variant="small" style={{ color: colors.success }}>
              {done}
            </AppText>
          ) : null}
          {error && !mode ? (
            <AppText variant="small" tone="danger">
              {error}
            </AppText>
          ) : null}

          {mode === 'move' ? (
            <ActionBox
              title="Hangi kategoriye taşınsın?"
              confirmLabel="Taşı"
              required={false}
              busy={busy === 'move'}
              error={error}
              onCancel={() => setMode(null)}
              onConfirm={(reason) => {
                if (!target) return setError('Bir kategori seç.');
                void run('move', () => moderation.moveTopic(topic.id, target, reason), 'Konu taşındı.');
              }}
            >
              <View style={modStyles.chips}>
                {DEFAULT_CATEGORIES.filter((c) => c.slug !== topic.category.slug).map((c) => (
                  <Chip key={c.slug} label={c.name} active={target === c.slug} onPress={() => setTarget(c.slug)} />
                ))}
              </View>
            </ActionBox>
          ) : null}

          {mode === 'hide' ? (
            <ActionBox
              title="Konuyu herkesten gizle"
              confirmLabel="Konuyu gizle"
              required
              danger
              busy={busy === 'hide'}
              error={error}
              onCancel={() => setMode(null)}
              onConfirm={(reason) =>
                void run(
                  'hide',
                  async () => {
                    await moderation.setTopicFlag(topic.id, 'hidden', true, reason);
                    router.replace(`/kategori/${topic.category.slug}`);
                  },
                  'Konu gizlendi.',
                )
              }
            >
              <AppText variant="small" tone="muted">
                Konu ve tüm mesajları listelerden, aramadan ve profillerden kalkar; açık şikâyetleri kapanır. Konu sahibine
                gerekçeyle birlikte bildirim gider. Moderasyon panelindeki “Gizlenenler”den geri getirilebilir.
              </AppText>
            </ActionBox>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, gap: spacing.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(217,164,65,0.06)',
  },
  toggleOpen: { borderColor: colors.borderGold },
  panel: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
