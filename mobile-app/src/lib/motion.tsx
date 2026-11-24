import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/**
 * Ilova bo'ylab silliq harakatlar (faqat RN o'zi: Animated + LayoutAnimation, eski arxitektura bilan ishlaydi).
 */

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Keyingi joylashuv o'zgarishini (panel chiqishi/yashirinishi) silliq qiladi. */
export function animateLayout(duration = 200) {
  LayoutAnimation.configureNext({
    duration,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}

/**
 * Klaviatura bilan bir xil egri chiziq: iOS da "keyboard" turi aynan tizim animatsiyasiga mos keladi,
 * shuning uchun yozish maydoni klaviaturadan oldinga sakramaydi.
 */
export function configureKeyboardAnimation(e?: KeyboardEvent | null) {
  const duration = e?.duration && e.duration > 10 ? e.duration : 250;
  LayoutAnimation.configureNext({
    duration,
    update: {
      duration,
      type: Platform.OS === "ios" ? LayoutAnimation.Types.keyboard : LayoutAnimation.Types.easeInEaseOut,
    },
  });
}

/** Tugma/xabar mayin paydo bo'lishi: kichik masshtab + shaffoflikdan. */
export function PopIn({
  children,
  style,
  from = 0.6,
  enabled = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  from?: number;
  enabled?: boolean;
}) {
  const v = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  useEffect(() => {
    if (!enabled) return;
    Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 7, tension: 140 }).start();
  }, [enabled, v]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Pastdan chiqadigan oyna uchun: ko'rinish holatiga qarab 0..1 animatsiya, yopilganda tugaguncha mount qolsin. */
export function useSheetAnimation(visible: boolean, duration = 240) {
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: Math.round(duration * 0.8),
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, duration, progress]);
  return { progress, mounted };
}
