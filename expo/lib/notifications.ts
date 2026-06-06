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

export async function getPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      return `ExponentPushToken[simulator-${Platform.OS}]`;
    }
    const projectId = resolveExpoProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return tokenResponse.data;
  } catch (error) {
    console.log("[notifications] failed to get push token", error);
    return null;
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
