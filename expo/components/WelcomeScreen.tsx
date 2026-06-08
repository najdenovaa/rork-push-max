import * as Linking from "expo-linking";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PRIVACY_URL, TERMS_URL, useTheme } from "@/constants/colors";
import {
  getPushToken,
  requestNotificationPermission,
} from "@/lib/notifications";
import { useApp } from "@/providers/app";
import SiblingAppsLinks from "@/components/SiblingAppsLinks";

type Phase = "idle" | "loading" | "error" | "permission_denied";

export default function WelcomeScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { connect } = useApp();

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
      (await getPushToken()) ?? "pending-expo";

    const result = await connect(token);
    if (!result.success) {
      setPhase("error");
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
          Умные уведомления
        </Text>

        <View style={{ height: 20 }} />

        <Text style={[styles.description, { color: c.textSecondary }]}>
          Ваши данные в безопасности. Мы не читаем ваши сообщения.
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

      {/* Footer — always visible on the start screen */}
      <View style={styles.footerSection}>
        <SiblingAppsLinks />

        <View style={{ height: 8 }} />

        <Text style={[styles.footer, { color: c.textFaint }]}>
          Приложение не читает ваши сообщения. Только доставка уведомлений.
        </Text>
        <View style={styles.legalLinks}>
          <Text
            style={[styles.legalLink, { color: c.textFaint }]}
            onPress={() => { void Linking.openURL(PRIVACY_URL); }}
          >
            Политика конфиденциальности
          </Text>
          <Text
            style={[styles.legalLink, { color: c.textFaint }]}
            onPress={() => { void Linking.openURL(TERMS_URL); }}
          >
            Пользовательское соглашение
          </Text>
        </View>
      </View>
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
  footerSection: {
    gap: 10,
    paddingBottom: 8,
  },
  footer: {
    fontSize: 16,
    textAlign: "center",
  },
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    flexWrap: "wrap",
  },
  legalLink: {
    fontSize: 15,
    textDecorationLine: "underline",
  },
});
