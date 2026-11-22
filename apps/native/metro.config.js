const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts = process.env.EXPO_TV === "1"
  ? ["android.tv.tsx", "tv.tsx", ...config.resolver.sourceExts]
  : config.resolver.sourceExts;
module.exports = config;
