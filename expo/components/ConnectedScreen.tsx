import { useEffect, useRef } from "react";
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
import { useTheme } from "@/constants/colors";
import { openLinkedApp } from "@/lib/notifications";
import { useApp } from "@/providers/app";

const POLL_INTERVAL_MS = 60000;

export default function ConnectedScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { checkStatus, disconnect } = useApp();

  const mounted = useRef<boolean>(true);

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
        <StatusCircle status="active" />

        <Text style={[styles.statusText, { color: c.green }]}>
          Доставка уведомлений с веб-приложений включена
        </Text>

        <Text style={[styles.subText, { color: c.textSecondary }]}>
          Push-уведомления с ваших веб-приложений приходят автоматически
        </Text>

        <View style={{ height: 40 }} />

        <Pressable
          onPress={() => { void openLinkedApp(); }}
          style={({ pressed }) => [
            styles.openButton,
            { backgroundColor: c.blue, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.openButtonText, { color: c.onAccent }]}>
            Открыть Национальный
          </Text>
        </Pressable>

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
