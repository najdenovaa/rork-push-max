import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  clearLastNotificationResponse,
  configureAndroidChannels,
  openAppFromPushNotification,
} from "@/lib/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppProvider } from "@/providers/app";
import BadgeSync from "@/components/BadgeSync";
import PushTokenSync from "@/components/PushTokenSync";

void SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const queryClient = new QueryClient();

export default function RootLayout() {
  // Debounce duplicate notification taps (getLastNotificationResponseAsync
  // + addNotificationResponseReceivedListener both fire on cold start).
  const lastTapRef = useRef<{ id: string; ts: number } | null>(null);

  useEffect(() => {
    void configureAndroidChannels();

    // Handle deep link on cold start (mkspush://pair?user_id=XXX)
    void Linking.getInitialURL().then((url) => {
      if (!url) return;
      try {
        const queryIndex = url.indexOf("?");
        if (queryIndex !== -1 && url.includes("pair")) {
          const params = new URLSearchParams(url.slice(queryIndex + 1));
          const userId = params.get("user_id");
          if (userId) {
            void AsyncStorage.setItem("user_id", userId);
          }
        }
      } catch {
        // Ignore malformed URLs
      }
    });

    if (Platform.OS === "web") {
      void SplashScreen.hideAsync();
      return;
    }

    const handleNotificationTap = (
      response: Notifications.NotificationResponse
    ): void => {
      const identifier =
        response.notification.request.identifier ??
        response.actionIdentifier;
      const now = Date.now();
      const prev = lastTapRef.current;
      // Skip duplicate firings within 4000ms for the same notification.
      if (prev && prev.id === identifier && now - prev.ts < 4000) {
        return;
      }
      lastTapRef.current = { id: identifier, ts: now };

      const data =
        response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
      void openAppFromPushNotification(data);
      void clearLastNotificationResponse();
    };

    // Cold start — notification tap launched the app
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleNotificationTap(response);
        }
      })
      .catch((error) => {
        console.log("[layout] failed to get last notification response", error);
      })
      .finally(() => {
        void SplashScreen.hideAsync();
      });

    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationTap
      );
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppProvider>
          <BadgeSync />
          <PushTokenSync />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
          </Stack>
        </AppProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
