import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { EXPO_PROJECT_ID, LINKED_APP_URL } from "@/constants/colors";

export type PermissionResult = "granted" | "denied";

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
  return token.startsWith("pending") || token.includes("[pending");
}

/** Obtain the Expo push token. */
export async function getPushToken(): Promise<string | null> {
  try {
    const permission = await requestNotificationPermission();
    if (permission !== "granted") return null;
    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });
    return data ?? null;
  } catch (error) {
    console.log("[notifications] failed to get push token", error);
    return null;
  }
}

/** Resolve which URL to open when a push notification is tapped.
 *  Prefers `data.url` from the payload, falls back to the linked web app. */
export function resolvePushOpenUrl(data: Record<string, unknown> | undefined): string {
  if (data?.url != null && typeof data.url === "string" && data.url.length > 0) {
    return data.url;
  }
  return LINKED_APP_URL;
}

/** Open the app/URL configured for this push notification.
 *  Checks `canOpenURL` first to avoid crashes on iOS. */
export async function openAppFromPushNotification(
  data: Record<string, unknown> | undefined
): Promise<void> {
  const url = resolvePushOpenUrl(data);
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      console.log("[notifications] cannot open url", url);
    }
  } catch (error) {
    console.log("[notifications] failed to open url", url, error);
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
