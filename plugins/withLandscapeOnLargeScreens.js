// Keeps the landscape lock on tablets and foldables under Android 16.
//
// From Android 16 on, an app targeting API 36 has its `screenOrientation`,
// `resizeableActivity`, aspect ratios and setRequestedOrientation() calls
// *ignored* on any display whose smallest width is >= 600dp. The app would be
// free to open in portrait there, an orientation no screen of this app was ever
// drawn for : everything is laid out along the spectrum, landscape, and
// App.js locks one of the two landscape variants whatever the user picks.
//
// This manifest property is the documented opt-out. It is a stopgap : the
// compat flag behind it disappears at API 37 (Android 17), and Play will
// require targeting 37 around August 2027. Supporting portrait (or at least a
// sane large-screen layout) has to happen before that.
//
// Note : expo-build-properties has no hook for <property>, hence this plugin.
// Google's docs mention the Jetpack WindowManager dependency next to these
// property tags, but that is for the `WindowProperties` constants ; the name is
// hardcoded here and the framework reads the tag off the manifest itself.
//
// https://developer.android.com/develop/adaptive-apps/guides/app-orientation-aspect-ratio-resizability
// https://developer.android.com/about/versions/17/changes/ff-restrictions-ignored

const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const PROPERTY = 'android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY';

module.exports = function withLandscapeOnLargeScreens(config) {
  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    // Rewritten on every prebuild, so drop any copy left by an earlier run
    const others = (application.property ?? []).filter(
      (entry) => entry.$?.['android:name'] !== PROPERTY
    );
    application.property = [
      ...others,
      { $: { 'android:name': PROPERTY, 'android:value': 'true' } },
    ];
    return config;
  });
};
