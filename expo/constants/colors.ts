import { useColorScheme } from "react-native";

/** Hardcoded server URL — no user input required. */
export const SERVER_URL = "https://mkspush.ru";

/** Legal URLs. */
export const PRIVACY_URL = "https://mkspush.ru/privacy";
export const TERMS_URL = "https://mkspush.ru/terms";
export const SUPPORT_URL = "https://mkspush.ru/support";

/** URL linked web app — opened when user taps a push notification. */
export const LINKED_APP_URL = "https://max.ru/";

/** Custom URL scheme for the linked app — used to open the native app instead of Safari. */
export const LINKED_APP_SCHEME = "max";

/** Expo project ID for push notifications in standalone builds. */
export const EXPO_PROJECT_ID = "b83ad525-873b-4d42-b1c1-995dc844da51";

/** Maximum content width for iPad safety — prevents layout breakage on wide screens. */
export const MAX_CONTENT_WIDTH = 500;

/** Brand palette — green primary, amber accent. */
export const Brand = {
  primary: "#16A34A",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
  gray: "#8E8E93",
} as const;

const palette = {
  light: {
    background: "#DCFCE7",
    surface: "#FFFFFF",
    text: "#0A1F12",
    textSecondary: "#5A7D65",
    textFaint: "#8FAA97",
    border: "#D1E8D6",
    blue: "#16A34A",
    green: "#22C55E",
    red: "#EF4444",
    amber: "#F59E0B",
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
    amber: "#FFB340",
    onAccent: "#FFFFFF",
  },
} as const;

export type ThemeColors = typeof palette.light | typeof palette.dark;

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? palette.dark : palette.light;
}

export default palette;
