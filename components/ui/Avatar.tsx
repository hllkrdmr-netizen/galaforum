import { Image, StyleSheet, View } from 'react-native';

import { colors } from '../../constants/theme';
import { initials } from '../../lib/format';
import { AppText } from './AppText';

const PALETTE = ['#6B1426', '#4A0C19', '#7A3A12', '#5A1A2C', '#3B2A10', '#6A2224'];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, uri, size = 36 }: { name: string; uri?: string | null; size?: number }) {
  const bg = PALETTE[hash(name) % PALETTE.length];
  return (
    <View
      accessible={false}
      style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <AppText variant="caption" style={{ color: colors.goldSoft, fontSize: Math.max(11, size * 0.36), fontWeight: '700' }}>
          {initials(name)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(217,164,65,0.25)' },
});
