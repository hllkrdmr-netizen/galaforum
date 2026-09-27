import { Text } from 'react-native';
import type { TextProps } from 'react-native';

import { colors, typography } from '../../constants/theme';
import type { TypographyVariant } from '../../constants/theme';

type Tone = 'default' | 'muted' | 'subtle' | 'gold' | 'onGold' | 'danger';

const toneColor: Record<Tone, string> = {
  default: colors.text,
  muted: colors.textMuted,
  subtle: colors.textSubtle,
  gold: colors.gold,
  onGold: colors.textOnGold,
  danger: colors.danger,
};

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  uppercase?: boolean;
}

export function AppText({ variant = 'body', tone = 'default', uppercase, style, ...rest }: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[typography[variant], { color: toneColor[tone] }, uppercase && { textTransform: 'uppercase' }, style]}
    />
  );
}
