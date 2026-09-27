import { router } from 'expo-router';
import { View } from 'react-native';

import { EmptyState, ScreenHeader } from '../components/ui';
import { colors } from '../constants/theme';

export default function NotFound() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Sayfa bulunamadı" />
      <EmptyState
        icon="compass-outline"
        title="Aradığın sayfa burada değil."
        message="Bağlantı eski olabilir ya da konu kaldırılmış olabilir."
        actionLabel="Ana sayfaya dön"
        onAction={() => router.replace('/')}
      />
    </View>
  );
}
