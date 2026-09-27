import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Platform, StyleSheet, View } from 'react-native';

import { colors, radius, shadows, spacing } from '../../constants/theme';
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

/** Floating, restrained bottom navigation. Max width keeps it elegant on tablets/desktop. */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  return (
    <View pointerEvents="box-none" style={[styles.outer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={[styles.bar, shadows.soft]} accessibilityRole="tablist">
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
              style={styles.item}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Ionicons name={focused ? item.iconActive : item.icon} size={20} color={focused ? colors.gold : colors.textSubtle} />
              </View>
              <AppText
                variant="caption"
                style={[styles.label, { color: focused ? colors.goldSoft : colors.textSubtle }]}
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
    flexDirection: 'row',
    width: '100%',
    maxWidth: 560,
    borderRadius: radius.xl,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    backgroundColor: 'rgba(20,8,11,0.94)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(14px)' } as object) : null),
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 54, gap: 2 },
  iconWrap: { width: 44, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: 'rgba(217,164,65,0.14)' },
  label: { fontSize: 11, fontWeight: '600' },
});
