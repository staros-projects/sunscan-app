// Keeps expo-dev-client out of the Android builds that ship.
//
// Play Console reported expo.modules.devlauncher classes inside the production
// AAB (v2.1.4 / 81). Release builds do get a gutted dev launcher — its heavy UI
// lives in an android `debug` source set — but everything under `main`, the
// activity configurator included, still compiles into the DEX of every variant.
//
// Autolinking is what pulls them in, so the fix is to hide the four packages
// from it. Its static home is `expo.autolinking` in package.json, which would
// disable the dev client everywhere, development builds included — so the key
// is written here instead, during prebuild, and only when
// SUNSCAN_EXCLUDE_DEV_CLIENT is set. eas.json sets it for the production and
// preview profiles, so the artifact that gets smoke-tested is the one that gets
// shipped. Prebuild writes package.json before it runs the plugins, so this
// write is the last one and survives.
//
// Nothing imports expo-dev-client from JS : it is autolinked native code only,
// and expo/AppEntry.js does not reach for it either.
//
// Why not settings.gradle. SDK 53 exposes `expoAutolinking.exclude`, and 2.1.5
// used to write `useExpoModules([exclude: [...]])` there, which SDK 53 refuses
// outright ("Could not find method useExpoModules()"). Assigning the property
// instead does build, but silently excludes nothing: the Gradle plugin joins
// the list into a single `--exclude "a b c d"` argument, which the resolver
// reads as one package name matching nothing (expo-modules-autolinking 2.1.14,
// AutolinkigCommandBuilder.option). Worse, that empty exclusion still reaches
// the resolver as a CLI option, and CLI options override the package.json ones
// (mergeLinkingOptions), so the two channels cannot be combined: this plugin
// must leave settings.gradle alone. Check both again before moving to the
// Gradle property; `node plugins/withoutDevClientInRelease.test.js` covers the
// merge, and `resolve --json` shows what autolinking really keeps.

const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const DEV_MODULES = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
];

/**
 * Returns the package.json contents with the exclusion added under
 * `expo.autolinking.android` (android only : the Play Console warning is the
 * reason this exists, and the iOS build is left as it is).
 * Exported for the test beside it.
 */
function withDevModulesExcluded(pkg, modules = DEV_MODULES) {
  const autolinking = pkg.expo?.autolinking ?? {};
  const android = autolinking.android ?? {};
  const exclude = Array.from(new Set([...(android.exclude ?? []), ...modules]));
  return {
    ...pkg,
    expo: { ...pkg.expo, autolinking: { ...autolinking, android: { ...android, exclude } } },
  };
}

module.exports = function withoutDevClientInRelease(config) {
  if (process.env.SUNSCAN_EXCLUDE_DEV_CLIENT !== '1') {
    return config;
  }
  return withDangerousMod(config, ['android', (config) => {
    const file = path.join(config.modRequest.projectRoot, 'package.json');
    const before = fs.readFileSync(file, 'utf8');
    const after = withDevModulesExcluded(JSON.parse(before));
    // Two spaces and a trailing newline: the shape npm itself writes
    fs.writeFileSync(file, `${JSON.stringify(after, null, 2)}\n`);
    // Says it out loud : on a developer machine this leaves package.json
    // modified, and it is the only sign that the dev client is being dropped.
    console.log(
      `withoutDevClientInRelease: package.json now hides ${DEV_MODULES.join(', ')} from Android autolinking.`
    );
    return config;
  }]);
};

module.exports.withDevModulesExcluded = withDevModulesExcluded;
module.exports.DEV_MODULES = DEV_MODULES;
