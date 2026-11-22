import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const television = process.env.EXPO_TV === "1";
  return {
    ...config,
    name: television ? "backinit TV" : "backinit",
    slug: television ? "backinit-tv" : "backinit-mobile",
    scheme: "backinit",
    version: "1.0.3",
    orientation: television ? "landscape" : "portrait",
    userInterfaceStyle: "dark",
    icon: "./assets/icon.png",
    plugins: [
      ["@react-native-tvos/config-tv", { isTV: television }],
      ["expo-navigation-bar", { enforceContrast: false, style: "light" }],
      "./plugins/with-backinit-android-theme.cjs",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 220,
          resizeMode: "contain",
          backgroundColor: "#031b15",
        },
      ],
    ],
    android: {
      package: television ? "live.backinit.tv" : "live.backinit.mobile",
      versionCode: 4,
      adaptiveIcon: {
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundColor: "#031b15",
      },
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            { scheme: "https", host: "backinit.live", pathPrefix: "/watch" },
            { scheme: "https", host: "db.backinit.live", pathPrefix: "/watch" },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    extra: {
      apiBaseUrl:
        process.env.EXPO_PUBLIC_API_URL || "https://backinit.live/api",
      television,
    },
  };
};
