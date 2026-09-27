import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Platform, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';
import { AppText } from '../ui/AppText';
import { PressableScale } from '../ui/PressableScale';

type IconName = keyof typeof Ionicons.glyphMap;

export const TAB_ITEMS: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'Gündem', icon: 'flame-outline', iconActive: 'flame' },
  mac: { label: 'Maç', icon: 'football-outline', iconActive: 'football' },
  transfer: { label: 'Transfer', icon: 'swap-horizontal-outline', iconActive: 'swap-horizontal' },
  topluluk: { label: 'Topluluk', icon: 'people-outline', iconActive: 'people' },
  daha: { label: 'Daha', icon: 'ellipsis-horizontal-circle-outline', iconActive: 'ellipsis-horizontal-circle' },
};

// Guard older native builds as well as unsupported platforms.
function supportsNativeGlass() {
  if (Platform.OS !== 'ios') return false;
  try { return isGlassEffectAPIAvailable() && isLiquidGlassAvailable(); }
  catch { return false; }
}

/** Floating glass dock; navigation events and safe-area spacing remain unchanged. */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const slide = useRef(new Animated.Value(0)).current;
  const itemWidth = Math.max(0, (barWidth - 12) / state.routes.length);
  const dragStart = useRef(0);
  const nativeGlass = supportsNativeGlass() && !reduceTransparency;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v => { if (mounted) setReduceMotion(v); }).catch(() => {});
    if (Platform.OS === 'ios') {
      void AccessibilityInfo.isReduceTransparencyEnabled().then(v => { if (mounted) setReduceTransparency(v); }).catch(() => {});
    }
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const transparency = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => { mounted = false; motion.remove(); transparency.remove(); };
  }, []);

  useEffect(() => {
    const target = state.index * itemWidth;
    if (reduceMotion) { slide.setValue(target); return; }
    const animation = Animated.spring(slide, { toValue: target, damping: 30, stiffness: 650, mass: 0.55, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [state.index, itemWidth, reduceMotion, slide]);

  const pan = useMemo(() => {
    const clamp = (x: number) => Math.max(0, Math.min((state.routes.length - 1) * itemWidth, x));
    const snap = (index: number) => {
      const target = index * itemWidth;
      if (reduceMotion) slide.setValue(target);
      else Animated.spring(slide, { toValue: target, damping: 30, stiffness: 650, mass: 0.55, useNativeDriver: false }).start();
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => itemWidth > 0 && Math.abs(gesture.dx) > 5 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
      onPanResponderGrant: () => {
        slide.stopAnimation(value => { dragStart.current = value; });
      },
      onPanResponderMove: (_, gesture) => slide.setValue(clamp(dragStart.current + gesture.dx)),
      onPanResponderRelease: (_, gesture) => {
        const next = Math.round(clamp(dragStart.current + gesture.dx) / itemWidth);
        const route = state.routes[next];
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (event.defaultPrevented) { snap(state.index); return; }
        snap(next);
        if (next !== state.index) navigation.navigate(route.name, route.params);
      },
      onPanResponderTerminate: () => snap(state.index),
      onPanResponderTerminationRequest: () => true,
    });
  }, [itemWidth, navigation, reduceMotion, slide, state.index, state.routes]);

  return (
    <View pointerEvents="box-none" style={[styles.outer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View
        {...pan.panHandlers}
        onLayout={event => setBarWidth(event.nativeEvent.layout.width)}
        style={[styles.bar, !nativeGlass && styles.fallback, reduceTransparency && styles.opaque]}
        accessibilityRole="tablist"
      >
        {nativeGlass && <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme="dark" style={styles.glass} />}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.025)', 'rgba(255,255,255,0.07)']}
          locations={[0, 0.48, 1]}
          start={{ x: 0.1, y: 0 }} end={{ x: 0.85, y: 1 }}
          style={styles.glass}
        />
        <View pointerEvents="none" style={styles.edgeShine} />
        {itemWidth > 0 && <Animated.View pointerEvents="none" style={[styles.selection, { width: itemWidth, transform: [{ translateX: slide }] }]}>
          <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.065)']} style={styles.glass} />
        </Animated.View>}
        {state.routes.map((route, index) => {
          const item = TAB_ITEMS[route.name];
          if (!item) return null;
          const focused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={item.label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ hovered }) => [styles.item, hovered && !focused && styles.hovered]}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={focused ? item.iconActive : item.icon} size={22} color={focused ? colors.goldSoft : 'rgba(245,239,230,0.85)'} />
              </View>
              <AppText
                variant="caption"
                style={[styles.label, { color: focused ? colors.goldSoft : 'rgba(245,239,230,0.85)' }]}
                numberOfLines={1}
              >
                {item.label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: spacing.md },
  bar: {
    flexDirection: 'row', width: '100%', maxWidth: 560, borderRadius: radius.pill,
    padding: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 12px 36px rgba(0,0,0,0.38), inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -1px 1px rgba(255,255,255,0.08)' } as object) : null),
  },
  fallback: {
    backgroundColor: Platform.OS === 'web' ? 'rgba(30,20,24,0.48)' : 'rgba(35,24,29,0.9)',
    ...(Platform.OS === 'web' ? ({ touchAction: 'pan-y', backdropFilter: 'blur(26px) saturate(180%)', WebkitBackdropFilter: 'blur(26px) saturate(180%)' } as object) : null),
  },
  opaque: { backgroundColor: '#21161B' },
  glass: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.pill, overflow: 'hidden' },
  edgeShine: { position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  selection: {
    position: 'absolute', left: 5, top: 5, bottom: 5, borderRadius: radius.pill,
    backgroundColor: 'rgba(217,164,65,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', overflow: 'hidden',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 2, borderRadius: radius.pill },
  hovered: { backgroundColor: 'rgba(255,255,255,0.07)' },
  iconWrap: { width: 44, height: 28, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '600' },
});
