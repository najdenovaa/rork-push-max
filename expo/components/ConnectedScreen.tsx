import { useCallback, useEffect, useRef } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import StatusCircle from "@/components/StatusCircle";
import { useTheme } from "@/constants/colors";
import { useApp } from "@/providers/app";

const POLL_INTERVAL_MS = 60000;

export default function ConnectedScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { checkStatus, disconnect } = useApp();

  const mounted = useRef<boolean>(true);

  const runCheck = useCallback(async (): Promise<void> => {
    const result = await checkStatus();
    if (mounted.current) {
      void result;
    }
  }, [checkStatus]);

  useEffect(() => {
    mounted.current = true;
    const interval = setInterval(runCheck, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [runCheck]);

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
          onPress={confirmDisconnect}
          style={styles.disconnectButton}
        >
          <Text style={[styles.disconnectText, { color: c.textSecondary }]}>
            Отключить
          </Text>
        </Pressable>
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
