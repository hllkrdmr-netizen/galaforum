import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { colors, fonts, layout, radius, spacing } from '../../constants/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  hint?: string;
  /** Shows a show/hide toggle for password fields. */
  secureToggle?: boolean;
}

/** Labelled input with error/hint text; the label doubles as the accessibility label. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, secureToggle, secureTextEntry, ...rest },
  ref,
) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry || secureToggle));
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <AppText variant="small" style={styles.label}>
        {label}
      </AppText>
      <View style={[styles.field, focused && styles.focused, error ? styles.invalid : null]}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
          style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
        />
        {secureToggle ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Şifreyi göster' : 'Şifreyi gizle'}
            onPress={() => setHidden((h) => !h)}
            style={styles.toggle}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSubtle} />
          </PressableScale>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="subtle">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontWeight: '600', color: colors.textMuted },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgRaised,
    minHeight: layout.minTouchTarget + 4,
  },
  focused: { borderColor: colors.borderGold },
  invalid: { borderColor: colors.danger },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: layout.minTouchTarget,
  },
  toggle: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
