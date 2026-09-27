import { Platform, Pressable } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean; hovered: boolean }) => StyleProp<ViewStyle>);
  pressedOpacity?: number;
}

/** Pressable with subtle press/hover feedback. Keeps a minimum hit area via hitSlop. */
export function PressableScale({ style, pressedOpacity = 0.85, hitSlop = 6, ...rest }: PressableScaleProps) {
  return (
    <Pressable
      hitSlop={hitSlop}
      {...rest}
      style={(state) => {
        const s = state as { pressed: boolean; hovered?: boolean };
        const hovered = Boolean(s.hovered);
        const resolved = typeof style === 'function' ? style({ pressed: s.pressed, hovered }) : style;
        return [
          resolved,
          s.pressed && { opacity: pressedOpacity, transform: [{ scale: 0.985 }] },
          Platform.OS === 'web' && ({ cursor: rest.disabled ? 'default' : 'pointer' } as object),
        ];
      }}
    />
  );
}
