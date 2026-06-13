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

import { MAX_CONTENT_WIDTH, PRIVACY_URL, TERMS_URL, useTheme } from "@/constants/colors";
import { useApp } from "@/providers/app";
import SiblingAppsLinks from "@/components/SiblingAppsLinks";

type Phase = "idle" | "loading" | "error";

export default function WelcomeScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { connect } = useApp();

  const [phase, setPhase] = useState<Phase>("idle");

  /** Connect to the server with a placeholder push token.
   *  Notification permission is requested later on the ConnectedScreen. */
  const handleStart = async (): Promise<void> => {
    setPhase("loading");

    const result = await connect("pending-expo");
    if (!result.success) {
      setPhase("error");
    }
  };

  if (phase === "loading") {
    return (
      <View style={[styles.outermost, { backgroundColor: c.background }]}>
        <View style={[styles.constrained, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
          <ActivityIndicator size="large" color={c.blue} />
          <Text style={[styles.loadingText, { color: c.textSecondary }]}>
            Подключаем...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.outermost, { backgroundColor: c.background }]}>
      <View
        style={[
          styles.constrained,
          {
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
              style={styles.legalLink}
              onPress={() => {
                void Linking.openURL(PRIVACY_URL);
              }}
            >
              Privacy Policy
            </Text>
            <Text style={styles.legalSep}>|</Text>
            <Text
              style={styles.legalLink}
              onPress={() => {
                void Linking.openURL(TERMS_URL);
              }}
            >
              Terms of Service
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outermost: {
    flex: 1,
    alignItems: "center",
  },
  constrained: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 20,
    marginTop: 20,
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
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  legalLink: {
    fontSize: 14,
    color: "#888",
    textDecorationLine: "underline",
  },
  legalSep: {
    fontSize: 14,
    color: "#888",
  },
});
