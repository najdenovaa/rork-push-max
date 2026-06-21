import { ActivityIndicator, StyleSheet, View } from "react-native";

import ConnectedScreen from "@/components/ConnectedScreen";
import QRScreen from "@/components/QRScreen";
import WelcomeScreen from "@/components/WelcomeScreen";
import { MAX_CONTENT_WIDTH, useTheme } from "@/constants/colors";
import { useApp } from "@/providers/app";

export default function Index() {
  const c = useTheme();
  const { userId, status, isLoaded, isReconnecting } = useApp();

  if (!isLoaded || isReconnecting) {
    return (
      <View style={[styles.outermost, { backgroundColor: c.background }]}>
        <View style={styles.constrained}>
          <ActivityIndicator size="large" color={c.blue} />
        </View>
      </View>
    );
  }

  // Screen 1: Welcome (no user_id)
  if (!userId) {
    return <WelcomeScreen />;
  }

  // Screen 3: Connected (status === active)
  if (status === "active") {
    return <ConnectedScreen />;
  }

  // Screen 2: QR scan (user_id exists, status pending/unknown)
  return <QRScreen />;
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
    alignItems: "center",
    justifyContent: "center",
  },
});
