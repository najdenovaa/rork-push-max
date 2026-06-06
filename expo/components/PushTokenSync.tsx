import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  getPushToken,
  isPendingPushToken,
  requestNotificationPermission,
} from "@/lib/notifications";
import { useApp } from "@/providers/app";

const RETRY_MS = 15000;

/** Keep APNs device token on the server — works on any screen (QR + connected). */
export default function PushTokenSync() {
  const { userId, updatePushToken } = useApp();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      syncedRef.current = false;
      return;
    }

    let active = true;

    const sync = async (): Promise<void> => {
      const permission = await requestNotificationPermission();
      if (!active || permission !== "granted") {
        return;
      }

      const token = await getPushToken();
      if (!active || !token || isPendingPushToken(token)) {
        return;
      }

      const ok = await updatePushToken(userId, token);
      if (ok) {
        syncedRef.current = true;
      }
    };

    void sync();
    const interval = setInterval(() => {
      if (!syncedRef.current) {
        void sync();
      }
    }, RETRY_MS);

    const onAppState = (state: AppStateStatus): void => {
      if (state === "active") {
        syncedRef.current = false;
        void sync();
      }
    };
    const appStateSub = AppState.addEventListener("change", onAppState);

    return () => {
      active = false;
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [userId, updatePushToken]);

  return null;
}
