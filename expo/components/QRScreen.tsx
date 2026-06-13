import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackButton from "@/components/BackButton";
import { SERVER_URL, useTheme } from "@/constants/colors";
import { useApp } from "@/providers/app";

const POLL_INTERVAL_MS = 5000;
const QR_REFRESH_MS = 20000;

export default function QRScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, pairing, pairingHint, checkStatus, submit2fa, disconnect } =
    useApp();

  const [qrVersion, setQrVersion] = useState<number>(0);
  const [dotIndex, setDotIndex] = useState<number>(0);

  // 2FA state
  const [password, setPassword] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [twofaError, setTwofaError] = useState<string | null>(null);

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

  // Refresh QR every 20 seconds — only when NOT in 2FA mode.
  useEffect(() => {
    if (pairing === "needs_2fa") return;
    const interval = setInterval(() => {
      setQrVersion((v) => v + 1);
    }, QR_REFRESH_MS);
    return () => clearInterval(interval);
  }, [pairing]);

  // Animate the three waiting dots (QR mode only).
  useEffect(() => {
    if (pairing === "needs_2fa") return;
    const interval = setInterval(() => {
      setDotIndex((i) => (i + 1) % 3);
    }, 800);
    return () => clearInterval(interval);
  }, [pairing]);

  const qrUrl = `${SERVER_URL}/api/max-qr/${userId ?? ""}?v=${qrVersion}`;

  const handleSubmit2fa = async (): Promise<void> => {
    const trimmed = password.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setTwofaError(null);
    const ok = await submit2fa(trimmed);
    if (ok) {
      await checkStatus();
    } else {
      setTwofaError("Неверный пароль или время истекло. Попробуйте снова.");
    }
    setSubmitting(false);
  };

  // ── 2FA Mode ──
  if (pairing === "needs_2fa") {
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
        <BackButton onPress={() => void disconnect()} />

        <View style={styles.body}>
          <Text style={[styles.title, { color: c.text }]}>
            Подтвердите вход
          </Text>

          <View style={{ height: 16 }} />

          <Text style={[styles.twofaDescription, { color: c.textSecondary }]}>
            QR отсканирован. Введите пароль двухфакторной аутентификации вашего
            аккаунта.
          </Text>

          {pairingHint != null && (
            <>
              <View style={{ height: 12 }} />
              <Text style={[styles.hint, { color: c.blue }]}>
                Подсказка: {pairingHint}
              </Text>
            </>
          )}

          <View style={{ height: 28 }} />

          <TextInput
            style={[
              styles.passwordInput,
              {
                backgroundColor: c.surface,
                color: c.text,
                borderColor: c.border,
              },
            ]}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Пароль"
            placeholderTextColor={c.textFaint}
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setTwofaError(null);
            }}
            editable={!submitting}
            returnKeyType="done"
            onSubmitEditing={() => void handleSubmit2fa()}
          />

          <View style={{ height: 20 }} />

          {twofaError != null && (
            <>
              <Text style={[styles.errorText, { color: c.red }]}>
                {twofaError}
              </Text>
              <View style={{ height: 16 }} />
            </>
          )}

          <Pressable
            onPress={() => void handleSubmit2fa()}
            disabled={submitting || !password.trim()}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: submitting || !password.trim() ? c.border : c.blue,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={c.onAccent} />
            ) : (
              <Text style={[styles.submitButtonText, { color: c.onAccent }]}>
                Подтвердить
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  // ── QR Mode ──
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
      <BackButton onPress={() => void disconnect()} />

      <View style={styles.body}>
        <Text style={[styles.title, { color: c.text }]}>
          Подключите Национальный
        </Text>

        <View style={{ height: 24 }} />

        {/* 3 steps */}
        <View style={styles.steps}>
          {[
            "1. Откройте Национальный",
            "2. Профиль → Устройства → Сканировать QR",
            "3. Наведите камеру на QR-код ниже",
          ].map((step, i) => (
            <Text key={i} style={[styles.step, { color: c.text }]}>
              {step}
            </Text>
          ))}
        </View>

        <View style={{ height: 24 }} />

        {/* QR code from server */}
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
  // 2FA mode styles
  twofaDescription: {
    fontSize: 20,
    textAlign: "center",
    lineHeight: 28,
    maxWidth: 320,
  },
  hint: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  passwordInput: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    fontSize: 20,
    paddingHorizontal: 20,
    maxWidth: 320,
    width: "100%",
  },
  submitButton: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 320,
    width: "100%",
  },
  submitButtonText: {
    fontSize: 20,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 26,
    maxWidth: 320,
  },
});
