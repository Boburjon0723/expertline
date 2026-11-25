import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "./src/features/auth/store";

import { AuthLocaleProvider } from "./src/features/auth/locale";
import { LoginScreen } from "./src/features/auth/screens/LoginScreen";
import { RegisterScreen } from "./src/features/auth/screens/RegisterScreen";
import { PasscodeScreen } from "./src/features/auth/screens/PasscodeScreen";
import { ChatListScreen } from "./src/features/chat/screens/ChatListScreen";
import { ChatDetailScreen } from "./src/features/chat/screens/ChatDetailScreen";
import { ThemeDesignScreen } from "./src/features/dashboard/screens/ThemeDesignScreen";

import { ChatPeerInfoScreen } from "./src/features/chat/screens/ChatPeerInfoScreen";
import { ProfileScreen } from "./src/features/dashboard/screens/ProfileScreen";
import { ExpertProfileScreen } from "./src/features/dashboard/screens/ExpertProfileScreen";
import { ListingDetailScreen } from "./src/features/market/ListingDetailScreen";
import { ListingComposeScreen } from "./src/features/market/ListingComposeScreen";
import { LanguageSettingsScreen } from "./src/features/chat/screens/LanguageSettingsScreen";
import { DataStorageSettingsScreen } from "./src/features/chat/screens/DataStorageSettingsScreen";
import { PrivacySettingsScreen } from "./src/features/chat/screens/PrivacySettingsScreen";
import { NotificationSettingsScreen } from "./src/features/chat/screens/NotificationSettingsScreen";
import { AboutAppScreen } from "./src/features/chat/screens/AboutAppScreen";
import { SupportScreen } from "./src/features/chat/screens/SupportScreen";
import { JobListScreen } from "./src/features/jobs/screens/JobListScreen";
import { ExpertDetailScreen } from "./src/features/dashboard/screens/ExpertDetailScreen";
import { ExpenseTrackerScreen } from "./src/features/finance/ExpenseTrackerScreen";
import { setupNotifications } from "./src/lib/notifications";
import * as Notifications from 'expo-notifications';
import { navigationRef, navigateToChatFromNotification } from "./src/lib/navigationRef";
import { GlobalCallOverlay } from "./src/features/chat/components/GlobalCallOverlay";
import { GlobalSongDock } from "./src/features/chat/components/ChatSongMiniBar";
import { palette } from "./src/lib/theme";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Messages: undefined;
  ChatDetail: { chatId: string; name: string; avatarUrl?: string | null; startCall?: "audio" | "video"; focusMessageId?: string };
  ChatPeerInfo: { chatId: string; name: string; avatarUrl?: string | null };
  ThemeDesign: undefined;
  Profile: undefined;
  ExpertProfile: undefined;
  ListingDetail: { listing: unknown };
  ListingCompose: { type?: "employer" | "seeker" } | undefined;
  LanguageSettings: undefined;
  DataStorageSettings: undefined;
  PrivacySettings: undefined;
  NotificationSettings: undefined;
  AboutApp: undefined;
  Support: undefined;
  Jobs: undefined;
  JobDetail: { jobId: number };
  ExpertDetail: { expertId: string; fallbackData?: any };
  Passcode: { mode: 'set' | 'unlock'; onSuccess?: () => void };
  Finance: undefined;
};





const Stack = createNativeStackNavigator<RootStackParamList>();

import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

type BootRoute = "Login" | "Messages" | "Passcode";

/** Fonda shuncha vaqt turgandan keyin qaytilganda kod so'raladi (Telegram'dagi "1 daqiqadan keyin"). */
const LOCK_AFTER_MS = 60_000;
const NO_LOCK_ROUTES = new Set(["Passcode", "Login", "Register"]);

export default function App() {
  /** Ilova fonga o'tgan vaqt (ms); faol bo'lsa null. */
  const backgroundAt = React.useRef<number | null>(null);
  const [routeName, setRouteName] = React.useState("");
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const token = useAuthStore((s) => s.token);
  const [bootRoute, setBootRoute] = React.useState<BootRoute | null>(null);

  const syncRouteName = React.useCallback((s?: { routes?: { name: string }[]; index?: number } | undefined) => {
    if (!s?.routes || s.index == null) return;
    setRouteName(String(s.routes[s.index]?.name ?? ""));
  }, []);

  React.useEffect(() => {
    if (isBootstrapping) return;
    let cancelled = false;
    void (async () => {
      if (!token) {
        if (!cancelled) setBootRoute("Login");
        return;
      }
      const passcode = await SecureStore.getItemAsync("app_passcode_key");
      if (!cancelled) setBootRoute(passcode ? "Passcode" : "Messages");
    })();
    return () => {
      cancelled = true;
    };
  }, [isBootstrapping, token]);

  React.useEffect(() => {
    setupNotifications();
    // Chat foni oldindan diskka keshlanadi — birinchi chat ham darhol fon bilan ochiladi.
    void (async () => {
      try {
        const { useAppearanceStore } = await import("./src/lib/appearance-store");
        const { getCachedMediaUri } = await import("./src/lib/media-cache");
        const bg = useAppearanceStore.getState().backgroundUri;
        if (bg && /^https?:\/\//i.test(bg)) await getCachedMediaUri(bg, "image", { force: true });
      } catch {
        /* ignore */
      }
    })();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const chatId =
        (data?.chatId as string | undefined) ??
        (data?.chat_id as string | undefined) ??
        (typeof data?.data === 'object' && data?.data != null
          ? ((data.data as Record<string, unknown>).chatId as string | undefined)
          : undefined);
      if (chatId) {
        navigateToChatFromNotification(String(chatId));
      }
    });

    // Ekran qulfi faqat ilova haqiqatan fonga o'tib, u yerda LOCK_AFTER_MS dan ko'p turganda.
    // "inactive" hisobga olinmaydi: iOS da ruxsat oynalari, fayl/rasm tanlash, Control Center,
    // bildirishnoma pardasi va qo'ng'iroq ham ilovani vaqtincha "inactive" qiladi.
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background') {
        if (backgroundAt.current == null) backgroundAt.current = Date.now();
      } else if (nextAppState === 'active') {
        const since = backgroundAt.current;
        backgroundAt.current = null;
        if (since == null || Date.now() - since < LOCK_AFTER_MS) return;
        const passcode = await SecureStore.getItemAsync('app_passcode_key');
        const hasToken = !!useAuthStore.getState().token;
        if (!passcode || !hasToken || !navigationRef.isReady()) return;
        const current = navigationRef.getCurrentRoute()?.name;
        if (current && !NO_LOCK_ROUTES.has(current)) {
          (navigationRef as unknown as { navigate: (name: string, params?: object) => void }).navigate(
            "Passcode",
            { mode: "unlock" }
          );
        }
      }
    });

    return () => {
      sub.remove();
      subscription.remove();
    };
  }, []);

  if (isBootstrapping || !bootRoute) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={palette.accent} size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
    <AuthLocaleProvider>
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        try {
          if (navigationRef.isReady()) syncRouteName(navigationRef.getRootState());
        } catch {
          /* ignore */
        }
      }}
      onStateChange={(s) => syncRouteName(s)}
    >
      <Stack.Navigator
        initialRouteName={bootRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg }
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Messages" component={ChatListScreen} />
        <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
        <Stack.Screen
          name="ChatPeerInfo"
          component={ChatPeerInfoScreen}
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="ThemeDesign" component={ThemeDesignScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="ExpertProfile" component={ExpertProfileScreen} />
        <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
        <Stack.Screen
          name="ListingCompose"
          component={ListingComposeScreen}
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
        <Stack.Screen name="DataStorageSettings" component={DataStorageSettingsScreen} />
        <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        <Stack.Screen name="AboutApp" component={AboutAppScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="Jobs" component={JobListScreen} />
        <Stack.Screen name="Finance" component={ExpenseTrackerScreen} />
        <Stack.Screen name="ExpertDetail" component={ExpertDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Passcode"
          component={PasscodeScreen}
          initialParams={{ mode: "unlock" }}
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />




      </Stack.Navigator>
      <GlobalSongDock routeName={routeName} />
      <GlobalCallOverlay />
    </NavigationContainer>
    </AuthLocaleProvider>
    </SafeAreaProvider>
  );
}
