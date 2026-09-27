import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '../../constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function isIconName(name: string): name is IconName {
  return Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, name);
}

export function CategoryIcon({ icon, size = 44 }: { icon: string; size?: number }) {
  const name: IconName = isIconName(icon) ? icon : 'chatbubbles-outline';
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: radius.md }]}>
      <Ionicons name={name} size={Math.round(size * 0.46)} color={colors.gold} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107,20,38,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(217,164,65,0.22)',
  },
});
