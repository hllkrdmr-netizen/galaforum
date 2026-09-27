import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, gradients, layout, radius, shadows, spacing } from '../../constants/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  size = 'md',
  style,
  accessibilityHint,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const fg = isPrimary ? colors.textOnGold : variant === 'secondary' ? colors.goldSoft : colors.text;
  const height = size === 'lg' ? 52 : layout.minTouchTarget;

  const content = (
    <View style={[styles.inner, { height, paddingHorizontal: size === 'lg' ? spacing.xxl : spacing.xl }]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <AppText variant="button" style={{ color: fg }}>
            {label}
          </AppText>
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.base,
        variant === 'secondary' && styles.secondary,
        isPrimary && shadows.gold,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, overflow: 'hidden', alignSelf: 'flex-start' },
  gradient: { borderRadius: radius.pill },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  secondary: { borderWidth: 1, borderColor: colors.borderGold, backgroundColor: 'rgba(217,164,65,0.06)' },
  disabled: { opacity: 0.5 },
});
