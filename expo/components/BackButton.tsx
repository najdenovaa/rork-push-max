import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "@/constants/colors";

export default function BackButton({ onPress }: { onPress: () => void }) {
  const c = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { opacity: pressed ? 0.6 : 1 },
      ]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Text style={[styles.arrow, { color: c.blue }]}>←</Text>
      <Text style={[styles.label, { color: c.blue }]}>Назад</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  arrow: {
    fontSize: 24,
    fontWeight: "600",
  },
  label: {
    fontSize: 18,
    fontWeight: "600",
  },
});
