import { View, StyleSheet, Pressable, Text, Button, Animated, Easing, Alert } from 'react-native';

import Loader from './Loader';
import Ionicons from '@expo/vector-icons/Ionicons'
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import AppContext from './AppContext';

import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import md5 from 'md5';
import { useTranslation } from 'react-i18next';

// Main Card component for displaying scan information
export default function Card({scan}) {
  const { t, i18n } = useTranslation();
  const myContext = useContext(AppContext);

  // State variables
  const [isStarted, setIsStarted] = useState(false);
  const [scanStatus, setScanStatus] = useState(scan.status);
  const imgPreview = useRef(null);

  const navigation = useNavigation();
  const [subscribe, unsubscribe] = useContext(WebSocketContext)

  // Function to process the scan
  async function processScan() {
    console.log(scan.ser)
    fetch('http://'+myContext.apiURL+"/sunscan/scan/process/",  {
      method: "POST", 
      headers: {
        'Content-Type': 'application/json'
    },
      body: JSON.stringify({filename:scan.ser, 
        autocrop:true,
        autocrop_size:1100,
        dopcont:false,
         noisereduction:false,
          doppler_shift:5, 
          continuum_shift:15, 
          cont_sharpen_level:2, 
          surface_sharpen_level:2, 
          pro_sharpen_level:1,
          offset:0}),
    }).then(response => response.json())
    .then(json => {
      setIsStarted(true);
     
      // Subscribe to WebSocket for scan process updates
      key = md5(scan.ser);
      console.log('subscribe to ', 'scan_process_'+key)
      subscribe('scan_process_'+key, (message) => {
         setIsStarted(false);
         console.log(message)
         setScanStatus(message[1])
         unsubscribe('scan_process_'+key);
      });
    })
    .catch(error => {
      console.error(error);
      setIsStarted(false);
    });
  }

  // Date formatting options
  let options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  };

  // Format the scan date
  let scanDate = new Date(scan.creation_date*1000).toLocaleDateString(t('common:locale'), options);
  scanDate = scanDate.charAt(0).toUpperCase() + scanDate.slice(1);
  
  const squareSize = 200;
  const imgPath = "http://"+myContext.apiURL+"/"+scan.path+'/sunscan_preview.jpg?p='+encodeURI(scan.path);

  // Render the Card component
  return (
      <View className="rounded-lg bg-black flex flex-col justify-center items-center" >
            <View style={{height:squareSize}}>
              { scanStatus == "completed" ? 
                // Display completed scan image
                <Pressable style={{width:squareSize}} className="mx-auto rounded-lg grow flex items-center justify-center flex-none z-10"  onPress={() =>navigation.navigate('Picture',{scan:scan})}  >
                  <View  sytle={{height:squareSize}}>
                    <Image
                        style={{width:squareSize, height:squareSize}}
                        className=""
                        source={imgPath}
                        cacheKey={2}
                        ref={imgPreview}
                        contentFit="contain"
                    />
                  </View>
                </Pressable>
                :
                // Display play button or loader for processing
                <View style={{width:squareSize}} className="mx-auto h-full grow flex items-center justify-center flex-none" >
                    {!isStarted ?
                      <Pressable onPress={()=>processScan()} ><Ionicons name="play-circle" size={squareSize/4} color="lightgray" /></Pressable>
                      :
                      <Loader type="white" size={squareSize/4}/>
                    }
                  </View>
                }
              </View>
            {/* Footer with date and options */}
            <View style={{height:50}} className="bg-zinc-900 w-full rounded-b-lg p-2 flex flex-row justify-between items-center">     
                <Text className="text-white font-bold text-xs">{scanDate}</Text>
                <Pressable  onPress={() =>navigation.navigate('Picture',{scan:scan})}  >
                  <Ionicons name="ellipsis-vertical" size={20} color="white" />
                </Pressable>
              </View>
          </View>
  );
}
