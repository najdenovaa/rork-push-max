import * as Linking from "expo-linking";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/constants/colors";
import {
  getPushToken,
  requestNotificationPermission,
} from "@/lib/notifications";
import { useApp } from "@/providers/app";

type Phase = "idle" | "loading" | "error" | "no_slots" | "permission_denied";

export default function WelcomeScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { register } = useApp();

  const [phase, setPhase] = useState<Phase>("idle");

  const handleStart = async (): Promise<void> => {
    setPhase("loading");

    const permission = await requestNotificationPermission();
    if (permission === "denied") {
      setPhase("permission_denied");
      return;
    }

    // In standalone (TestFlight) builds the push token can be unavailable on
    // first launch. Don't block the user with a server error — register with a
    // placeholder and let QRScreen retry the real token in the background.
    const token =
      (await getPushToken()) ?? "ExponentPushToken[pending-ios]";

    const result = await register(token);
    if (!result.success) {
      if (result.noSlots) {
        setPhase("no_slots");
      } else {
        setPhase("error");
      }
    }
  };

  if (phase === "loading") {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.blue} />
        <Text style={[styles.loadingText, { color: c.textSecondary }]}>
          Подключаем...
        </Text>
      </View>
    );
  }

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
        <Text style={[styles.title, { color: c.text }]}>MKS Push</Text>

        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Push-уведомления на ваш iPhone
        </Text>

        <View style={{ height: 20 }} />

        <Text style={[styles.description, { color: c.textSecondary }]}>
          Получайте уведомления из Max на ваш iPhone
        </Text>

        <View style={{ height: 40 }} />

        {phase === "error" && (
          <>
            <Text style={[styles.errorText, { color: c.red }]}>
              Сервер временно недоступен. Проверьте интернет и попробуйте снова.
            </Text>
            <View style={{ height: 20 }} />
            <Pressable
              onPress={() => {
                void handleStart();
              }}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: c.blue, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.buttonText, { color: c.onAccent }]}>
                Повторить
              </Text>
            </Pressable>
          </>
        )}

        {phase === "no_slots" && (
          <>
            <Text style={[styles.errorText, { color: c.amber }]}>
              Сейчас все места заняты. Попробуйте позже.
            </Text>
            <View style={{ height: 20 }} />
            <Pressable
              onPress={() => {
                void handleStart();
              }}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: c.blue, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.buttonText, { color: c.onAccent }]}>
                Попробовать снова
              </Text>
            </Pressable>
          </>
        )}

        {phase === "permission_denied" && (
          <>
            <Text style={[styles.errorText, { color: c.red }]}>
              Для работы нужны уведомления. Включите их в настройках.
            </Text>
            <View style={{ height: 20 }} />
            <Pressable
              onPress={() => Linking.openSettings()}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: c.blue, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.buttonText, { color: c.onAccent }]}>
                Открыть настройки
              </Text>
            </Pressable>
          </>
        )}

        {phase === "idle" && (
          <Pressable
            onPress={() => {
              void handleStart();
            }}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: c.blue, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: c.onAccent }]}>
              Начать
            </Text>
          </Pressable>
        )}
      </View>

      {phase === "idle" && (
        <Text style={[styles.footer, { color: c.textFaint }]}>
          Приложение не читает ваши сообщения. Только уведомления.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  loadingText: {
    fontSize: 20,
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 20,
    textAlign: "center",
    marginTop: 8,
  },
  description: {
    fontSize: 18,
    textAlign: "center",
    lineHeight: 26,
  },
  button: {
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 28,
  },
  footer: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 8,
  },
});
