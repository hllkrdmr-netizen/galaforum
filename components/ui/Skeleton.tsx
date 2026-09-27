import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

import { radius, spacing } from '../../constants/theme';

const NATIVE_DRIVER = Platform.OS !== 'web';

export function Skeleton({
  width = '100%',
  height = 14,
  style,
  rounded = radius.sm,
}: {
  width?: DimensionValue;
  height?: number;
  style?: StyleProp<ViewStyle>;
  rounded?: number;
}) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (reduce || cancelled) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: NATIVE_DRIVER }),
            Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: NATIVE_DRIVER }),
          ]),
        );
        loop.start();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { width, height, borderRadius: rounded, opacity }, style]}
    />
  );
}

/** Skeleton for a list row with an icon, two text lines and a trailing meta block. */
export function SkeletonRow() {
  return (
    <View style={styles.row} accessibilityLabel="Yükleniyor">
      <Skeleton width={44} height={44} rounded={radius.md} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton width="55%" height={15} />
        <Skeleton width="85%" height={12} />
      </View>
      <Skeleton width={48} height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: 'rgba(245,239,230,0.08)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
});
