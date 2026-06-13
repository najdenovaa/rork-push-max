import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackButton from "@/components/BackButton";
import SiblingAppsLinks from "@/components/SiblingAppsLinks";
import StatusCircle from "@/components/StatusCircle";
import {
  MAX_CONTENT_WIDTH,
  PRIVACY_URL,
  TERMS_URL,
  useTheme,
} from "@/constants/colors";
import {
  openLinkedApp,
  requestNotificationPermission,
} from "@/lib/notifications";
import { useApp } from "@/providers/app";

const POLL_INTERVAL_MS = 60000;

type NotifState = "checking" | "granted" | "denied" | "undetermined";

export default function ConnectedScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { checkStatus, disconnect } = useApp();

  const mounted = useRef<boolean>(true);
  const [notifState, setNotifState] = useState<NotifState>("checking");

  useEffect(() => {
    mounted.current = true;
    const interval = setInterval(() => {
      void checkStatus();
    }, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [checkStatus]);

  // Check notification permission on mount.
  useEffect(() => {
    void Notifications.getPermissionsAsync().then((settings) => {
      if (!mounted.current) return;
      if (settings.status === "granted") {
        setNotifState("granted");
      } else if (settings.status === "denied") {
        setNotifState("denied");
      } else {
        setNotifState("undetermined");
      }
    });
  }, []);

  const handleEnableNotifications = async (): Promise<void> => {
    const result = await requestNotificationPermission();
    if (!mounted.current) return;
    setNotifState(result === "granted" ? "granted" : "denied");
  };

  const confirmDisconnect = (): void => {
    Alert.alert(
      "Отключить?",
      "Вы перестанете получать push-уведомления с веб-приложений.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Отключить",
          style: "destructive",
          onPress: () => {
            void disconnect();
          },
        },
      ],
      { cancelable: true }
    );
  };

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
        <BackButton onPress={() => void disconnect()} />

        {/* Notification permission banner */}
        {notifState === "undetermined" && (
          <View style={[styles.notifBanner, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.notifText, { color: c.textSecondary }]}>
              Включите уведомления, чтобы не пропускать сообщения
            </Text>
            <Pressable
              onPress={() => {
                void handleEnableNotifications();
              }}
              style={({ pressed }) => [
                styles.notifButton,
                { backgroundColor: c.blue, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.notifButtonText, { color: c.onAccent }]}>
                Включить
              </Text>
            </Pressable>
          </View>
        )}

        {notifState === "denied" && (
          <View style={[styles.notifBanner, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.notifSubText, { color: c.textFaint }]}>
              Уведомления отключены. Включить можно в Настройках iPhone.
            </Text>
            <Pressable
              onPress={() => {
                void Linking.openSettings();
              }}
              style={({ pressed }) => [
                styles.notifSettingsButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.notifSettingsText, { color: c.blue }]}>
                Открыть настройки
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.body}>
          <StatusCircle status="active" />

          <Text style={[styles.statusText, { color: c.green }]}>
            Доставка уведомлений с веб-приложений включена
          </Text>

          <Text style={[styles.subText, { color: c.textSecondary }]}>
            Push-уведомления с ваших веб-приложений приходят автоматически
          </Text>

          <View style={{ height: 40 }} />

          <Pressable
            onPress={() => {
              void openLinkedApp();
            }}
            style={({ pressed }) => [
              styles.openButton,
              { backgroundColor: c.blue, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.openButtonText, { color: c.onAccent }]}>
              Открыть приложение
            </Text>
          </Pressable>

          <View style={{ height: 20 }} />

          {/* Legal links */}
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

          <View style={{ height: 20 }} />

          <Pressable
            onPress={confirmDisconnect}
            style={styles.disconnectButton}
          >
            <Text style={[styles.disconnectText, { color: c.textSecondary }]}>
              Отключить
            </Text>
          </Pressable>
        </View>

        <SiblingAppsLinks />
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
  },
  // Notification banner
  notifBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  notifText: {
    fontSize: 17,
    lineHeight: 24,
  },
  notifButton: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  notifButtonText: {
    fontSize: 18,
    fontWeight: "700",
  },
  notifSubText: {
    fontSize: 15,
    lineHeight: 22,
  },
  notifSettingsButton: {
    alignSelf: "flex-start",
  },
  notifSettingsText: {
    fontSize: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  body: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  statusText: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 28,
  },
  subText: {
    fontSize: 18,
    textAlign: "center",
    marginTop: 12,
  },
  openButton: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  openButtonText: {
    fontSize: 18,
    fontWeight: "700",
  },
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
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
  disconnectButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  disconnectText: {
    fontSize: 16,
  },
});
