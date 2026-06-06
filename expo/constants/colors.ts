import { useColorScheme } from "react-native";

/** Hardcoded server URL — no user input required. */
export const SERVER_URL = "https://maxnotify.ru";

/** Brand palette. High-contrast, large-type friendly. */
export const Brand = {
  blue: "#007AFF",
  green: "#34C759",
  red: "#FF3B30",
  gray: "#8E8E93",
} as const;

const palette = {
  light: {
    background: "#FFFFFF",
    surface: "#F2F2F7",
    text: "#000000",
    textSecondary: "#8E8E93",
    textFaint: "#AEAEB2",
    border: "#D1D1D6",
    blue: Brand.blue,
    green: Brand.green,
    red: Brand.red,
    onAccent: "#FFFFFF",
  },
  dark: {
    background: "#000000",
    surface: "#1C1C1E",
    text: "#FFFFFF",
    textSecondary: "#98989F",
    textFaint: "#636366",
    border: "#3A3A3C",
    blue: "#0A84FF",
    green: "#30D158",
    red: "#FF453A",
    onAccent: "#FFFFFF",
  },
} as const;

export type ThemeColors = (typeof palette)["light"];

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? palette.dark : palette.light;
}

export default palette;
