import { View, StyleSheet, Pressable, Text, Button, Animated, Easing, Alert } from 'react-native';

import Loader from './Loader';
import Ionicons from '@expo/vector-icons/Ionicons'
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import AppContext from './AppContext';

import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import md5 from 'md5';
import { useTranslation } from 'react-i18next';



export default function Card({scan, callback}) {
  const { t, i18n } = useTranslation();


  const myContext = useContext(AppContext);

  const [isStarted, setIsStarted] = useState(false);
  const [scanStatus, setScanStatus] = useState(scan.status);
  const imgPreview = useRef(null);

  const navigation = useNavigation();


  const [subscribe, unsubscribe] = useContext(WebSocketContext)

  async function processScan() {
    //setIsStarted(true);
    console.log(scan.ser)
    fetch('http://'+myContext.apiURL+"/sunscan/scan/process/",  {
      method: "POST", 
      headers: {
        'Content-Type': 'application/json'
    },
      body: JSON.stringify({filename:scan.ser, autocrop:true, dopcont:false, autocrop_size:1000}),
    }).then(response => response.json())
    .then(json => {
      

     Image.clearMemoryCache();
     Image.clearDiskCache();
     setIsStarted(true);
     

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

  async function deleteScan() {
    fetch('http://'+myContext.apiURL+"/sunscan/scan/delete/",  {
      method: "POST", 
      headers: {
        'Content-Type': 'application/json'
    },
      body: JSON.stringify({filename:scan.path, autocrop:true, dopcont:false, autocrop_size:1300}),
    }).then(response => response.json())
    .then(json => {
      callback()
    })
    .catch(error => {
      console.error(error);
    });
  }

  const deleteButtonAlert = () =>
    Alert.alert('Attention', 'Etes vous certain de vouloir supprimer ce scan ?', [
      {
        text: 'Annuler',
        style: 'cancel',
      },
      {text: 'OK', onPress: () => deleteScan()},
  ]);

  let options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  };

  let scanDate = new Date(scan.creation_date*1000).toLocaleDateString(t('common:locale'), options);
  scanDate = scanDate.charAt(0).toUpperCase() + scanDate.slice(1);
  
  const squareSize = 200;
  const imgPath = "http://"+myContext.apiURL+"/"+scan.path+'/sunscan_preview.jpg?p='+encodeURI(scan.path);

  return (
      <View className="rounded-lg bg-black flex flex-col justify-center items-center" >
            <View style={{height:squareSize}}>
              { scanStatus == "completed" ? <Pressable style={{width:squareSize}} className="mx-auto rounded-lg grow flex items-center justify-center flex-none z-10"  onPress={() =>navigation.navigate('Picture',{scan:scan, forceImageDownload:true})}  ><View  sytle={{height:squareSize}}>
                <Image
                    style={{width:squareSize, height:squareSize}}
                    className=""
                    source={imgPath}
                    cacheKey={2}
                    ref={imgPreview}
                contentFit="contain"
                /></View></Pressable>:<View style={{width:squareSize}} className="mx-auto h-full grow flex items-center justify-center flex-none" >
                    {!isStarted ?<Pressable onPress={()=>processScan()} ><Ionicons name="play-circle" size={squareSize/4} color="lightgray" /></Pressable>:<Loader type="white" size={squareSize/4}/>}
                  </View>
                }
              </View>
            <View style={{height:50}} className="bg-zinc-900 w-full rounded-b-lg p-2 flex flex-row justify-between items-center">     
                <Text className="text-white font-bold text-xs">{scanDate}</Text>
                <Pressable  onPress={() =>navigation.navigate('Picture',{scan:scan, forceImageDownload:true})}  >
                  <Ionicons name="ellipsis-vertical" size={20} color="white" />
                </Pressable>
        
              </View>
          </View>

    
    
  );
}
