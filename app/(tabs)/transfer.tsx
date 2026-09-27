import { StyleSheet, View } from 'react-native';

import { AppText, Pill } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { SectionScreen } from '../../features/sections/SectionScreen';

const STATUSES = [
  { label: 'Söylenti', tone: 'neutral' as const, text: 'Tek kaynaklı, doğrulanmamış haber.' },
  { label: 'Görüşme', tone: 'wine' as const, text: 'Taraflar arasında temas olduğu birden çok kaynakta geçiyor.' },
  { label: 'Güçlü iddia', tone: 'gold' as const, text: 'Güvenilir kaynaklarca ileri aşamada olduğu bildiriliyor.' },
  { label: 'Resmi', tone: 'success' as const, text: 'Yalnızca kulübün doğrulanmış açıklamasından sonra kullanılır.' },
];

export default function TransferTab() {
  return (
    <SectionScreen
      overline="Transfer gündemi"
      title="Transfer"
      icon="swap-horizontal-outline"
      description="Her haber kaynağıyla birlikte tartışılır. Doğrulanmamış hiçbir gelişme “resmi” olarak etiketlenmez."
      categorySlugs={['transfer']}
      extra={
        <View style={styles.legend} accessibilityLabel="Transfer durum etiketleri">
          <AppText variant="overline" tone="gold" uppercase style={{ marginBottom: spacing.sm }}>
            Durum etiketleri
          </AppText>
          {STATUSES.map((s) => (
            <View key={s.label} style={styles.row}>
              <View style={{ width: 104 }}>
                <Pill label={s.label} tone={s.tone} />
              </View>
              <AppText variant="small" tone="muted" style={{ flex: 1 }}>
                {s.text}
              </AppText>
            </View>
          ))}
        </View>
      }
      upcoming={[
        { icon: 'person-outline', label: 'Oyuncu kartları: pozisyon, mevcut kulüp, kaynak ve tarih' },
        { icon: 'shield-checkmark-outline', label: 'Kaynak doğrulamalı durum güncellemeleri' },
        { icon: 'notifications-outline', label: 'Takip ettiğin transfer konusunda gelişme bildirimi' },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  legend: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
