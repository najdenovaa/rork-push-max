import { ActivityIndicator, StyleSheet, View } from "react-native";

import ConnectedScreen from "@/components/ConnectedScreen";
import QRScreen from "@/components/QRScreen";
import WelcomeScreen from "@/components/WelcomeScreen";
import { useTheme } from "@/constants/colors";
import { useApp } from "@/providers/app";

export default function Index() {
  const c = useTheme();
  const { userId, status, isLoaded } = useApp();

  if (!isLoaded) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.blue} />
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
