import AsyncStorage from "@react-native-async-storage/async-storage";

export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  // Handle mkspush://pair?user_id=XXX deep link
  if (path.startsWith("pair")) {
    const queryIndex = path.indexOf("?");
    if (queryIndex !== -1) {
      const params = new URLSearchParams(path.slice(queryIndex + 1));
      const userId = params.get("user_id");
      if (userId) {
        void AsyncStorage.setItem("user_id", userId);
      }
    }
  }
  return "/";
}