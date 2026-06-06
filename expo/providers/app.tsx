import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useState } from "react";

import { SERVER_URL } from "@/constants/colors";

const USER_ID_KEY = "user_id";

export type AppStatus = "unknown" | "pending" | "active";

export type RegisterResult = {
  success: boolean;
  /** true when server returns 503 — no free GREEN-API slots. */
  noSlots?: boolean;
};

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 12000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const [AppProvider, useApp] = createContextHook(() => {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus>("unknown");
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load persisted user_id on mount.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(USER_ID_KEY)
      .then((id) => {
        if (active) {
          setUserId(id);
        }
      })
      .catch((err) => {
        console.log("[app] failed to load user_id", err);
      })
      .finally(() => {
        if (active) {
          setIsLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  /** Register with the server and get assigned a GREEN-API instance.
   *  Returns `{ success: false, noSlots: true }` when all slots are taken. */
  const register = useCallback(async (token: string): Promise<RegisterResult> => {
    try {
      const res = await fetchWithTimeout(
        `${SERVER_URL}/api/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );

      if (res.status === 503) {
        return { success: false, noSlots: true };
      }

      if (!res.ok) {
        return { success: false };
      }

      const data: { user_id: string } = (await res.json()) as { user_id: string };
      setUserId(data.user_id);
      setStatus("pending");
      await AsyncStorage.setItem(USER_ID_KEY, data.user_id);
      return { success: true };
    } catch (err) {
      console.log("[app] register failed", err);
      return { success: false };
    }
  }, []);

  /** Check pairing status from the server. */
  const checkStatus = useCallback(async (): Promise<AppStatus> => {
    if (!userId) {
      return "unknown";
    }
    try {
      const res = await fetchWithTimeout(
        `${SERVER_URL}/api/status/${userId}`,
        { method: "GET" }
      );
      if (!res.ok) {
        return "pending";
      }
      const data: { status: string } = (await res.json()) as { status: string };
      const newStatus: AppStatus =
        data.status === "active" ? "active" : "pending";
      setStatus(newStatus);
      return newStatus;
    } catch (err) {
      console.log("[app] status check failed", err);
      return "pending";
    }
  }, [userId]);

  /** Disconnect: logout GREEN-API instance, clear storage, reset state. */
  const disconnect = useCallback(async (): Promise<void> => {
    if (!userId) {
      return;
    }
    try {
      await fetchWithTimeout(
        `${SERVER_URL}/api/disconnect/${userId}`,
        { method: "POST" }
      );
    } catch (err) {
      console.log("[app] disconnect API failed", err);
    }
    try {
      await AsyncStorage.removeItem(USER_ID_KEY);
    } catch (err) {
      console.log("[app] clear storage failed", err);
    }
    setUserId(null);
    setStatus("unknown");
  }, [userId]);

  return {
    userId,
    status,
    isLoaded,
    register,
    checkStatus,
    disconnect,
  };
});
