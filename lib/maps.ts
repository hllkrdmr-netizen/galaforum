/**
 * Map helpers with no native dependency: a static tile mosaic for previews and deep links to the
 * device's map app for directions. The tile source is configurable, so a keyed provider
 * (Mapbox, MapTiler…) can replace the OpenStreetMap default in production via
 * EXPO_PUBLIC_MAP_TILE_URL, e.g. "https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=…".
 */
export const TILE_SIZE = 256;

export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function tileTemplate(): string {
  const custom = (process.env.EXPO_PUBLIC_MAP_TILE_URL ?? '').trim();
  return custom.startsWith('https://') ? custom : DEFAULT_TILE_URL;
}

export function mapAttribution(): string {
  return tileTemplate() === DEFAULT_TILE_URL ? '© OpenStreetMap katkıcıları' : '© Harita sağlayıcısı';
}

/** Web-Mercator position of a coordinate in world pixels at zoom z. */
export function worldPixel(lat: number, lng: number, z: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** z;
  const sin = Math.sin((Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

export interface PlacedTile {
  url: string;
  left: number;
  top: number;
}

/**
 * Tiles needed to fill a width×height viewport centred on (lat, lng), with their offsets.
 */
export function tilesFor(lat: number, lng: number, z: number, width: number, height: number, template = tileTemplate()): PlacedTile[] {
  const c = worldPixel(lat, lng, z);
  const originX = c.x - width / 2;
  const originY = c.y - height / 2;
  const max = 2 ** z;
  const tiles: PlacedTile[] = [];
  for (let tx = Math.floor(originX / TILE_SIZE); tx <= Math.floor((originX + width) / TILE_SIZE); tx++) {
    for (let ty = Math.floor(originY / TILE_SIZE); ty <= Math.floor((originY + height) / TILE_SIZE); ty++) {
      if (ty < 0 || ty >= max) continue;
      const wrappedX = ((tx % max) + max) % max;
      tiles.push({
        url: template.replace('{z}', String(z)).replace('{x}', String(wrappedX)).replace('{y}', String(ty)),
        left: tx * TILE_SIZE - originX,
        top: ty * TILE_SIZE - originY,
      });
    }
  }
  return tiles;
}

/** Directions link for the platform's map app (web falls back to OpenStreetMap). */
export function mapsLink(lat: number, lng: number, label: string, platform: 'ios' | 'android' | 'web' | string): string {
  const q = encodeURIComponent(label);
  if (platform === 'ios') return `https://maps.apple.com/?ll=${lat},${lng}&q=${q}`;
  if (platform === 'android') return `geo:${lat},${lng}?q=${lat},${lng}(${q})`;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
