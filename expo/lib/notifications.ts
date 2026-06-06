import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { EXPO_PROJECT_ID } from "@/constants/colors";

export type PermissionResult = "granted" | "denied";

/** Resolve the EAS project ID from every available source, in priority order.
 *  Standalone (TestFlight) builds don't expose the dev env var, so we fall
 *  back to the embedded app config and finally the hardcoded constant. */
export function resolveExpoProjectId(): string {
  return (
    process.env.EXPO_PUBLIC_PROJECT_ID ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    // @ts-expect-error easConfig is loosely typed across SDK versions
    Constants.easConfig?.projectId ||
    EXPO_PROJECT_ID
  );
}

export async function requestNotificationPermission(): Promise<PermissionResult> {
  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== "granted") {
    const request = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    status = request.status;
  }
  return status === "granted" ? "granted" : "denied";
}

/** Returns true when the token is a pending placeholder (not yet ready). */
export function isPendingPushToken(token: string): boolean {
  return token.includes("[pending");
}

export async function getPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      return `ExponentPushToken[simulator-${Platform.OS}]`;
    }

    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      return null;
    }

    const projectId = resolveExpoProjectId();
    if (!projectId) {
      console.log("[notifications] projectId is empty");
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return tokenResponse.data;
  } catch (error) {
    console.log("[notifications] failed to get push token", error);
    return null;
  }
}

/** Clear the iOS app icon badge counter. */
export async function clearAppBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.log("[notifications] failed to clear badge", error);
  }
}

/** Apply a badge count from an incoming push notification payload. */
export async function applyNotificationBadge(
  notification: Notifications.Notification
): Promise<void> {
  try {
    const badge = notification.request.content.badge;
    if (typeof badge === "number" && badge >= 0) {
      await Notifications.setBadgeCountAsync(badge);
    }
  } catch (error) {
    console.log("[notifications] failed to apply badge", error);
  }
}

export async function configureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync("calls", {
    name: "Звонки",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 500, 200, 500],
  });
  await Notifications.setNotificationChannelAsync("messages", {
    name: "Сообщения",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  });
}
