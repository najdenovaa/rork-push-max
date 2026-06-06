import { Check } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { Brand } from "@/constants/colors";
import type { AppStatus } from "@/providers/app";

type Props = {
  status: AppStatus;
};

const SIZE = 120;

/** Large circular status indicator with an animated pulse halo for "active". */
export default function StatusCircle({ status }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status !== "active") {
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, status]);

  const color =
    status === "active"
      ? Brand.green
      : status === "pending"
        ? Brand.primary
        : Brand.gray;

  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });
  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.6],
  });

  return (
    <View style={styles.wrapper}>
      {status === "active" && (
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: color,
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
      )}
      <View style={[styles.circle, { backgroundColor: color }]}>
        {status === "active" && (
          <Check color="#FFFFFF" size={64} strokeWidth={4} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
