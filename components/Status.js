import { View, Pressable, Text } from 'react-native';
import { useCallback, useContext, useEffect, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import PulseDot from './PulseDot';
import Loader from './Loader';
import AppContext from './AppContext';
import Ionicons from '@expo/vector-icons/Ionicons'
import Fontisto from '@expo/vector-icons/Fontisto'
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import firmareIsUpToDate, { setSunScanTime } from '../utils/Helpers';
import PressableScale from './PressableScale';
import FirmwareUpdateModal from './FirmwareUpdateModal';
import { colors, panelStyle, roundButton, warningChip, PANEL_WIDTH } from './theme';

// Below this, the panel nudges the user to clean up. ScanScreen keeps its own,
// harder limit (1.2 GB) where it actually refuses to start a scan.
const LOW_STORAGE_GB = 5;
// Offline mode has no device to query : show the warning with a plausible
// figure, so the state can be seen without waiting for a full SD card.
const DEMO_FREE = '3.4G';
// Tighter than the default round button : it sits beside a line of text
const REFRESH_BUTTON = { width: 24, height: 24, borderRadius: 12 };

// One fixed box for the connect / disconnect / loading states, wide enough to
// hold the longest translated label ("Déconnecter la caméra") on a single line,
// so the panel keeps the same shape whichever state it is in.
const CONNECT_BUTTON = { width: 186, height: 48 };

// The firmware offer comes up once per app session : the stats are read again
// on every focus, and "Later" must not bring it straight back.
let firmwareOffered = false;



export default function Status({isFocused})  {


  // Utility function to fetch with a timeout
  const fetchDataWithTimeout = async (url) => {
    try {
      // Timeout promise after 2 seconds
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), 2000)
      );

      // Fetch request promise
      const fetchPromise = fetch(url);
    
      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      // Check if fetch was successful and got response
      if (!response.ok) {
        myContext.setCamera("")
        myContext.setSunscanIsConnected(false);
        myContext.setCameraIsConnected(false); 

        throw new Error('Failed to fetch');
      }

      return await response.json();
    } catch (err) {
      myContext.setCamera("")
      myContext.setSunscanIsConnected(false);
      myContext.setCameraIsConnected(false); 
    } 
  };


  // Initialize translation hook
  const { t, i18n } = useTranslation();

  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [stats, setStats] = useState(null);
  // Outdated firmware detected : the offer shows once the splash is gone, not
  // behind it (the stats come back while the splash is still animating).
  const [firmwarePending, setFirmwarePending] = useState(false);
  const myContext = useContext(AppContext);

  // Refresh button spins while stats are being fetched.
  const spin = useSharedValue(0);
  useEffect(() => {
    if (refresh) {
      spin.value = 0;
      spin.value = withRepeat(withTiming(1, {duration: 800, easing: Easing.linear}), -1, false);
    } else {
      cancelAnimation(spin);
      // Finish the turn forward : winding back to 0 read as a rewind.
      spin.value = withTiming(Math.ceil(spin.value), {duration: 250, easing: Easing.out(Easing.cubic)});
    }
    return () => cancelAnimation(spin);
  }, [refresh]);
  // The rotation carries the round surface, not the glyph : an icon Text box is
  // taller than its glyph, so spinning it alone pivots off centre and wobbles.
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${spin.value * 360}deg`}],
  }));

  // Function to update camera status
  async function updateCamera(type) {
    setIsLoading(true);
    url = 'http://'+myContext.apiURL+"/camera/"+type
    fetch(url).then(response => response.json())
    .then(json => {
      myContext.setCameraIsConnected(json.camera_status == "connected")
      setIsLoading(false);
    })
    .catch(error => {
      console.error(error);
      setIsLoading(false);
    });
  }

  // Function to connect the camera
  async function connectCamera() {
    updateCamera(myContext.camera+"/connect")
    setSunScanTime(myContext.apiURL)
  }

  // Function to disconnect the camera
  async function disconnectCamera() {
    updateCamera("disconnect")
  }

  // Function to fetch and update stats
  async function getStats() {
    setRefresh(true);
    fetchDataWithTimeout('http://'+myContext.apiURL+"/sunscan/stats")
      .then(json => {
        if(json) {
          console.log(json)
          setStats(json);
          myContext.setFreeStorage(json.free_raw);
          myContext.setCamera(json.camera);
          myContext.setSunscanIsConnected(true);
          myContext.setBackendApiVersion(json.backend_api_version);
          getCameraStatus();
          checkFirmware(json.backend_api_version);
        }
      })
      .finally(() => setRefresh(false))

  }

  // Function to get camera status
  async function getCameraStatus() {
    fetch('http://'+myContext.apiURL+"/camera/status").then(response => response.json())
    .then(json => {
      myContext.setCameraIsConnected(json.camera_status == "connected")
    })
    .catch(error => {
      myContext.setCameraIsConnected(false)
      console.error(error);
    });
  }

  // Read from the answer itself : the context still holds the previous version
  // until the next render.
  const checkFirmware = (version) => {
    if(!firmwareOffered && !firmareIsUpToDate({ backendApiVersion: version })) {
      firmwareOffered = true;
      setFirmwarePending(true);
    }
  }

  // Effect to fetch stats when the component gains focus
  useFocusEffect(
    useCallback(() => {
        getStats();
  }, [isFocused, myContext.backendApiVersion, myContext.sunscanIsConnected]));

  // free_raw is a byte count, like the threshold ScanScreen uses
  const lowStorage = myContext.demo || (stats && parseFloat(stats.free_raw) / 1e9 < LOW_STORAGE_GB);
  // in demo the warning is forced, so the figure has to match it
  const freeLabel = myContext.demo ? DEMO_FREE : stats?.free;

  // Render the component
  return (
    <View className="rounded-2xl bg-zinc-700/80 px-4 py-3 flex flex-row space-x-4 items-center align-center" style={[panelStyle, { minWidth: PANEL_WIDTH }]}  >
      {/* Status information. Takes the slack of the panel so the connection
          button below pins to the right edge instead of floating wherever the
          longest line of text happens to end. */}
      <View className="flex-1">
        {/* SunScan status and refresh button */}
        <View className="flex flex-row space-x-1 items-center mb-1">
            <Pressable onPress={getStats}><Text className="text-white font-bold" style={{letterSpacing:1.5}}>SUNSCAN</Text></Pressable>
            <PressableScale onPress={getStats} hitSlop={10} scaleTo={0.88}>
              <Animated.View style={[roundButton, REFRESH_BUTTON, spinStyle]}>
                <Ionicons name="refresh-sharp" size={15} color="white" style={{ lineHeight: 15, includeFontPadding: false }} />
              </Animated.View>
            </PressableScale>
            {stats && myContext.sunscanIsConnected && <View className="mx-2 flex flex-row space-x-1 items-center">
              {!!stats?.battery_power_plugged && <Ionicons name="battery-charging" size={18} color="white" />}
              {!stats?.battery_power_plugged && stats?.battery < 10 && <Fontisto name="battery-empty" size={18} color="white"  />}
              {!stats?.battery_power_plugged && stats?.battery >= 10 && stats?.battery <45 && <Fontisto name="battery-quarter" size={18} color="white"  />}
              {!stats?.battery_power_plugged && stats?.battery >= 45 &&  stats?.battery <75 && <Fontisto name="battery-half" size={18} color="white"  />}
              {!stats?.battery_power_plugged && stats?.battery >= 75 &&  stats?.battery <85 && <Fontisto name="battery-three-quarters" size={18} color="white"  />}
              {!stats?.battery_power_plugged && stats?.battery >=85 && <Fontisto name="battery-full" size={18} color="white"  />}
              <Text className="text-white text-xs">{stats?.battery.toFixed(0)}%</Text>
             
              </View>}
              {/* Explicit gap: the pulse halo expands to ~1.9x the dot, so a tighter
                  spacing was eaten by it and the dot looked glued to the wifi icon. */}
              { myContext.sunscanIsConnected ? (<View className="flex flex-row items-center" style={{gap:14}}><Ionicons name="wifi" size={18} color="white"  /><PulseDot color="#10b981" pulsing /></View>):
                (<View className="flex flex-row items-center space-x-2"><PulseDot color="#ef4444" /></View>)}
               
            </View>
            {(stats || myContext.demo) && (lowStorage ? (
              <View className="mt-1 px-2 py-1 flex flex-col" style={[warningChip, { maxWidth: 260 }]}>
                <View className="flex flex-row items-center space-x-1">
                  <Ionicons name="warning-outline" size={13} color={colors.warning} />
                  <Text className="text-amber-300 text-xs font-bold">{t('common:storage')} : {freeLabel} {t('common:freeStorage')}</Text>
                </View>
                <Text className="text-amber-200/80 text-xs">{t('common:storageCleanupHint')}</Text>
              </View>
            ) : (
              <Text className="text-slate-400 text-xs">{t('common:storage')} : {stats?.free} {t('common:freeStorage')}</Text>
            ))}

            {myContext.debug && <Text className="text-slate-400 text-xs mt-1">{t('common:ipAddress')} : {myContext?.apiURL}</Text>}
            {myContext.debug && <Text className="text-slate-400 text-xs">{t('common:backendApiVersion')} : v{stats?.backend_api_version}</Text>}
          </View>

          {/* Camera connection button. The three states (loading, connect,
              disconnect) share one box so the panel does not reflow as the
              camera comes up, and the icon keeps one size across them. */}
          {(isLoading || !myContext.camera) &&
            <View className="bg-zinc-600 border border-white/10 rounded-xl px-3 flex flex-row justify-center items-center" style={CONNECT_BUTTON}>
              <Loader type="white" />
            </View>}
          {!!myContext.camera && !isLoading && (
            <PressableScale
              className="bg-zinc-600 border border-white/10 rounded-xl px-3 flex flex-row justify-center items-center"
              style={CONNECT_BUTTON}
              disabled={isLoading}
              onPress={myContext.cameraIsConnected ? disconnectCamera : connectCamera}>
              <Ionicons name="power" size={16} color="white" />
              <Text className="text-white text-xs ml-2" numberOfLines={1}>
                {t(myContext.cameraIsConnected ? 'common:disconnectCamera' : 'common:connectCamera')}
              </Text>
            </PressableScale>
          )}
          <FirmwareUpdateModal isVisible={firmwarePending && myContext.splashDone} onClose={() => setFirmwarePending(false)} />
    </View>
  );
}
