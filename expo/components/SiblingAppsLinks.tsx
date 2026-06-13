import * as Linking from "expo-linking";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/constants/colors";
import { SIBLING_APPS } from "@/constants/siblingApps";

export default function SiblingAppsLinks() {
  const c = useTheme();

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.heading, { color: c.textSecondary }]}>
        Мои проекты
      </Text>
      <View style={styles.row}>
        {SIBLING_APPS.map((app) => (
          <Pressable
            key={app.name}
            onPress={() => {
              void Linking.openURL(app.appStoreUrl);
            }}
            style={({ pressed }) => [
              styles.item,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Image
              source={app.icon as number}
              style={styles.icon}
              contentFit="cover"
            />
            <Text style={[styles.label, { color: c.textSecondary }]}>
              {app.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 12,
  },
  heading: {
    fontSize: 14,
    fontWeight: "500",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    paddingVertical: 8,
  },
  item: {
    alignItems: "center",
    gap: 8,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
});
