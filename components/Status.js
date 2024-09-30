import { View, Pressable, Text, Alert } from 'react-native';
import { useCallback, useContext, useState } from 'react';
import Loader from './Loader';
import AppContext from './AppContext';
import Ionicons from '@expo/vector-icons/Ionicons'
import Fontisto from '@expo/vector-icons/Fontisto'
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';



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
  const myContext = useContext(AppContext);
  
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
    setSunScanTime()
  }

  // Function to disconnect the camera
  async function disconnectCamera() {
    updateCamera("disconnect")
  }

  // Function to fetch and update stats
  async function getStats() {
    fetchDataWithTimeout('http://'+myContext.apiURL+"/sunscan/stats")
      .then(json => {
        if(json) {
          console.log(json)
          setStats(json)
          myContext.setCamera(json.camera)
          myContext.setSunscanIsConnected(true);
          myContext.setBackendApiVersion(json.backend_api_version);
          getCameraStatus();
        }
      })

  }

  // Function to set SunScan time
  async function setSunScanTime() {
    const current_ts = Math.floor(Date.now() / 1000);
    fetch('http://'+myContext.apiURL+"/sunscan/set-time/",  {
      method: "POST", 
      headers: {
        'Content-Type': 'application/json'
    },
      body: JSON.stringify({unixtime:current_ts.toString()}),
    }).then(response => response.json())
    .then(json => {
      console.log('set time ok ', current_ts)
    })
    .catch(error => {
      console.error(error);
    });
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

  // Effect to fetch stats when the component gains focus
  useFocusEffect(
    useCallback(() => {
        getStats();
  }, [isFocused]));

  // Render the component
  return (
    <View className="rounded-lg bg-zinc-700/80 p-4 flex flex-row space-x-4 items-center align-center"  >
      {/* Status information */}
      <View className="">
        {/* SunScan status and refresh button */}
        <View className="flex flex-row space-x-1 items-center mb-1">
            <Pressable onPress={getStats}><Text className="text-white font-bold ">SUNSCAN</Text></Pressable>
            <Pressable onPress={getStats}>{refresh ? <Ionicons name="ellipsis-horizontal" size={14} color="white" />:<Ionicons name="refresh-sharp" size={14} color="white" />}</Pressable> 
            {stats && myContext.sunscanIsConnected && <View className="mx-2 flex flex-row space-x-1 items-center">
              {stats?.battery_power_plugged && <Ionicons name="battery-charging" size={18} color="white" />}
              {!stats?.battery_power_plugged && stats?.battery < 10 && <Fontisto name="battery-empty" size={18} color="white"  />}
              {!stats?.battery_power_plugged && stats?.battery >= 10 && stats?.battery <45 && <Fontisto name="battery-quarter" size={18} color="white"  />}
              {!stats?.battery_power_plugged && stats?.battery >= 45 &&  stats?.battery <75 && <Fontisto name="battery-half" size={18} color="white"  />}
              {!stats?.battery_power_plugged && stats?.battery >= 75 &&  stats?.battery <85 && <Fontisto name="battery-three-quarters" size={18} color="white"  />}
              {!stats?.battery_power_plugged && stats?.battery >=85 && <Fontisto name="battery-full" size={18} color="white"  />}
              <Text className="text-white text-xs">{stats?.battery.toFixed(0)}%</Text>
             
              </View>}
              { myContext.sunscanIsConnected ? (<View className="flex flex-row space-x-2 items-center"><Ionicons name="wifi" size={18} color="white"  /><View className="bg-emerald-600 h-3 w-3 rounded-full  text-xs text-white text-center"></View></View>): 
                (<View className="flex flex-row items-center space-x-2"><View className="bg-red-600  rounded-full  h-3 w-3 text-xs text-white text-center"></View></View>)}
               
            </View>
            <Text className="text-slate-400 text-xs">{t('common:storage')} : {stats?.used}/{stats?.total} {t('common:usedStorage')}</Text>

            {myContext.debug && <Text className="text-slate-400 text-xs mt-1">{t('common:ipAddress')} : {myContext?.apiURL}</Text>}
            {myContext.debug && <Text className="text-slate-400 text-xs">{t('common:backendApiVersion')} : v{stats?.backend_api_version}</Text>}
          </View>

          {/* Camera connection button */}
          {(isLoading || !myContext.camera)  && <View className="bg-zinc-600 p-2 rounded-md h-12 text-white text-center flex justify-center items-center" ><Loader type="white" /></View>}
          {myContext.camera && !isLoading ? (!myContext.cameraIsConnected ? 
          (<Pressable className="bg-zinc-600 p-2 rounded-md h-12 text-white text-center flex flex-row items-center space-x-2" disabled={isLoading} onPress={connectCamera} ><Ionicons name="power" size={14} color="white"  /><Text className="mx-auto text-white text-xs ">{t('common:connectCamera')}</Text></Pressable>) :
          (<Pressable className="bg-zinc-600 p-2 rounded-md h-12 text-white text-center flex flex-row items-center space-x-2" disabled={isLoading} onPress={disconnectCamera} ><Ionicons name="power" size={18} color="white"  /><Text className="mx-auto text-white text-xs">{t('common:disconnectCamera')}</Text></Pressable>)):('')}
    </View>
  );
}
