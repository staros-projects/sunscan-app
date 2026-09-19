export default ({ config }) => {
    const isIOS = process.env.EXPO_OS === "ios"; // Détection de l'OS via une variable d'environnement
  
    return {
      ...config,
      expo: {
        name: "SUNSCAN",
        slug: "sunscan",
        version: "2.1.2",
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
                buildToolsVersion: "36.0.0"
              }
            }
          ],
          [
            "expo-navigation-bar",
            {
              position: "relative",
              visibility: "hidden",
              behavior: "inset-swipe"
            }
          ],
          [
            "react-native-edge-to-edge"
          ],
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
  