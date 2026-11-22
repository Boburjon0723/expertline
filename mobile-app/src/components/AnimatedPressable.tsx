import React, { useRef } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

/** Layout o‘lchamini o‘zgartirmaydi — faqat native scale. */
export function AnimatedPressable({
  children,
  style,
  innerStyle,
  onPressIn,
  onPressOut,
  scaleTo = 0.92,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      {...rest}
      style={style}
      onPressIn={(e) => {
        Animated.spring(scale, {
          toValue: scaleTo,
          useNativeDriver: true,
          speed: 42,
          bounciness: 0,
        }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 30,
          bounciness: 5,
        }).start();
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[innerStyle, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
