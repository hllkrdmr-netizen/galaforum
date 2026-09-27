import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, PressableScale, SectionHeader, TextField } from '../../components/ui';
import { DEFAULT_CATEGORIES } from '../../constants/categories';
import { colors, radius, spacing } from '../../constants/theme';
import { invalidateQueries, useForumQuery } from '../../hooks/useForumQuery';
import { community } from '../../services/community';
import { Notice } from '../auth/AuthLayout';

/** Account section: bio, city and favourite category (shown on the public profile). */
export function ProfileDetails({ username }: { username: string }) {
  const extras = useForumQuery(`community:profile:${username}`, () => community.getProfileExtras(username));
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [fav, setFav] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (loaded || !extras.data) return;
    setBio(extras.data.bio ?? '');
    setCity(extras.data.city ?? '');
    setFav(extras.data.favoriteCategory?.slug ?? null);
    setLoaded(true);
  }, [extras.data, loaded]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await community.updateMyProfile({ bio, city, favoriteCategorySlug: fav });
      invalidateQueries('community:profile:');
      setMsg({ tone: 'success', text: 'Profilin güncellendi.' });
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : 'Kaydedilemedi.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader title="Profil" />
      <TextField label="Hakkında" value={bio} onChangeText={setBio} multiline maxLength={280} hint={`${bio.length}/280`} />
      <TextField label="Şehir" value={city} onChangeText={setCity} maxLength={60} />
      <AppText variant="small" style={styles.label}>
        En sevdiğin kategori
      </AppText>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {DEFAULT_CATEGORIES.map((c) => {
          const on = fav === c.slug;
          return (
            <PressableScale
              key={c.slug}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setFav(on ? null : c.slug)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <AppText variant="caption" style={{ fontWeight: '700', color: on ? colors.goldSoft : colors.textMuted }}>
                {c.name}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Button label="Profili kaydet" loading={busy} onPress={() => void save()} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xxxl, gap: spacing.md },
  label: { fontWeight: '600', color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(217,164,65,0.12)' },
});
