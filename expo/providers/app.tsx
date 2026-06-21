import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useRef, useState } from "react";

import { SERVER_URL } from "@/constants/colors";

const USER_ID_KEY = "user_id";

export type AppStatus = "unknown" | "pending" | "active";

export type PairingPhase = "qr" | "needs_2fa" | "active" | "unknown";

export type ConnectResult = {
  success: boolean;
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
  const [pairing, setPairing] = useState<PairingPhase>("unknown");
  const [pairingHint, setPairingHint] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const initialCheckDone = useRef<boolean>(false);
  const reconnectingRef = useRef<boolean>(false);

  // Load persisted user_id on mount — don't mark loaded yet.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(USER_ID_KEY)
      .then((id) => {
        if (active) {
          setUserId(id);
          // If no stored id, app is ready immediately.
          if (!id) {
            setIsLoaded(true);
          }
        }
      })
      .catch((err) => {
        console.log("[app] failed to load user_id", err);
        if (active) setIsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  /** Connect to the server — get a user_id and start pairing. 30 s timeout. */
  const connect = useCallback(async (token: string): Promise<ConnectResult> => {
    try {
      const res = await fetchWithTimeout(
        `${SERVER_URL}/api/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ push_token: token }),
        },
        30000
      );

      if (res.status === 429) {
        console.log("[app] connect rate limited (429)");
        return { success: false };
      }

      if (!res.ok) {
        return { success: false };
      }

      const data = (await res.json()) as {
        user_id?: string;
        ok?: boolean;
      };
      if (!data.user_id) {
        console.log("[app] connect response missing user_id");
        return { success: false };
      }
      setUserId(data.user_id);
      setStatus("pending");
      setPairing("qr");
      setPairingHint(null);
      await AsyncStorage.setItem(USER_ID_KEY, data.user_id);
      return { success: true };
    } catch (err) {
      console.log("[app] connect failed", err);
      return { success: false };
    }
  }, []);

  /** Clear storage, reset state, and attempt a fresh connect.
   *  Guarded by reconnectingRef to prevent parallel calls. */
  const reconnect = useCallback(async (): Promise<boolean> => {
    if (reconnectingRef.current) return false;
    reconnectingRef.current = true;
    setIsReconnecting(true);
    try {
      await AsyncStorage.removeItem(USER_ID_KEY).catch((err) => {
        console.log("[app] reconnect: clear storage failed", err);
      });
      setUserId(null);
      setStatus("unknown");
      setPairing("unknown");
      setPairingHint(null);

      const result = await connect("pending-expo");
      return result.success;
    } finally {
      reconnectingRef.current = false;
      setIsReconnecting(false);
    }
  }, [connect]);

  /** Handle a session_expired response: reconnect and stay pending on success. */
  const handleSessionExpired = useCallback(async (): Promise<boolean> => {
    console.log("[app] session expired, auto-reconnecting...");
    return await reconnect();
  }, [reconnect]);

  /** Check pairing status from the server. 30 s timeout.
   *  On 404 with session_expired → auto-reconnect. */
  const checkStatus = useCallback(async (): Promise<AppStatus> => {
    if (!userId) {
      return "unknown";
    }
    try {
      const res = await fetchWithTimeout(
        `${SERVER_URL}/api/status/${userId}`,
        { method: "GET" },
        30000
      );
      if (!res.ok) {
        if (res.status === 404) {
          try {
            const body = (await res.json()) as {
              error?: string;
              reconnect?: boolean;
            };
            if (body.error === "session_expired" && body.reconnect) {
              const ok = await handleSessionExpired();
              return ok ? "pending" : "unknown";
            }
          } catch {
            // ignore parse error — treat as regular failure
          }
          return "unknown";
        }
        return "pending";
      }
      const data = (await res.json()) as {
        status: string;
        pairing?: string;
        hint?: string | null;
      };

      if (data.pairing === "needs_2fa") {
        setPairing("needs_2fa");
        setPairingHint(data.hint ?? null);
      } else if (data.pairing === "active" || data.status === "active") {
        setPairing("active");
        setPairingHint(null);
      } else {
        setPairing("qr");
        setPairingHint(null);
      }

      const newStatus: AppStatus =
        data.status === "active" ? "active" : "pending";
      setStatus(newStatus);
      return newStatus;
    } catch (err) {
      console.log("[app] status check failed", err);
      return "pending";
    }
  }, [userId, handleSessionExpired, reconnect]);

  // When a stored userId is loaded, check its real status before showing a screen.
  useEffect(() => {
    if (initialCheckDone.current) return;
    if (userId && !isLoaded) {
      initialCheckDone.current = true;
      checkStatus().finally(() => {
        setIsLoaded(true);
      });
    }
  }, [userId, isLoaded, checkStatus]);

  /** Expo push token; синхронизация через PushTokenSync. */
  const updatePushToken = useCallback(
    async (id: string, token: string): Promise<boolean> => {
      try {
        const res = await fetchWithTimeout(`${SERVER_URL}/api/token/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        return res.ok;
      } catch (err) {
        console.log("[app] updatePushToken failed", err);
        return false;
      }
    },
    []
  );

  /** Submit 2FA password after QR scan when pairing === needs_2fa. */
  const submit2fa = useCallback(async (password: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const res = await fetchWithTimeout(
        `${SERVER_URL}/api/2fa/${userId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );
      return res.ok;
    } catch (err) {
      console.log("[app] submit2fa failed", err);
      return false;
    }
  }, [userId]);

  /** Disconnect: clear storage, reset state. */
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
    setPairing("unknown");
    setPairingHint(null);
  }, [userId]);

  return {
    userId,
    status,
    pairing,
    pairingHint,
    isLoaded,
    isReconnecting,
    connect,
    reconnect,
    register: connect,
    updatePushToken,
    checkStatus,
    submit2fa,
    disconnect,
  };
});
