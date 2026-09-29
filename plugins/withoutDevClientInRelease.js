// Keeps expo-dev-client out of the builds that ship.
//
// Play Console reported expo.modules.devlauncher classes inside the production
// AAB (v2.1.4 / 81). Release builds do get a gutted dev launcher — its heavy UI
// lives in an android `debug` source set — but everything under `main`, the
// activity configurator included, still compiles into the DEX of every variant.
//
// Autolinking is what pulls them in, and its static home (`expo.autolinking` in
// package.json) would disable the dev client everywhere, development builds
// included. So the exclusion is applied here instead, to the generated
// settings.gradle, and only when SUNSCAN_EXCLUDE_DEV_CLIENT is set — which
// eas.json does for the production and preview profiles, so the artifact that
// gets smoke-tested is the one that gets shipped.
//
// Nothing imports expo-dev-client from JS : it is autolinked native code only,
// and expo/AppEntry.js does not reach for it either.

const { withSettingsGradle } = require('expo/config-plugins');

const DEV_MODULES = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
];

const ANCHOR = 'useExpoModules()';

module.exports = function withoutDevClientInRelease(config) {
  if (process.env.SUNSCAN_EXCLUDE_DEV_CLIENT !== '1') {
    return config;
  }
  return withSettingsGradle(config, (config) => {
    const { contents } = config.modResults;
    if (contents.includes('useExpoModules([exclude:')) {
      return config; // already applied, prebuild ran on an existing android/
    }
    if (!contents.includes(ANCHOR)) {
      // Better to fail the build than to silently ship the dev client again
      throw new Error(
        `withoutDevClientInRelease: "${ANCHOR}" not found in settings.gradle. ` +
          'The Expo template changed, update this plugin.'
      );
    }
    const exclude = DEV_MODULES.map((name) => `'${name}'`).join(', ');
    config.modResults.contents = contents.replace(
      ANCHOR,
      `useExpoModules([exclude: [${exclude}]])`
    );
    return config;
  });
};
