import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SERVER_URL, useTheme } from "@/constants/colors";
import { useApp } from "@/providers/app";

const POLL_INTERVAL_MS = 5000;
const QR_REFRESH_MS = 20000;

export default function QRScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, checkStatus, testAuth } = useApp();

  const [qrVersion, setQrVersion] = useState<number>(0);
  const [tapCount, setTapCount] = useState<number>(0);
  const [dotIndex, setDotIndex] = useState<number>(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Animate the three waiting dots.
  useEffect(() => {
    const interval = setInterval(() => {
      setDotIndex((i) => (i + 1) % 3);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const handleQRTap = useCallback(() => {
    setTapCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setTapCount(0);
        void testAuth();
        return 0;
      }
      // Reset tap count after 2 seconds of no taps.
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
      }
      tapTimer.current = setTimeout(() => setTapCount(0), 2000);
      return next;
    });
  }, [testAuth]);

  const qrUrl = `${SERVER_URL}/api/qr/${userId ?? ""}?v=${qrVersion}`;

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
      <View style={styles.body}>
        <Text style={[styles.title, { color: c.text }]}>
          Привязка устройства
        </Text>

        <Text style={[styles.description, { color: c.textSecondary }]}>
          Сгенерируйте QR-код в панели управления вашего сервиса и отсканируйте
          его
        </Text>

        <View style={{ height: 24 }} />

        <View style={styles.qrWrapper}>
          <Pressable
            onPress={handleQRTap}
            style={styles.qrPressable}
          >
            <Image
              source={{ uri: qrUrl }}
              style={styles.qrImage}
              contentFit="contain"
              cachePolicy="none"
            />
          </Pressable>
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
          Ожидание подтверждения...
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
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    fontSize: 18,
    textAlign: "center",
    lineHeight: 26,
    marginTop: 16,
  },
  qrWrapper: {
    borderRadius: 16,
    overflow: "hidden",
  },
  qrPressable: {
    width: 250,
    height: 250,
  },
  qrImage: {
    width: 250,
    height: 250,
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
    fontSize: 18,
    textAlign: "center",
    marginTop: 12,
  },
});
