export default ({ config }) => {
    const isIOS = process.env.EXPO_OS === "ios"; // Détection de l'OS via une variable d'environnement
  
    return {
      ...config,
      expo: {
        name: "SUNSCAN",
        slug: "sunscan",
        version: "2.1.7",
        orientation: "landscape",
        icon: "./assets/icon.png",
        userInterfaceStyle: "dark",
        assetBundlePatterns: ["**/*"],
        ios: {
          buildNumber: "41",
          supportsTablet: true,
          requireFullScreen: true,
          bundleIdentifier: "com.staros.sunscan-app",
          infoPlist: {
            ITSAppUsesNonExemptEncryption: false,
            // Required to reach a SUNSCAN sitting on the same wifi network as
            // the phone (non-hotspot mode) and to scan for it automatically.
            NSLocalNetworkUsageDescription:
              "Allow $(PRODUCT_NAME) to find your SUNSCAN on your local network.",
            // _sunscan._tcp is the service the backend announces once it has
            // joined the home wifi: without it iOS 14+ browses nothing.
            NSBonjourServices: ["_http._tcp", "_sunscan._tcp"]
          }
        },
        android: {
          barStyle: "dark-content",
          versionCode: 41,
          adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#fff"
          },
          permissions: [
            "INTERNET",
            "RECEIVE_BOOT_COMPLETED",
            "ACCESS_NETWORK_STATE",
            // Needed to read the phone's own IP and derive the subnet to scan
            "ACCESS_WIFI_STATE",
            // mDNS discovery of the SUNSCAN (react-native-zeroconf takes the multicast lock)
            "CHANGE_WIFI_MULTICAST_STATE"
          ],
          blockedPermissions: [
            "android.permission.READ_MEDIA_IMAGES",
            "android.permission.READ_MEDIA_VIDEO",
            "android.permission.ACTIVITY_RECOGNITION"
          ],
          package: "com.staros.sunscan"
        },
        web: {
          favicon: "./assets/favicon.png",
          bundler: "metro"
        },
        extra: {
          eas: {
            projectId: "e3257f38-9652-4507-a954-26c68c793b33"
          }
        },
        owner: "staros",
        plugins: [
          [
            // Just the mark, centred: components/AnimatedSplash picks up from
            // this exact frame. imageWidth must equal its SPLASH_MARK_WIDTH.
            "expo-splash-screen",
            {
              image: "./assets/splash-icon.png",
              imageWidth: 110,
              resizeMode: "contain",
              backgroundColor: "#000000"
            }
          ],
          [
            "expo-screen-orientation",
            {
              initialOrientation: "LANDSCAPE"
            }
          ],
          [
            "expo-location",
            {
              locationWhenInUsePermission:
                "Allow $(PRODUCT_NAME) to use your location to calculate Sun ephemeris and correctly reorient your images."
            }
          ],
          [
            "expo-build-properties",
            {
              android: {
                usesCleartextTraffic: true,
                // Google Play requires targeting Android 16 (API 36) for updates
                compileSdkVersion: 36,
                targetSdkVersion: 36,
                buildToolsVersion: "36.0.0",
                // R8. Off until 2.1.6, which Play rated at 1% obfuscation —
                // below the 25% floor its technical-quality requirement starts
                // enforcing in February 2027 for anything over 10 MB of
                // uncompressed DEX (this app: 28.7 MB). Everything that is not
                // explicitly kept below gets renamed, which takes the figure
                // from 1% to the high eighties.
                //
                // Resource shrinking is deliberately NOT turned on with it:
                // it does not touch the DEX, so it buys nothing against this
                // warning, and it is a second way for a release build to break.
                //
                // R8 never fails the build over what it strips — the damage
                // shows up at runtime, on whichever screen touched the missing
                // class. Read the note above every rule before removing one.
                enableProguardInReleaseBuilds: true,
                extraProguardRules: [
                  // Widens the stock JNI rule. proguard-android.txt already
                  // carries `-keepclasseswithmembernames class * { native
                  // <methods>; }` ; what it misses is includedescriptorclasses,
                  // which also pins the types in those signatures. fbjni
                  // resolves both the class and the method descriptor from
                  // strings baked into the C++ (findClassStatic /
                  // makeNativeMethod), so a renamed HybridData, RuntimeExecutor
                  // or SkiaManager parameter breaks the hybrid at registration
                  // time. Covers Skia, Reanimated, expo-gl and the dnssd copy
                  // inside react-native-zeroconf in one line. Names only : this
                  // form still lets R8 shrink what nothing reaches.
                  "-keepclasseswithmembernames,includedescriptorclasses class * {",
                  "    native <methods>;",
                  "}",
                  "",
                  // @shopify/react-native-skia ships no consumer rules at all
                  // (2.2.2). Its C++ resolves PlatformContext, SkiaManager, the
                  // view classes and ViewScreenshotService by name and calls
                  // into them through GetMethodID, and only four of the
                  // fourteen classes carry @DoNotStrip. Keeping the package
                  // whole is a rounding error on 28.7 MB.
                  "-keep class com.shopify.reactnative.skia.** { *; }",
                  "",
                  // react-native-zeroconf. SunscanNetwork only ever asks for
                  // the NSD implementation (plain Java, safe), but
                  // ZeroConfImplFactory references DnssdImpl from the same
                  // switch, so the bundled rx2dnssd copy is reachable and its
                  // listener classes are called back from native code by name.
                  "-keep class com.github.druk.dnssd.** { *; }",
                  "",
                  // Keeps Play Console crash reports readable: the AAB carries
                  // mapping.txt in its metadata, so Play de-obfuscates the
                  // traces by itself once the line tables are still there.
                  "-keepattributes SourceFile,LineNumberTable",
                  "-renamesourcefileattribute SourceFile",
                  "",
                  // AGP 8 turns unresolved references into a build failure.
                  // These are okhttp's optional TLS providers and build-time
                  // annotations, absent at runtime by design.
                  "-dontwarn org.conscrypt.**",
                  "-dontwarn org.bouncycastle.**",
                  "-dontwarn org.openjsse.**",
                  "-dontwarn com.google.errorprone.annotations.**",
                  "-dontwarn javax.annotation.**"
                ].join("\n")
              }
            }
          ],
          // The system bars are hidden from JS by <SystemBars/> in App.js, on
          // top of an edge-to-edge window. expo-navigation-bar must not also
          // configure them: its `position: "relative"` calls
          // setDecorFitsSystemWindows(true) from the activity lifecycle, which
          // insets the whole root view by the nav bar while edge-to-edge sets
          // it back to false, and whichever runs last wins. (The dead band at
          // the bottom of the screen was first blamed on this : it was not
          // the cause, see JobProgressModal.)
          [
            "react-native-edge-to-edge"
          ],
          // Android 16 ignores the landscape lock on screens >= 600dp (tablets,
          // foldables) : opts out, until API 37 drops the flag. See the plugin.
          "./plugins/withLandscapeOnLargeScreens",
          // Drops the dev client from the builds that ship (see the plugin) :
          // active only when eas.json sets SUNSCAN_EXCLUDE_DEV_CLIENT.
          "./plugins/withoutDevClientInRelease",
          ...(isIOS
            ? [
                [
                  "expo-media-library",
                  {
                    photosPermission: "Allow $(PRODUCT_NAME) to access your photos.",
                    savePhotosPermission: "Allow $(PRODUCT_NAME) to save photos.",
                    isAccessMediaLocationEnabled: false
                  }
                ]
              ]
            :  [
                [
                  "expo-media-library",
                  {
                    savePhotosPermission: "Allow $(PRODUCT_NAME) to save your sun images.",
                    isAccessMediaLocationEnabled: false
                  }
                ]
              ])
        ]
      }
    };
  };
  