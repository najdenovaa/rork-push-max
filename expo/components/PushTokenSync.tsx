import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getPushToken, isPendingPushToken, requestNotificationPermission } from "@/lib/notifications";
import { useApp } from "@/providers/app";

const RETRY_MS = 15000;

export default function PushTokenSync() {
  const { userId, updatePushToken } = useApp();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      syncedRef.current = false;
      return;
    }
    let active = true;

    const sync = async () => {
      if ((await requestNotificationPermission()) !== "granted") return;
      const token = await getPushToken();
      if (!active || !token || isPendingPushToken(token)) return;
      if (await updatePushToken(userId, token)) syncedRef.current = true;
    };

    void sync();

    const interval = setInterval(() => {
      if (!syncedRef.current) void sync();
    }, RETRY_MS);

    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") {
        syncedRef.current = false;
        void sync();
      }
    });

    return () => {
      active = false;
      clearInterval(interval);
      sub.remove();
    };
  }, [userId, updatePushToken]);

  return null;
}
