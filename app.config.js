export default ({ config }) => {
    const isIOS = process.env.EXPO_OS === "ios"; // Détection de l'OS via une variable d'environnement
  
    return {
      ...config,
      expo: {
        name: "SUNSCAN",
        slug: "sunscan",
        version: "1.3.1",
        orientation: "landscape",
        icon: "./assets/icon.png",
        userInterfaceStyle: "dark",
        splash: {
          image: "./assets/splash.png",
          resizeMode: "contain",
          backgroundColor: "#000"
        },
        assetBundlePatterns: ["**/*"],
        ios: {
          buildNumber: "37",
          supportsTablet: true,
          requireFullScreen: true,
          bundleIdentifier: "com.staros.sunscan-app"
        },
        android: {
          versionCode: 37,
          adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#fff"
          },
          permissions: [
            "INTERNET",
            "RECEIVE_BOOT_COMPLETED",
            "ACCESS_NETWORK_STATE"
          ],
          blockedPermissions: [
            "android.permission.READ_MEDIA_IMAGES",
            "android.permission.READ_MEDIA_VIDEO"
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
                usesCleartextTraffic: true
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
            : [])
        ]
      }
    };
  };
  