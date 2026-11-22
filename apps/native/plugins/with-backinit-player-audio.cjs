const {
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

module.exports = function withBackinitPlayerAudio(config) {
  config = withAppBuildGradle(config, (result) => {
    const dependency = 'implementation("androidx.webkit:webkit:1.14.0")';
    if (!result.modResults.contents.includes(dependency)) {
      result.modResults.contents = result.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${dependency}`,
      );
    }
    return result;
  });
  config = withMainApplication(config, (result) => {
    const registration = "add(live.backinit.player.BackinitAudioPackage())";
    if (!result.modResults.contents.includes(registration)) {
      const anchor = "PackageList(this).packages.apply {";
      if (!result.modResults.contents.includes(anchor))
        throw new Error("Cannot register backinit audio module");
      result.modResults.contents = result.modResults.contents.replace(
        anchor,
        `${anchor}\n          ${registration}`,
      );
    }
    return result;
  });
  return withDangerousMod(config, [
    "android",
    (result) => {
      const target = path.join(
        result.modRequest.platformProjectRoot,
        "app/src/main/java/live/backinit/player",
      );
      fs.mkdirSync(target, { recursive: true });
      for (const file of [
        "BackinitAudioModule.kt",
        "BackinitAudioPackage.kt",
      ]) {
        fs.copyFileSync(
          path.join(__dirname, "android", file),
          path.join(target, file),
        );
      }
      return result;
    },
  ]);
};
