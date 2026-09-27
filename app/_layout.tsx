import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '../constants/theme';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = 'tr';
  }, []);
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="kategori/[slug]" />
        <Stack.Screen name="konu/[id]" />
        <Stack.Screen name="ara" />
        <Stack.Screen name="konu-ac" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
