import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

/**
 * GalaForum design tokens.
 * Night-stadium palette: near black, burgundy/wine/maroon, controlled gold, off-white text.
 * Gold is an accent — never the whole surface.
 */
export const colors = {
  bg: '#0B0507',
  bgRaised: '#120709',
  bgSunken: '#080304',

  maroon: '#2A070E',
  burgundy: '#4A0C19',
  wine: '#6B1426',
  wineBright: '#8C1D33',

  gold: '#D9A441',
  goldSoft: '#E8C26A',
  warmYellow: '#F2C94C',
  goldDim: 'rgba(217,164,65,0.14)',

  text: '#F5EFE6',
  textMuted: 'rgba(245,239,230,0.72)',
  textSubtle: 'rgba(245,239,230,0.52)',
  textOnGold: '#1A0A06',

  surface: 'rgba(255,244,230,0.035)',
  surfaceHover: 'rgba(255,244,230,0.06)',
  surfaceStrong: '#170A0D',

  border: 'rgba(245,239,230,0.08)',
  borderStrong: 'rgba(245,239,230,0.14)',
  borderGold: 'rgba(217,164,65,0.38)',

  danger: '#E46A5E',
  success: '#62B98C',
  info: '#8FB3D9',
} as const;

export const gradients = {
  hero: ['#0B0507', '#1E060D', '#3A0A17'] as const,
  heroGlow: ['rgba(140,29,51,0.55)', 'rgba(140,29,51,0)'] as const,
  fadeToBg: ['rgba(11,5,7,0)', 'rgba(11,5,7,0.85)', '#0B0507'] as const,
  readability: ['rgba(11,5,7,0.96)', 'rgba(11,5,7,0.78)', 'rgba(11,5,7,0.2)', 'rgba(11,5,7,0)'] as const,
  readabilitySoft: ['rgba(11,5,7,0.7)', 'rgba(11,5,7,0.4)', 'rgba(11,5,7,0.1)', 'rgba(11,5,7,0)'] as const,
  gold: ['#F2C94C', '#D9A441', '#B9832A'] as const,
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  giant: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const layout = {
  maxContentWidth: 1120,
  gutter: 16,
  gutterWide: 32,
  /** Width from which we treat the viewport as tablet/desktop. */
  wideBreakpoint: 768,
  desktopBreakpoint: 1024,
  minTouchTarget: 44,
} as const;

const displayFamily = Platform.select({
  web: "'Barlow Condensed', 'Oswald', 'Bebas Neue', 'Arial Narrow', 'Roboto Condensed', system-ui, sans-serif",
  android: 'sans-serif-condensed',
  default: undefined,
});

const bodyFamily = Platform.select({
  web: "Inter, 'SF Pro Text', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  default: undefined,
});

export const fonts = { display: displayFamily, body: bodyFamily };

type Variant =
  | 'display'
  | 'displaySm'
  | 'tagline'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'caption'
  | 'overline'
  | 'button';

export const typography: Record<Variant, TextStyle> = {
  display: { fontFamily: displayFamily, fontSize: 56, lineHeight: 58, fontWeight: '800', letterSpacing: -0.5 },
  displaySm: { fontFamily: displayFamily, fontSize: 44, lineHeight: 46, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontFamily: displayFamily, fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: 4.2 },
  h1: { fontFamily: displayFamily, fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: 0.2 },
  h2: { fontFamily: bodyFamily, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  h3: { fontFamily: bodyFamily, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  body: { fontFamily: bodyFamily, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontFamily: bodyFamily, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  small: { fontFamily: bodyFamily, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontFamily: bodyFamily, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  overline: { fontFamily: bodyFamily, fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.8 },
  button: { fontFamily: bodyFamily, fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: 0.2 },
};

export type TypographyVariant = Variant;

export const shadows = {
  soft: Platform.select({
    web: { boxShadow: '0 10px 30px rgba(0,0,0,0.35)' } as object,
    default: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
  }),
  gold: Platform.select({
    web: { boxShadow: '0 8px 24px rgba(217,164,65,0.22)' } as object,
    default: {
      shadowColor: '#D9A441',
      shadowOpacity: 0.28,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
  }),
};

export const theme = { colors, gradients, spacing, radius, layout, typography, shadows, fonts };
export default theme;
