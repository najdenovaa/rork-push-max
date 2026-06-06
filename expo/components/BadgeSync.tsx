import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { SERVER_URL } from "@/constants/colors";
import { applyNotificationBadge, clearAppBadge } from "@/lib/notifications";
import { useApp } from "@/providers/app";

/** Keeps the iOS app icon badge in sync with the server.
 *  - On mount and whenever the app becomes active: clears the badge and tells
 *    the server to reset the user's unread counter.
 *  - While running: applies the badge from each incoming push payload. */
export default function BadgeSync() {
  const { userId } = useApp();

  useEffect(() => {
    const resetBadge = async (): Promise<void> => {
      await clearAppBadge();
      if (!userId) {
        return;
      }
      try {
        await fetch(`${SERVER_URL}/api/badge/${userId}/reset`, {
          method: "POST",
        });
      } catch (err) {
        console.log("[badge] reset failed", err);
      }
    };

    void resetBadge();

    const appStateSub = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          void resetBadge();
        }
      }
    );

    const notificationSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        void applyNotificationBadge(notification);
      }
    );

    return () => {
      appStateSub.remove();
      notificationSub.remove();
    };
  }, [userId]);

  return null;
}
