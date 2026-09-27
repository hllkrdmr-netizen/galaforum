import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Container, Pill, PressableScale, SectionHeader } from '../../components/ui';
import { DEFAULT_CATEGORIES } from '../../constants/categories';
import { colors, radius, spacing } from '../../constants/theme';
import { CategoryIcon } from '../../features/forum/CategoryIcon';
import { useAuth } from '../../lib/auth/AuthProvider';
import { forum } from '../../services/forum';

type IconName = keyof typeof Ionicons.glyphMap;

function MenuRow({ icon, label, hint, href, soon }: { icon: IconName; label: string; hint?: string; href?: Href; soon?: boolean }) {
  return (
    <PressableScale
      accessibilityRole={href ? 'link' : 'text'}
      accessibilityLabel={soon ? `${label}, yakında` : label}
      disabled={!href}
      onPress={href ? () => router.push(href) : undefined}
      style={({ hovered }) => [styles.row, hovered && href ? styles.hovered : null]}
    >
      <Ionicons name={icon} size={20} color={soon ? colors.textSubtle : colors.gold} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" tone={soon ? 'muted' : 'default'}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" tone="subtle">
            {hint}
          </AppText>
        ) : null}
      </View>
      {soon ? <Pill label="Yakında" /> : <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />}
    </PressableScale>
  );
}

export default function DahaTab() {
  const { status, profile } = useAuth();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + spacing.xxl, paddingBottom: 140 }}>
      <Container>
        <SectionHeader overline="Hesap" title="Daha" />
        <View style={styles.group}>
          {status === 'signedIn' && profile ? (
            <>
              <MenuRow icon="person-circle-outline" label="Profilim" hint={`@${profile.username} · konular, mesajlar ve beğeniler`} href={`/uye/${profile.username}`} />
              <MenuRow icon="settings-outline" label="Hesap ayarları" hint="Kullanıcı adı, şifre, çıkış ve hesap silme" href="/hesap" />
            </>
          ) : status === 'unavailable' ? (
            <MenuRow icon="log-in-outline" label="Giriş yap / Üye ol" hint="Demo modunda kapalı — Supabase bağlantısı gerekir" href="/hesap" />
          ) : (
            <MenuRow icon="log-in-outline" label="Giriş yap / Üye ol" hint="E-posta ile güvenli giriş" href="/giris" />
          )}
          <MenuRow icon="notifications-outline" label="Bildirimler" hint="Yanıtlar, bahsetmeler ve maç uyarıları" soon />
          <MenuRow icon="search-outline" label="Forumda ara" href="/ara" />
          <MenuRow icon="create-outline" label="Konu Aç" href="/konu-ac" />
        </View>

        <View style={{ marginTop: spacing.xxxl }}>
          <SectionHeader overline="Forum" title="Tüm kategoriler" />
        </View>
        <View style={styles.grid}>
          {DEFAULT_CATEGORIES.map((c) => (
            <PressableScale
              key={c.slug}
              accessibilityRole="link"
              accessibilityLabel={c.name}
              onPress={() => router.push(`/kategori/${c.slug}`)}
              style={({ hovered }) => [styles.chip, hovered && styles.hovered]}
            >
              <CategoryIcon icon={c.icon} size={32} />
              <AppText variant="small" style={{ fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                {c.name}
              </AppText>
            </PressableScale>
          ))}
        </View>

        <View style={styles.about}>
          <AppText variant="tagline" tone="gold">
            DAİMA GALATASARAY
          </AppText>
          <AppText variant="caption" tone="subtle" style={{ marginTop: spacing.sm }}>
            GalaForum v0.1 · {forum.mode === 'demo' ? 'Demo modu (örnek içerik)' : 'Canlı veri'}
          </AppText>
          <AppText variant="caption" tone="subtle">
            Bağımsız taraftar platformu; Galatasaray Spor Kulübü’nün resmi kanalı değildir.
          </AppText>
        </View>
      </Container>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  group: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  hovered: { backgroundColor: colors.surfaceHover },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 48,
    flexGrow: 1,
    flexBasis: 220,
  },
  about: { marginTop: spacing.huge, alignItems: 'center', gap: 2 },
});
