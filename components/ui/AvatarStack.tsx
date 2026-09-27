import { StyleSheet, View } from 'react-native';

import { colors } from '../../constants/theme';
import type { AuthorSummary } from '../../types/forum';
import { AppText } from './AppText';
import { Avatar } from './Avatar';

/** Overlapping avatars with a "+N" counter — shows who is taking part at a glance. */
export function AvatarStack({ people, total, size = 28, max = 5 }: { people: AuthorSummary[]; total?: number; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  const rest = Math.max(0, (total ?? people.length) - shown.length);
  return (
    <View style={styles.row} accessible accessibilityLabel={`${total ?? people.length} kişi`}>
      {shown.map((p, i) => (
        <View key={p.id} style={[styles.ring, { marginLeft: i === 0 ? 0 : -size * 0.32, borderRadius: size }]}>
          <Avatar name={p.username} uri={p.avatarUrl} size={size} />
        </View>
      ))}
      {rest > 0 ? (
        <View style={[styles.more, { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.32 }]}>
          <AppText variant="caption" style={{ fontSize: 10, fontWeight: '800', color: colors.goldSoft }}>
            +{rest}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  ring: { borderWidth: 2, borderColor: colors.bg },
  more: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceStrong,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
