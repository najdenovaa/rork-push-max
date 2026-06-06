import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SERVER_URL, useTheme } from "@/constants/colors";
import { getPushToken } from "@/lib/notifications";
import { useApp } from "@/providers/app";

const POLL_INTERVAL_MS = 5000;
const QR_REFRESH_MS = 20000;
const TOKEN_RETRY_MS = 15000;

export default function QRScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, checkStatus, disconnect, updatePushToken } = useApp();

  const [qrVersion, setQrVersion] = useState<number>(0);
  const [dotIndex, setDotIndex] = useState<number>(0);

  // Poll status every 5 seconds.
  useEffect(() => {
    let active = true;
    const poll = async (): Promise<void> => {
      await checkStatus();
      if (active) {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    };
    void poll();
    return () => {
      active = false;
    };
  }, [checkStatus]);

  // Refresh QR every 20 seconds.
  useEffect(() => {
    const interval = setInterval(() => {
      setQrVersion((v) => v + 1);
    }, QR_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  // Retry getting a real push token every 15s and send it to the server.
  // Covers standalone builds where the token wasn't ready at registration.
  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    const retry = async (): Promise<void> => {
      const token = await getPushToken();
      if (active && token && !token.includes("pending")) {
        await updatePushToken(userId, token);
      }
    };
    void retry();
    const interval = setInterval(() => {
      void retry();
    }, TOKEN_RETRY_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [userId, updatePushToken]);

  // Animate the three waiting dots.
  useEffect(() => {
    const interval = setInterval(() => {
      setDotIndex((i) => (i + 1) % 3);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const qrUrl = `${SERVER_URL}/api/max-qr/${userId ?? ""}?v=${qrVersion}`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: c.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      {/* Back button — return to WelcomeScreen */}
      <Pressable
        onPress={() => void disconnect()}
        style={({ pressed }) => [
          styles.backButton,
          { opacity: pressed ? 0.6 : 1 },
        ]}
        hitSlop={12}
      >
        <Text style={[styles.backArrow, { color: c.blue }]}>←</Text>
        <Text style={[styles.backLabel, { color: c.blue }]}>Назад</Text>
      </Pressable>

      <View style={styles.body}>
        <Text style={[styles.title, { color: c.text }]}>
          Подключите Max
        </Text>

        <View style={{ height: 24 }} />

        {/* 3 steps — large type for easy reading */}
        <View style={styles.steps}>
          {[
            "1. Откройте Max",
            "2. Профиль → Устройства → Сканировать QR",
            "3. Наведите камеру на QR-код ниже",
          ].map((step, i) => (
            <Text key={i} style={[styles.step, { color: c.text }]}>
              {step}
            </Text>
          ))}
        </View>

        <View style={{ height: 24 }} />

        {/* QR code from GREEN-API, proxied through our server */}
        <View style={styles.qrWrapper}>
          <Image
            source={{ uri: qrUrl }}
            style={styles.qrImage}
            contentFit="contain"
            cachePolicy="none"
          />
        </View>

        <View style={{ height: 12 }} />

        <Text style={[styles.qrHint, { color: c.textFaint }]}>
          QR обновляется каждые 20 секунд
        </Text>

        <View style={styles.spinnerRow}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === dotIndex ? c.blue : c.border,
                },
              ]}
            />
          ))}
        </View>

        <Text style={[styles.waitingText, { color: c.textSecondary }]}>
          Ожидание подключения...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  steps: {
    gap: 14,
    alignItems: "center",
  },
  step: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 30,
  },
  qrWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  qrImage: {
    width: 250,
    height: 250,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  backArrow: {
    fontSize: 24,
    fontWeight: "600",
  },
  backLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
  qrHint: {
    fontSize: 16,
    textAlign: "center",
  },
  spinnerRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
    justifyContent: "center",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  waitingText: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
  },
});
