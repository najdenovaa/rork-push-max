import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

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

/** Obtain the native APNs (iOS) or FCM (Android) device push token.
 *  Does NOT use Expo Push — the server sends directly through APNs. */
export async function getPushToken(): Promise<string | null> {
  try {
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      return null;
    }

    // iOS requires explicit registration before requesting the device token.
    if (Platform.OS === "ios") {
      await Notifications.registerDeviceForRemoteMessagesAsync();
    }

    const { data } = await Notifications.getDevicePushTokenAsync();
    return data ?? null;
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
