import { useWindowDimensions } from 'react-native';

import { layout } from '../constants/theme';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= layout.wideBreakpoint;
  const isDesktop = width >= layout.desktopBreakpoint;
  const gutter = isWide ? layout.gutterWide : layout.gutter;
  const contentWidth = Math.min(width, layout.maxContentWidth);
  return { width, height, isWide, isDesktop, gutter, contentWidth, isSmall: width < 360 };
}
