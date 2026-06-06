import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/constants/colors";

export default function NotFoundScreen() {
  const c = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: "Не найдено" }} />
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <Text style={[styles.title, { color: c.text }]}>Экран не найден</Text>
        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: c.blue }]}>На главную</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  link: {
    marginTop: 16,
  },
  linkText: {
    fontSize: 18,
  },
});
