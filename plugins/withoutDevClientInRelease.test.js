// node plugins/withoutDevClientInRelease.test.js
//
// The plugin rewrites package.json on the build machine, and a mistake there is
// silent: autolinking simply keeps the dev client, and only a Play Console
// warning weeks later says so. These cases run in a second.
//
// What they cannot check is that autolinking honours the key. That is:
//   npx expo prebuild -p android --no-install   (with SUNSCAN_EXCLUDE_DEV_CLIENT=1)
//   then resolve --platform android --json, and count the modules: 22, not 26.

const assert = require('assert');
const { withDevModulesExcluded, DEV_MODULES } = require('./withoutDevClientInRelease');

// 1. A package.json with no expo key: the whole path is created, android scoped
{
  const out = withDevModulesExcluded({ name: 'sunscan', version: '0.1.3' });
  assert.deepStrictEqual(out.expo.autolinking.android.exclude, DEV_MODULES);
  assert.strictEqual(out.name, 'sunscan', 'the rest of the file is kept');
  assert.strictEqual(out.expo.autolinking.apple, undefined, 'iOS is left alone');
  console.log('ok  creates the key');
}

// 2. Existing autolinking settings are kept, not replaced
{
  const pkg = {
    name: 'sunscan',
    expo: { autolinking: { searchPaths: ['./modules'], android: { exclude: ['some-other-module'] } } },
  };
  const out = withDevModulesExcluded(pkg);
  assert.deepStrictEqual(out.expo.autolinking.searchPaths, ['./modules'], 'searchPaths survives');
  assert.deepStrictEqual(out.expo.autolinking.android.exclude, ['some-other-module', ...DEV_MODULES]);
  console.log('ok  merges with what is there');
}

// 3. Idempotent, and the input is never mutated
{
  const pkg = { name: 'sunscan' };
  const once = withDevModulesExcluded(pkg);
  const twice = withDevModulesExcluded(once);
  assert.deepStrictEqual(twice.expo.autolinking.android.exclude, DEV_MODULES, 'no duplicates');
  assert.strictEqual(pkg.expo, undefined, 'the object passed in is untouched');
  console.log('ok  idempotent and pure');
}

// 4. The four packages are the ones autolinking is asked to drop
{
  assert.deepStrictEqual(
    DEV_MODULES,
    ['expo-dev-client', 'expo-dev-launcher', 'expo-dev-menu', 'expo-dev-menu-interface'],
    'expo-dev-client pulls the other three as dependencies: each is autolinked on its own'
  );
  console.log('ok  covers the whole dev client');
}

console.log('ALL OK');
