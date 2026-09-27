import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Linking, Platform, StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { mapAttribution, mapsLink, tilesFor } from '../../lib/maps';

const ZOOM = 15;

/**
 * Dependency-free map preview: a static tile mosaic centred on the meeting point, plus a
 * button that opens the device's map app for directions. Swap the tile source with
 * EXPO_PUBLIC_MAP_TILE_URL (Mapbox/MapTiler) for production traffic.
 */
export function MapPreview({ lat, lng, label, height = 180 }: { lat: number; lng: number; label: string; height?: number }) {
  const [width, setWidth] = useState(0);
  const tiles = width > 0 ? tilesFor(lat, lng, ZOOM, width, height) : [];
  const open = () => void Linking.openURL(mapsLink(lat, lng, label, Platform.OS));
  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={[styles.frame, { height }]}
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Harita: ${label}`}
      >
        {tiles.map((t) => (
          <Image key={t.url} source={{ uri: t.url }} style={[styles.tile, { left: t.left, top: t.top }]} accessibilityIgnoresInvertColors />
        ))}
        <View style={styles.veil} pointerEvents="none" />
        <View style={[styles.pin, { left: width / 2 - 14, top: height / 2 - 28 }]} pointerEvents="none">
          <Ionicons name="location" size={28} color={colors.wineBright} />
        </View>
        <AppText variant="caption" style={styles.attribution}>
          {mapAttribution()}
        </AppText>
      </View>
      <PressableScale accessibilityRole="link" onPress={open} style={styles.link}>
        <Ionicons name="navigate-outline" size={16} color={colors.gold} />
        <AppText variant="small" tone="gold" style={{ fontWeight: '700' }}>
          Haritada aç
        </AppText>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#1a1416' },
  tile: { position: 'absolute', width: 256, height: 256 },
  veil: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(11,5,7,0.18)' },
  pin: { position: 'absolute' },
  attribution: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    fontSize: 10,
    color: '#1a1a1a',
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, alignSelf: 'flex-start' },
});
