const { withAndroidStyles } = require("expo/config-plugins");

module.exports = function withBackinitAndroidTheme(config) {
  return withAndroidStyles(config, (result) => {
    const appTheme = result.modResults.resources.style?.find(
      (style) => style.$.name === "AppTheme",
    );
    if (!appTheme) return result;
    const values = new Map([
      ["android:navigationBarColor", "#031b15"],
      ["android:windowLightNavigationBar", "false"],
    ]);
    appTheme.item = (appTheme.item || []).filter(
      (item) => !values.has(item.$.name),
    );
    for (const [name, value] of values) {
      appTheme.item.push({ $: { name }, _: value });
    }
    return result;
  });
};
