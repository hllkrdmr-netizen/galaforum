import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Container, Pill, PressableScale, SectionHeader } from '../../components/ui';
import { DEFAULT_CATEGORIES } from '../../constants/categories';
import { colors, radius, spacing } from '../../constants/theme';
import { CategoryIcon } from '../../features/forum/CategoryIcon';
import { useOpenReportCount, useStaff } from '../../hooks/useModeration';
import { useUnreadNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../lib/auth/AuthProvider';
import { LEGAL_PAGES } from '../../lib/legal';
import { unreadLabel } from '../../lib/notifications';
import { forum } from '../../services/forum';

type IconName = keyof typeof Ionicons.glyphMap;

function MenuRow({ icon, label, hint, href, soon, count }: { icon: IconName; label: string; hint?: string; href?: Href; soon?: boolean; count?: string }) {
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
      {count ? <Pill label={count} tone="gold" /> : null}
      {soon ? <Pill label="Yakında" /> : <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />}
    </PressableScale>
  );
}

export default function DahaTab() {
  const { status, profile } = useAuth();
  const unread = useUnreadNotifications();
  const { isStaff, demo } = useStaff();
  const openReports = useOpenReportCount();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + spacing.xxl, paddingBottom: 140 }}>
      <Container>
        <AppText variant="displaySm" accessibilityRole="header" style={{ marginBottom: spacing.lg }}>
          Daha
        </AppText>
        <View style={styles.group}>
          {status === 'signedIn' && profile ? (
            <>
              <MenuRow icon="person-circle-outline" label="Profilim" hint={`@${profile.username} · konular, mesajlar ve beğeniler`} href={`/uye/${profile.username}`} />
              <MenuRow icon="settings-outline" label="Hesap ayarları" hint="Kullanıcı adı, şifre, çıkış ve hesap silme" href="/hesap" />
              <MenuRow icon="options-outline" label="Bildirim ayarları" hint="Hangi durumlarda haber verelim?" href="/bildirim-ayarlari" />
            </>
          ) : status === 'unavailable' ? (
            <MenuRow icon="log-in-outline" label="Giriş yap / Üye ol" hint="Demo modunda kapalı — Supabase bağlantısı gerekir" href="/hesap" />
          ) : (
            <MenuRow icon="log-in-outline" label="Giriş yap / Üye ol" hint="E-posta ile güvenli giriş" href="/giris" />
          )}
          {isStaff ? (
            <MenuRow
              icon="shield-half-outline"
              label="Moderasyon paneli"
              hint={demo ? 'Demo: şikâyetler, yaptırımlar ve kayıtlar' : 'Şikâyetler, üyeler, gizlenen konular ve kayıtlar'}
              href="/moderasyon"
              count={openReports > 0 ? String(openReports) : undefined}
            />
          ) : null}
          {isStaff ? (
            <MenuRow icon="football-outline" label="Maç yönetimi" hint="Maç ekle, canlı skor ve olayları gir" href="/mac-yonetimi" />
          ) : null}
          <MenuRow icon="bookmark-outline" label="Takip ettiklerin" hint="Üyeler, konular, kategoriler ve engellediklerin" href="/takip" />
          <MenuRow icon="location-outline" label="Buluşmalar" hint="Maç günü buluşmaları ve ortak yolculuklar" href="/bulusmalar" />
          {status !== 'signedOut' ? (
            <MenuRow
              icon="notifications-outline"
              label="Bildirimler"
              hint="Yanıtlar, bahsetmeler ve maç uyarıları"
              href="/bildirimler"
              count={unreadLabel(unread)}
            />
          ) : null}
          <MenuRow icon="search-outline" label="Forumda ara" href="/ara" />
          <MenuRow icon="create-outline" label="Konu Aç" href="/konu-ac" />
        </View>

        <View style={{ marginTop: spacing.xxxl }}>
          <SectionHeader title="Kategoriler" />
        </View>
        <View style={styles.list}>
          {DEFAULT_CATEGORIES.map((c) => (
            <PressableScale
              key={c.slug}
              accessibilityRole="link"
              accessibilityLabel={c.name}
              onPress={() => router.push(`/kategori/${c.slug}`)}
              style={({ hovered }) => [styles.catRow, hovered && styles.hovered]}
            >
              <CategoryIcon icon={c.icon} size={32} />
              <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {c.name}
              </AppText>
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </PressableScale>
          ))}
        </View>

        <View style={{ marginTop: spacing.xxxl }}>
          <SectionHeader title="Bilgi" />
        </View>
        <View style={styles.group}>
          {LEGAL_PAGES.map((p) => (
            <MenuRow key={p.slug} icon={p.icon} label={p.title} href={`/bilgi/${p.slug}`} />
          ))}
        </View>

        <View style={styles.about}>
          <AppText variant="tagline" tone="gold">
            DAİMA GALATASARAY
          </AppText>
          <AppText variant="caption" tone="subtle" style={{ marginTop: spacing.sm }}>
            GalaForum v{Constants.expoConfig?.version ?? ''} · {forum.mode === 'demo' ? 'Demo modu (örnek içerik)' : 'Canlı veri'}
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
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
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
