import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { PressableScale } from '../../components/ui';
import { colors, fonts, layout, radius, spacing } from '../../constants/theme';
import { MIN_QUERY_LENGTH } from '../../lib/search';

export function SearchBar({
  initialValue = '',
  onSubmit,
  autoFocus,
  placeholder = 'Konu, mesaj, üye veya kategori ara',
}: {
  initialValue?: string;
  onSubmit?: (q: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const submit = () => {
    const q = value.trim();
    if (q.length < MIN_QUERY_LENGTH) return;
    if (onSubmit) onSubmit(q);
    else router.push({ pathname: '/ara', params: { q } });
  };
  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={18} color={colors.textSubtle} />
      <TextInput
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        returnKeyType="search"
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Forumda ara"
        style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
      />
      {value.length > 0 ? (
        <PressableScale accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={() => setValue('')} style={styles.clear}>
          <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
        </PressableScale>
      ) : null}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Ara"
        onPress={submit}
        style={({ hovered }) => [styles.go, hovered && { backgroundColor: 'rgba(217,164,65,0.22)' }]}
      >
        <Ionicons name="arrow-forward" size={18} color={colors.gold} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingLeft: spacing.lg,
    paddingRight: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(18,7,9,0.72)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.body,
    paddingVertical: spacing.md,
    minHeight: layout.minTouchTarget,
  },
  clear: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  go: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldDim,
  },
});
