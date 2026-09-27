import { SectionScreen } from '../../features/sections/SectionScreen';

export default function MacTab() {
  return (
    <SectionScreen
      overline="Maç merkezi"
      title="Maç"
      icon="football-outline"
      description="Maç günü tartışmaları, taktik analizler ve maç sonrası değerlendirmeler burada buluşur."
      categorySlugs={['mac-taktik', 'avrupa']}
      upcoming={[
        { icon: 'time-outline', label: 'Sıradaki maç, başlama saati, stat bilgisi ve geri sayım' },
        { icon: 'pulse-outline', label: 'Canlı maç odası: skor, dakika ve önemli olaylarla birlikte kontrollü tartışma' },
        { icon: 'grid-outline', label: 'İlk 11 kurucu: diziliş seç (4-2-3-1, 4-3-3, 3-4-3, 4-4-2) ve konuya paylaş' },
        { icon: 'bar-chart-outline', label: 'Canlı anketler ve maçın oyuncusu oylaması' },
      ]}
    />
  );
}
