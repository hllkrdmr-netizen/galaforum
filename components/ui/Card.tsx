import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { radius, shadows, spacing } from '../../constants/theme';
import { PressableScale } from './PressableScale';

type Tone = 'default' | 'wine' | 'live';

const GRADIENTS: Record<Tone, readonly [string, string, ...string[]]> = {
  default: ['#1B0A0F', '#120609'],
  wine: ['#3A0A17', '#1A0609', '#0F0507'],
  live: ['#4A0C19', '#2A070E', '#12060A'],
};

const BORDERS: Record<Tone, string> = {
  default: 'rgba(217,164,65,0.14)',
  wine: 'rgba(217,164,65,0.32)',
  live: 'rgba(255,90,78,0.45)',
};

/**
 * Premium surface for featured content (matches, featured topic, meetups).
 * Lists stay unboxed; cards are reserved for the few things that deserve emphasis.
 */
export function Card({
  children,
  tone = 'default',
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const body = (
    <>
      <LinearGradient colors={GRADIENTS[tone]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(242,201,76,0)', tone === 'live' ? 'rgba(255,120,100,0.55)' : 'rgba(242,201,76,0.5)', 'rgba(242,201,76,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.shine}
      />
      {children}
    </>
  );
  const base = [styles.card, { borderColor: BORDERS[tone] }, shadows.soft, style];
  if (onPress) {
    return (
      <PressableScale accessibilityRole="link" accessibilityLabel={accessibilityLabel} onPress={onPress} style={base}>
        {body}
      </PressableScale>
    );
  }
  return <View style={base}>{body}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden', padding: spacing.xl, gap: spacing.md },
  shine: { position: 'absolute', top: 0, left: 24, right: 24, height: 1 },
});
