import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors, gradients } from '../../constants/theme';

/** Thin gold progress bar (0–1). Optional marks (0–1) for things like half-time. */
export function ProgressBar({ value, marks = [], height = 4, label }: { value: number; marks?: number[]; height?: number; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View
      style={[styles.track, { height, borderRadius: height }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
    >
      <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${v * 100}%` as `${number}%`, borderRadius: height }]} />
      {marks.map((m) => (
        <View key={m} style={[styles.mark, { left: `${m * 100}%` as `${number}%` }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: 'rgba(245,239,230,0.08)', overflow: 'hidden' },
  fill: { height: '100%' },
  mark: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.bg },
});
