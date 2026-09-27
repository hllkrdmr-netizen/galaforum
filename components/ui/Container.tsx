import { View } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

import { layout } from '../../constants/theme';
import { useResponsive } from '../../hooks/useResponsive';

/** Centers content with a sensible max width and responsive side gutters. */
export function Container({ style, children, ...rest }: ViewProps & { style?: StyleProp<ViewStyle> }) {
  const { gutter } = useResponsive();
  return (
    <View
      {...rest}
      style={[{ width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: gutter }, style]}
    >
      {children}
    </View>
  );
}
