import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, PressableScale } from '../../components/ui';
import { colors, spacing } from '../../constants/theme';
import { formatRelativeTime } from '../../lib/format';
import { describeNotification, notificationText } from '../../lib/notifications';
import type { NotificationView } from '../../lib/notifications';
import type { AppNotification } from '../../types/notification';

const TONE: Record<NotificationView['tone'], { bg: string; fg: string }> = {
  gold: { bg: colors.gold, fg: colors.textOnGold },
  wine: { bg: colors.wineBright, fg: colors.text },
  live: { bg: '#B3243C', fg: colors.text },
  muted: { bg: '#4A3A3E', fg: colors.text },
};

/** Avatar (or a system emblem) with a small kind badge in the corner. */
function Emblem({ n, view }: { n: AppNotification; view: NotificationView }) {
  const tone = TONE[view.tone];
  return (
    <View style={styles.emblem}>
      {n.actor ? (
        <Avatar name={n.actor.username} uri={n.actor.avatarUrl} size={40} />
      ) : (
        <View style={[styles.system, view.tone === 'live' && styles.systemLive]}>
          <Ionicons name={view.icon} size={19} color={view.tone === 'live' ? colors.text : colors.gold} />
        </View>
      )}
      {n.actor ? (
        <View style={[styles.kind, { backgroundColor: tone.bg }]}>
          <Ionicons name={view.icon} size={10} color={tone.fg} />
        </View>
      ) : null}
    </View>
  );
}

export function NotificationItem({ item, me, onOpen }: { item: AppNotification; me?: string | null; onOpen: (n: AppNotification) => void }) {
  const view = describeNotification(item, me);
  const unread = !item.readAt;
  return (
    <PressableScale
      accessibilityRole={view.href ? 'link' : 'text'}
      accessibilityLabel={`${unread ? 'Okunmamış. ' : ''}${notificationText(item)}. ${formatRelativeTime(item.createdAt)}`}
      onPress={() => onOpen(item)}
      style={({ hovered }) => [styles.row, unread && styles.unread, hovered && styles.hovered]}
    >
      {unread ? <View style={styles.rail} /> : null}
      <Emblem n={item} view={view} />
      <View style={styles.main}>
        <AppText variant="small" numberOfLines={3} style={{ color: unread ? colors.text : colors.textMuted }}>
          <AppText variant="small" style={styles.strong}>
            {view.lead}
          </AppText>
          {view.action ? ` ${view.action}` : ''}
          {view.subject ? ' ' : ''}
          {view.subject ? (
            <AppText variant="small" style={[styles.strong, { color: unread ? colors.goldSoft : colors.text }]}>
              {view.subject}
            </AppText>
          ) : null}
        </AppText>
        {view.preview ? (
          <AppText variant="caption" tone="subtle" numberOfLines={1}>
            {view.preview}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="subtle" style={{ marginTop: 2 }}>
          {formatRelativeTime(item.createdAt)}
        </AppText>
      </View>
      {unread ? <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no" /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 72,
  },
  unread: { backgroundColor: 'rgba(107,20,38,0.16)' },
  hovered: { backgroundColor: colors.surfaceHover },
  rail: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, backgroundColor: colors.gold },
  emblem: { width: 40, height: 40 },
  system: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217,164,65,0.10)',
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  systemLive: { backgroundColor: 'rgba(179,36,60,0.85)', borderColor: 'rgba(255,255,255,0.18)' },
  kind: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  main: { flex: 1, gap: 2 },
  strong: { fontWeight: '700', color: colors.text },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginTop: 6 },
});
