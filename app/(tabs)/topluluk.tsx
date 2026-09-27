import { SectionScreen } from '../../features/sections/SectionScreen';

export default function ToplulukTab() {
  return (
    <SectionScreen
      overline="Taraftar topluluğu"
      title="Topluluk"
      icon="people-outline"
      description="Şehir grupları, maç öncesi buluşmalar ve tribün kültürü. Aynı renkleri paylaşan taraftarlarla tanış."
      categorySlugs={['mac-oncesi-bulusmalar', 'taraftar-tribun']}
      upcoming={[
        { icon: 'location-outline', label: 'Maç günü buluşmaları: tarih, saat, konum ve harita' },
        { icon: 'business-outline', label: 'Şehir bazlı taraftar grupları' },
        { icon: 'ribbon-outline', label: 'Aktif, popüler ve yeni üyeler' },
        { icon: 'person-add-outline', label: 'Üye, konu ve kategori takibi' },
      ]}
    />
  );
}
