import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';
import { AppText } from './AppText';

type Tone = 'gold' | 'wine' | 'neutral' | 'success';

const tones: Record<Tone, { bg: string; fg: string; border: string }> = {
  gold: { bg: 'rgba(217,164,65,0.12)', fg: colors.goldSoft, border: 'rgba(217,164,65,0.35)' },
  wine: { bg: 'rgba(140,29,51,0.28)', fg: '#F2B8C0', border: 'rgba(140,29,51,0.6)' },
  neutral: { bg: 'rgba(245,239,230,0.06)', fg: colors.textMuted, border: colors.border },
  success: { bg: 'rgba(98,185,140,0.12)', fg: colors.success, border: 'rgba(98,185,140,0.35)' },
};

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: keyof typeof Ionicons.glyphMap }) {
  const t = tones[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg, borderColor: t.border }]}>
      {icon ? <Ionicons name={icon} size={11} color={t.fg} /> : null}
      <AppText variant="caption" style={{ color: t.fg, fontSize: 11, fontWeight: '700' }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
