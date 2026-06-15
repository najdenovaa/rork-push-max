import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { EXPO_PROJECT_ID, LINKED_APP_SCHEME, LINKED_APP_URL, SERVER_URL } from "@/constants/colors";

/** Only allow hostname max.ru and *.max.ru for native max:// scheme. */
function isAllowedMaxUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    return hostname === "max.ru" || hostname.endsWith(".max.ru");
  } catch {
    return false;
  }
}

/** Allow max.ru / *.max.ru AND mkspush.ru with /go/* or /pair/* paths for push-tap URLs. */
function isAllowedOpenUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host === "max.ru" || host.endsWith(".max.ru")) return true;
    if (host === "mkspush.ru" && (parsed.pathname.startsWith("/go/") || parsed.pathname.startsWith("/pair/"))) return true;
    return false;
  } catch {
    return false;
  }
}

/** Extract a userId from mkspush.ru URLs like /go/{userId} or /pair/{userId}. */
function extractUserIdFromMkspushUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "mkspush.ru") return null;
    const match = parsed.pathname.match(/^\/(?:go|pair)\/([a-f0-9]+)$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Fetch the target URL from the server: review returns /pair/{userId}, prod returns max://max.ru/. */
async function fetchOpenTarget(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${SERVER_URL}/api/open-target/${userId}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return typeof data.url === "string" && data.url.length > 0 ? data.url : null;
  } catch (error) {
    console.log("[notifications] failed to fetch open-target", error);
    return null;
  }
}

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
 *  Uses `data.url` only when it matches max.ru / *.max.ru; falls back to the linked web app. */
export function resolvePushOpenUrl(data: Record<string, unknown> | undefined): string {
  if (data?.url != null && typeof data.url === "string" && data.url.length > 0) {
    if (isAllowedOpenUrl(data.url)) {
      return data.url;
    }
  }
  return LINKED_APP_URL;
}

/** Convert an https://max.ru URL to the native max:// scheme. */
function toNativeMaxUrl(httpsUrl: string): string {
  try {
    const parsed = new URL(httpsUrl);
    return `${LINKED_APP_SCHEME}://${parsed.hostname}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return `${LINKED_APP_SCHEME}://`;
  }
}

/** Open the linked app. For mkspush.ru URLs with a userId, fetches the target from the server
 *  (review → /pair/{userId}, prod → max://max.ru/). Falls back to max:// for max.ru URLs,
 *  otherwise opens https directly. */
export async function openLinkedApp(
  httpsUrl?: string,
  userId?: string | null,
): Promise<void> {
  const url = httpsUrl ?? LINKED_APP_URL;
  const resolvedUserId = userId ?? extractUserIdFromMkspushUrl(url);

  if (resolvedUserId) {
    const target = await fetchOpenTarget(resolvedUserId);
    if (target) {
      try {
        await Linking.openURL(target);
        return;
      } catch (error) {
        console.log("[notifications] failed to open server target", error);
      }
    }
  }

  if (isAllowedMaxUrl(url)) {
    try {
      await Linking.openURL(toNativeMaxUrl(url));
      return;
    } catch {
      // fall through to https
    }
  }

  try {
    await Linking.openURL(url);
  } catch (error) {
    console.log("[notifications] failed to open url", error);
  }
}

/** Open the app/URL configured for this push notification. */
export async function openAppFromPushNotification(
  data: Record<string, unknown> | undefined
): Promise<void> {
  const url = resolvePushOpenUrl(data);
  const userId = extractUserIdFromMkspushUrl(url);
  await openLinkedApp(url, userId);
}

/** Clear the last notification response so the same tap is not replayed. */
export async function clearLastNotificationResponse(): Promise<void> {
  try {
    await Notifications.clearLastNotificationResponseAsync();
  } catch (error) {
    console.log("[notifications] failed to clear last notification response", error);
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
