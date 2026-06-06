import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  getPushToken,
  isPendingPushToken,
  requestNotificationPermission,
} from "@/lib/notifications";
import { useApp } from "@/providers/app";
import { SERVER_URL } from "@/constants/colors";

const RETRY_MS = 15000;

export default function PushTokenSync() {
  const { userId } = useApp();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      syncedRef.current = false;
      return;
    }

    let active = true;

    const sync = async (): Promise<void> => {
      const permission = await requestNotificationPermission();
      console.log("[PushTokenSync] permission:", permission);
      if (!active || permission !== "granted") return;

      const token = await getPushToken();
      const tokenPreview =
        token === null
          ? "null"
          : token.length <= 20
            ? token
            : token.slice(0, 20) + "…";
      console.log("[PushTokenSync] token:", tokenPreview);
      if (!active || !token || isPendingPushToken(token)) return;

      try {
        const res = await fetch(`${SERVER_URL}/api/token/${userId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        console.log("[PushTokenSync] POST result:", res.status, res.ok);
        if (res.ok) {
          syncedRef.current = true;
        }
      } catch (err) {
        console.log("[PushTokenSync] POST failed", err);
      }
    };

    void sync();
    const interval = setInterval(() => {
      if (!syncedRef.current) void sync();
    }, RETRY_MS);

    const onAppState = (state: AppStateStatus): void => {
      if (state === "active") {
        syncedRef.current = false;
        void sync();
      }
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      active = false;
      clearInterval(interval);
      sub.remove();
    };
  }, [userId]);

  return null;
}
