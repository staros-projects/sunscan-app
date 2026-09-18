import { useContext, useState } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import AppContext from './AppContext';
import Loader from './Loader';
import PressableScale from './PressableScale';
import { setSunScanTime } from '../utils/Helpers';
import { toolbarSurface } from './theme';

/**
 * Shown in place of the camera feed when the camera is not connected.
 *
 * The scan screen used to sit on an endless spinner in that state, and the only
 * way out was to go back to the home screen : the connection is offered here.
 * When no camera has been detected at all there is nothing to connect to, so
 * only the message shows.
 */
export default function ConnectCameraPanel() {
  const { t } = useTranslation();
  const myContext = useContext(AppContext);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('http://' + myContext.apiURL + '/camera/' + myContext.camera + '/connect');
      const json = await response.json();
      myContext.setCameraIsConnected(json.camera_status == 'connected');
      setSunScanTime(myContext.apiURL);
    } catch (error) {
      console.error(error);
      myContext.setCameraIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <View className="mx-auto items-center px-6 py-5" style={[toolbarSurface, { gap: 12 }]}>
      <Ionicons name="videocam-off-outline" size={26} color="#94a3b8" />
      <Text className="text-slate-300 text-sm">{t('common:cameraNotConnected')}</Text>
      {!!myContext.camera && (
        <PressableScale
          className="bg-zinc-600 border border-white/10 rounded-xl px-4 flex flex-row justify-center items-center"
          style={{ height: 44, minWidth: 186 }}
          disabled={isConnecting}
          onPress={connect}>
          {isConnecting ? (
            <Loader type="white" />
          ) : (
            <>
              <Ionicons name="power" size={16} color="white" />
              <Text className="text-white text-xs ml-2" numberOfLines={1}>{t('common:connectCamera')}</Text>
            </>
          )}
        </PressableScale>
      )}
    </View>
  );
}
