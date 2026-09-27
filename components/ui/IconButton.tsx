import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, layout, radius } from '../../constants/theme';
import { PressableScale } from './PressableScale';

export interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'gold';
  /** Small gold counter in the corner (e.g. unread notifications). Hidden when empty. */
  badge?: string;
}

export function IconButton({ icon, label, onPress, size = 20, style, tone = 'default', badge }: IconButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} yeni` : label}
      onPress={onPress}
      style={({ hovered }) => [styles.base, hovered && styles.hovered, style]}
    >
      <Ionicons name={icon} size={size} color={tone === 'gold' ? colors.gold : colors.text} />
      {badge ? (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText} numberOfLines={1}>
            {badge}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,5,7,0.45)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  hovered: { borderColor: colors.borderGold },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: colors.textOnGold, fontSize: 10, fontWeight: '800', lineHeight: 12 },
});
