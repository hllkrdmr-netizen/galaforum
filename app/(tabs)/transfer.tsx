import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Pill, PressableScale } from '../../components/ui';
import { colors, spacing } from '../../constants/theme';
import { SectionScreen } from '../../features/sections/SectionScreen';

const STATUSES = [
  { label: 'Söylenti', tone: 'neutral' as const, text: 'Tek kaynaklı, doğrulanmamış haber.' },
  { label: 'Görüşme', tone: 'wine' as const, text: 'Taraflar arasında temas birden çok kaynakta geçiyor.' },
  { label: 'Güçlü iddia', tone: 'gold' as const, text: 'Güvenilir kaynaklarca ileri aşamada olduğu bildiriliyor.' },
  { label: 'Resmi', tone: 'success' as const, text: 'Yalnızca kulübün doğrulanmış açıklamasından sonra.' },
];

/** Collapsed by default: the legend is reference information, not content. */
function StatusLegend() {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.toggle}
      >
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <AppText variant="small" tone="muted">
          Durum etiketleri ne anlama geliyor?
        </AppText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSubtle} />
      </PressableScale>
      {open ? (
        <View style={styles.legend}>
          {STATUSES.map((s) => (
            <View key={s.label} style={styles.row}>
              <View style={{ width: 96 }}>
                <Pill label={s.label} tone={s.tone} />
              </View>
              <AppText variant="small" tone="muted" style={{ flex: 1 }}>
                {s.text}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function TransferTab() {
  return (
    <SectionScreen
      title="Transfer"
      icon="swap-horizontal-outline"
      description="Her haber kaynağıyla tartışılır; doğrulanmayan hiçbir şey “resmi” sayılmaz."
      categorySlugs={['transfer']}
      extra={<StatusLegend />}
    />
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  legend: { gap: spacing.sm, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
