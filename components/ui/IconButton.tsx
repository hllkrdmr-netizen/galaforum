import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
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
}

export function IconButton({ icon, label, onPress, size = 20, style, tone = 'default' }: IconButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ hovered }) => [styles.base, hovered && styles.hovered, style]}
    >
      <Ionicons name={icon} size={size} color={tone === 'gold' ? colors.gold : colors.text} />
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
});
