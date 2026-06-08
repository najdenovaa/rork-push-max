export interface SiblingApp {
  /** App name shown under the icon. */
  name: string;
  /** App Store URL opened on tap. */
  appStoreUrl: string;
  /** Local icon asset. */
  icon: ReturnType<typeof require>;
}

export const SIBLING_APPS: SiblingApp[] = [
  {
    name: "Мусорка",
    appStoreUrl:
      "https://apps.apple.com/us/app/%D0%BC%D1%83%D1%81%D0%BE%D1%80%D0%BA%D0%B0/id6762083275",
    icon: require("@/assets/images/skidos-icon.png"),
  },
  {
    name: "Скидос",
    appStoreUrl:
      "https://apps.apple.com/us/app/%D1%81%D0%BA%D0%B8%D0%B4%D0%BE%D1%81/id6775503298",
    icon: require("@/assets/images/musorka-icon.png"),
  },
];
