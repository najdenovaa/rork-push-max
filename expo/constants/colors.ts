import { useColorScheme } from "react-native";

/** Hardcoded server URL — no user input required. */
export const SERVER_URL = "https://mkspush.ru";

/** Brand palette — Скидос family: green primary, amber accent. */
export const Brand = {
  primary: "#16A34A",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
  gray: "#8E8E93",
} as const;

const palette = {
  light: {
    background: "#FAFDF7",
    surface: "#FFFFFF",
    text: "#0A1F12",
    textSecondary: "#5A7D65",
    textFaint: "#8FAA97",
    border: "#D1E8D6",
    blue: "#16A34A",
    green: "#22C55E",
    red: "#EF4444",
    onAccent: "#FFFFFF",
  },
  dark: {
    background: "#071A10",
    surface: "#0F2A1A",
    text: "#F3FFF5",
    textSecondary: "#B7D9C1",
    textFaint: "#4D7A5E",
    border: "#1D4B2E",
    blue: "#22C55E",
    green: "#22C55E",
    red: "#F87171",
    onAccent: "#FFFFFF",
  },
} as const;

export type ThemeColors = (typeof palette)["light"];

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? palette.dark : palette.light;
}

export default palette;
