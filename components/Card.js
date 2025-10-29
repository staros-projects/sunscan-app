import { View, StyleSheet, Pressable, Text, Button, Animated, Easing, Alert } from 'react-native';

import Loader from './Loader';
import Ionicons from '@expo/vector-icons/Ionicons'
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import AppContext from './AppContext';

import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import md5 from 'md5';
import { useTranslation } from 'react-i18next';
import { linesDict } from './LineSelector';

// Main Card component for displaying scan information
export default function Card({squareSize, scan, selected, multiSelectMode, onLongPress}) {
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
          continuum_shift:16, 
          cont_sharpen_level:2, 
          surface_sharpen_level:2, 
          pro_sharpen_level:1,
          offset:0,
          observer:myContext.showWatermark?myContext.observer:' ',
          advanced:scan.tag,
          doppler_color:myContext.dopplerColor,
          process_doppler:false
      }),
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
  
  const imgPath = "http://"+myContext.apiURL+"/"+scan.path+'/sunscan_preview.jpg?p='+encodeURI(scan.path);

  // Render the Card component
  return (
      <View className="border-none border-white rounded-lg bg-black flex flex-col justify-center items-center" style={{borderWidth:selected ? 2 : 0}}>
           
            <View  className="mx-auto w-full">
              <View className="absolute top-0 p-2 right-0 z-20">
                {selected ? <Ionicons name="checkmark-circle" size={30} color="white" onPress={onLongPress} />:(multiSelectMode ? <Ionicons name="checkmark-circle-outline" size={30} color="rgb(55 65 81)" onPress={onLongPress} />:<View></View>)}</View>
              { scanStatus == "completed" ? 
                // Display completed scan image
                  <Pressable style={{height:squareSize}} className="mx-auto w-full rounded-lg grow flex items-center justify-center flex-none z-10" onLongPress={onLongPress} onPress={() => multiSelectMode? onLongPress(scan.ser) : navigation.navigate('Picture',{scan:scan})}  >
                  <View sytle={{height:squareSize}} className="w-full">
                    <Image
                        style={{width:'100%', height:'100%'}}
                        className="rounded-t-lg w-full "
                        source={imgPath}
                        cacheKey={2}
                        ref={imgPreview}
                        contentFit="cover"
                        transition={200}
                    />
                  </View>
                </Pressable>
                :
                // Display play button or loader for processing
                <Pressable onLongPress={onLongPress} onPress={()=>multiSelectMode ? onLongPress(scan.ser) : processScan()} >
                  <View style={{width:squareSize, height:squareSize}} className="mx-auto h-full grow flex items-center justify-center flex-none" >
                      {!isStarted ?
                      <Ionicons name="play-circle" size={squareSize/4} color="lightgray" />
                        :
                        <Loader type="white" size={squareSize/4}/>
                      }
                    </View>
                  </Pressable>
                }
              </View>
            {/* Footer with date and options */}
            <View  className="bg-zinc-900 w-full rounded-b-lg py-3 flex flex-row items-center">     
                <Pressable className="w-full" onLongPress={onLongPress} onPress={() => multiSelectMode ? onLongPress(scan.ser) : navigation.navigate('Picture',{scan:scan})}>
                  <Text  className="text-white mx-auto" style={{fontSize:10}}>{scanDate}</Text>
                </Pressable>
              </View>
              {scan.tag && <View className="absolute z-40" style={{top:-8, left:0}}>
                <Ionicons name="bookmark-sharp" size={linesDict.find(item => item.key === scan.tag).short.length > 3 ? 50:35}  color={linesDict.find(item => item.key === scan.tag).color} />
                <View className="absolute z-40 flex flex-row items-center justify-center w-full h-full" style={{top:-5, left:0}}>
                <Text className="text-white text-xs mx-auto" style={{fontSize:9}}>{linesDict.find(item => item.key === scan.tag).short}</Text>
                </View>
              </View>}
          </View>
  );
}
