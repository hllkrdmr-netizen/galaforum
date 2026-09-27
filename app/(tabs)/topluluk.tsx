import { SectionScreen } from '../../features/sections/SectionScreen';

export default function ToplulukTab() {
  return (
    <SectionScreen
      title="Topluluk"
      icon="people-outline"
      description="Maç öncesi buluşmalar, şehir grupları ve tribün kültürü."
      categorySlugs={['mac-oncesi-bulusmalar', 'taraftar-tribun']}
    />
  );
}
