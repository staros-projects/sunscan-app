import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {NavigationContainer} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativeWindStyleSheet } from "nativewind";
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';

import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';
import ListScreen from './screens/ListScreen';
import PictureScreen from './screens/PictureScreen';
import ScanScreen from './screens/ScanScreen';


NativeWindStyleSheet.setOutput({
  default: "native",
});

import {
  createNavigatorFactory,
} from '@react-navigation/native';
import TabNavigator from './components/TabNavigator';
import { OverlayProvider } from './components/OverlayHost';
import AppContext from './components/AppContext';
import WebSocketProvider  from './utils/WSProvider';
import { JobProgressProvider } from './utils/useJobProgress';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import './localization/i18n';
import i18next from 'i18next';
import Animated from 'react-native-reanimated';
import StackedPictureScreen from './screens/StackedPictureScreen';
import AnimatedPictureScreen from './screens/AnimatedPictureScreen';
import { HOTSPOT_API_URL } from './utils/SunscanNetwork';
import { useHubAccountState } from './utils/SpectroSolHub';
import AnimatedSplash from './components/AnimatedSplash';

// Keep the native splash up until AnimatedSplash is on screen to take over
SplashScreen.preventAutoHideAsync().catch(() => {});

// ...

const createMyNavigator = createNavigatorFactory(TabNavigator);
const My = createMyNavigator();

// URL of the SUNSCAN in hotspot mode (it creates its own wifi network). Fixed:
// the hotspot address never changes, and the wifi setup polls it directly.
const DEFAULT_HOTSPOT_API_URL = HOTSPOT_API_URL;
// Dev override (.env), e.g. a Pi on the home network. Only a default for the
// non-hotspot address: it used to replace the hotspot one, so hotspot mode
// kept targeting the dev Pi.
const DEV_API_URL = process.env.EXPO_PUBLIC_SUNSCAN_API_URL || '';

const STORAGE_KEYS = {
  language: 'SUNSCAN_APP::LANGUAGE',
  observer: 'SUNSCAN_APP::OBSERVER',
  dopplerColor: 'SUNSCAN_APP::DOPPLER_COLOR',
  processDoppler: 'SUNSCAN_APP::PROCESS_DOPPLER',
  location: 'SUNSCAN_APP::LOCATION',
  demo: 'SUNSCAN_APP::DEMO',
  tooltip: 'SUNSCAN_APP::TOOLTIP',
  debug: 'SUNSCAN_APP::DEBUG',
  watermark: 'SUNSCAN_APP::WATERMARK',
  autoStop: 'SUNSCAN_APP::AUTO_STOP',
  stackingOptions: 'SUNSCAN_APP::STACKING_OPTIONS',
  screenOrientation: 'SUNSCAN_APP::SCREEN_ORIENTATION',
  hotSpotMode: 'SUNSCAN_APP::HOTSPOT_MODE',
  customApiURL: 'SUNSCAN_APP::CUSTOM_API_URL',
  sunscanDevice: 'SUNSCAN_APP::SUNSCAN_DEVICE',
};

const DEFAULT_STACKING_OPTIONS = {patchSize:32, stepSize:10, intensityThreshold:0};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
});

Animated.addWhitelistedNativeProps({ text: true });

export default function App() {
  const [sunscanIsConnected, setSunscanIsConnected] = useState(false);
  const [cameraIsConnected, setCameraIsConnected] = useState(false);
  const [hotSpotModeVal, setHotSpotMode] = useState(true);
  const [customApiURLVal, setCustomApiURL] = useState("");
  // Identity of the SUNSCAN, read from /network/status: {id, lastIp}. The id
  // finds it again by mDNS once it has joined the home wifi, lastIp is the
  // address it last had there (fallback when mDNS finds nothing).
  const [sunscanDevice, setSunscanDevice] = useState({});
  const [showWatermark, setShowWatermark] = useState(true);
  const [autoStop, setAutoStop] = useState(true);
  const [debugVal, setDebug] = useState(false);
  const [demoVal, setDemo] = useState(false);
  const [tooltipVal, setTooltip] = useState(false);
  const [camera, setCamera] = useState("");
  const [observerVal, setObserver] = useState("");
  const [locationData, setLocationData] = useState({});
  const [backendApiVersion, setBackendApiVersion] = useState("");
  const [displayFullScreenImage, setDisplayFullScreenImage] = useState("");
  const [displayFullScreen3d, setDisplayFullScreen3d] = useState("");
  const [freeStorage, setFreeStorage] = useState(0);
  const [stackingOptions, setStackingOptions] = useState(DEFAULT_STACKING_OPTIONS);
  const [dopplerColor, setDopplerColor] = useState(1);
  const [processDoppler, setProcessDoppler] = useState(false);
  const [screenOrientationVal, setScreenOrientation] = useState('AUTO'); // Par défaut: Auto
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Effective API URL: hotspot mode uses the default SUNSCAN wifi address,
  // otherwise the user-defined IP (same network as the phone)
  const apiURLVal = hotSpotModeVal ? DEFAULT_HOTSPOT_API_URL : (customApiURLVal || DEV_API_URL || DEFAULT_HOTSPOT_API_URL);

  // SpectroSolHub account of the SUNSCAN, probed on every connection. The
  // feature stays hidden against a backend without the hub routes.
  const { hubSupported, hubAccount, setHubAccount, refreshHubAccount } = useHubAccountState(apiURLVal, sunscanIsConnected);

  const toggleShowWaterMark = useCallback(() => setShowWatermark(v => !v), []);
  const toggleAutoStop = useCallback(() => setAutoStop(v => !v), []);
  const toggleDemo = useCallback(() => setDemo(v => !v), []);
  const toggleTooltip = useCallback(() => setTooltip(v => !v), []);
  const toggleDebug = useCallback(() => setDebug(v => !v), []);

  // Gestion de l'orientation de l'écran
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        if (screenOrientationVal === 'AUTO') {
          // Mode auto : permet les deux orientations paysage
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else if (screenOrientationVal === 'LANDSCAPE_LEFT') {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        }
      } catch (error) {
        console.error('Error locking orientation:', error);
      }
    };
    lockOrientation();
  }, [screenOrientationVal]);

  // Load all persisted settings in a single storage round-trip
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const entries = await AsyncStorage.multiGet(Object.values(STORAGE_KEYS));
        const stored = Object.fromEntries(entries);

        const language = stored[STORAGE_KEYS.language];
        if (language) {
          i18next.changeLanguage(language);
        }
        const observer = stored[STORAGE_KEYS.observer];
        if (observer) {
          setObserver(observer);
        }
        const dopplerC = stored[STORAGE_KEYS.dopplerColor];
        if (dopplerC) {
          setDopplerColor(dopplerC);
        }
        const processD = stored[STORAGE_KEYS.processDoppler];
        if (processD) {
          setProcessDoppler(processD == '1');
        }
        const location = stored[STORAGE_KEYS.location];
        if (location) {
          setLocationData(JSON.parse(location));
        }
        const demo = stored[STORAGE_KEYS.demo];
        if (demo) {
          setDemo(demo == '1');
        }
        const tooltip = stored[STORAGE_KEYS.tooltip];
        if (tooltip) {
          setTooltip(tooltip == '1');
        }
        const debug = stored[STORAGE_KEYS.debug];
        if (debug) {
          setDebug(debug == '1');
        }
        const watermark = stored[STORAGE_KEYS.watermark];
        if (watermark) {
          setShowWatermark(watermark == '1');
        }
        const autoStopStored = stored[STORAGE_KEYS.autoStop];
        if (autoStopStored) {
          setAutoStop(autoStopStored == '1');
        }
        const stackingOpts = stored[STORAGE_KEYS.stackingOptions];
        if (stackingOpts) {
          setStackingOptions(JSON.parse(stackingOpts));
        }
        const orientation = stored[STORAGE_KEYS.screenOrientation];
        if (orientation) {
          setScreenOrientation(orientation);
        }
        const hotSpot = stored[STORAGE_KEYS.hotSpotMode];
        if (hotSpot) {
          setHotSpotMode(hotSpot == '1');
        }
        const customApiURL = stored[STORAGE_KEYS.customApiURL];
        if (customApiURL) {
          setCustomApiURL(customApiURL);
        }
        const device = stored[STORAGE_KEYS.sunscanDevice];
        if (device) {
          setSunscanDevice(JSON.parse(device));
        }
      } catch (e) {
        console.log('Error loading settings', e);
      }
      setSettingsLoaded(true);
    };
    loadSettings();
  }, []);

  // Persist settings in a single batched write (only once initial load is done,
  // to avoid overwriting stored values with defaults)
  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    const pairs = [
      [STORAGE_KEYS.location, JSON.stringify(locationData)],
      [STORAGE_KEYS.demo, demoVal?'1':'0'],
      [STORAGE_KEYS.tooltip, tooltipVal?'1':'0'],
      [STORAGE_KEYS.debug, debugVal?'1':'0'],
      [STORAGE_KEYS.watermark, showWatermark?'1':'0'],
      [STORAGE_KEYS.autoStop, autoStop?'1':'0'],
      [STORAGE_KEYS.stackingOptions, JSON.stringify(stackingOptions)],
      [STORAGE_KEYS.dopplerColor, `${dopplerColor}`],
      [STORAGE_KEYS.processDoppler, processDoppler?'1':'0'],
      [STORAGE_KEYS.screenOrientation, screenOrientationVal],
      [STORAGE_KEYS.hotSpotMode, hotSpotModeVal?'1':'0'],
      [STORAGE_KEYS.customApiURL, customApiURLVal],
      [STORAGE_KEYS.sunscanDevice, JSON.stringify(sunscanDevice)],
    ];
    if (observerVal !== "") {
      pairs.push([STORAGE_KEYS.observer, `${observerVal}`]);
    }
    AsyncStorage.multiSet(pairs).catch((e) => console.log('Error saving settings', e));
  }, [settingsLoaded, observerVal, hotSpotModeVal, customApiURLVal, sunscanDevice, showWatermark, autoStop, demoVal, debugVal, tooltipVal, locationData, dopplerColor, processDoppler, screenOrientationVal, stackingOptions]);

  // Pop-ins raised at start-up (firmware offer...) wait for the splash to be gone
  const [splashDone, setSplashDone] = useState(false);

  // Memoized so consumers only re-render when a value actually changes
  const userSettings = useMemo(() => ({
    sunscanIsConnected,
    setSunscanIsConnected,
    cameraIsConnected,
    setCameraIsConnected,
    camera,
    setCamera,
    demo:demoVal,
    debug:debugVal,
    tooltip:tooltipVal,
    hotSpotMode:hotSpotModeVal,
    setHotSpotMode,
    observer:observerVal,
    locationData,
    setLocationData,
    showWatermark:showWatermark,
    autoStop,
    dopplerColor,
    setDopplerColor,
    processDoppler,
    setProcessDoppler,
    backendApiVersion,
    setBackendApiVersion,
    setObserver,
    toggleShowWaterMark,
    toggleAutoStop,
    toggleDebug,
    toggleDemo,
    toggleTooltip,
    apiURL:apiURLVal,
    customApiURL:customApiURLVal,
    setCustomApiURL,
    sunscanDevice,
    setSunscanDevice,
    displayFullScreenImage,
    setDisplayFullScreenImage,
    displayFullScreen3d,
    setDisplayFullScreen3d,
    freeStorage,
    setFreeStorage,
    stackingOptions,
    setStackingOptions,
    screenOrientation: screenOrientationVal,
    setScreenOrientation,
    hubSupported,
    hubAccount,
    setHubAccount,
    refreshHubAccount,
    splashDone,
  }), [
    sunscanIsConnected, cameraIsConnected, camera, demoVal, debugVal, tooltipVal,
    hotSpotModeVal, observerVal, locationData, showWatermark, autoStop, dopplerColor,
    processDoppler, backendApiVersion, apiURLVal, customApiURLVal, sunscanDevice,
    displayFullScreenImage, displayFullScreen3d, freeStorage, stackingOptions,
    screenOrientationVal, toggleShowWaterMark, toggleAutoStop, toggleDebug, toggleDemo, toggleTooltip,
    hubSupported, hubAccount, refreshHubAccount, splashDone
  ]);

  return (
    <GestureHandlerRootView style={styles.container}>
    <AppContext.Provider value={userSettings}>
       <WebSocketProvider>
       <SafeAreaProvider>
       <JobProgressProvider>

        <OverlayProvider>
        <NavigationContainer>
            <My.Navigator
                screenOptions={{
                    headerShown: false,
                      }}>
              <My.Screen
                name="Home"
                component={HomeScreen}
              />
              <My.Screen
                name="Scan"
                component={ScanScreen}
              />
              <My.Screen
                name="List"
                component={ListScreen}
              />
              <My.Screen
                name="Picture"
                component={PictureScreen}
              />
                <My.Screen
                name="StackedPicture"
                component={StackedPictureScreen}
              />
               <My.Screen
                name="AnimatedPicture"
                component={AnimatedPictureScreen}
              />
              <My.Screen name="Settings" component={SettingsScreen} />
            </My.Navigator>
            <StatusBar hidden={true}  />
          </NavigationContainer>
          </OverlayProvider>
          </JobProgressProvider>
          </SafeAreaProvider>
       </WebSocketProvider>
    </AppContext.Provider>
    <AnimatedSplash ready={settingsLoaded} onDone={() => setSplashDone(true)} />
    </GestureHandlerRootView>
  );


}
