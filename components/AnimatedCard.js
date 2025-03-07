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
export default function AnimatedCard({squareSize, scan, selected, multiSelectMode,  onLongPress}) {
  const { t, i18n } = useTranslation();
  const myContext = useContext(AppContext);

  // State variables
  const [isStarted, setIsStarted] = useState(false);
  const imgPreview = useRef(null);

  const navigation = useNavigation();
  const [subscribe, unsubscribe] = useContext(WebSocketContext)

  
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
  
  const imgPath = "http://"+myContext.apiURL+"/"+scan.path+'/animated_preview.gif?p='+encodeURI(scan.path);

  // Render the Card component
  return (
      <View className="border-none border-white rounded-lg bg-black flex flex-col justify-center items-center" style={{borderWidth:selected ? 2 : 0}}>
           
            <View  className="mx-auto w-full">
              <View className="absolute top-0 p-2 right-0 z-20">
                {selected ? <Ionicons name="checkmark-circle" size={30} color="white" onPress={onLongPress} />:(multiSelectMode ? <Ionicons name="checkmark-circle-outline" size={30} color="rgb(55 65 81)" onPress={onLongPress} />:<></>)}</View>
                  <Pressable style={{height:squareSize}} className="mx-auto w-full rounded-lg grow flex items-center justify-center flex-none z-10" onLongPress={onLongPress} onPress={() => multiSelectMode? onLongPress(scan.path) : navigation.navigate('AnimatedPicture',{scan:scan})}  >

                
                  <View sytle={{height:squareSize}} className="w-full">
                    <Image
                        style={{width:'100%', height:'100%'}}
                        className=" rounded-t-lg "
                        source={imgPath}
                        cacheKey={2}
                        transition={200}
                        ref={imgPreview}
                        contentFit="cover"
                    />
                  </View>
                </Pressable>
               
              </View>
            {/* Footer with date and options */}
            <View  className="bg-zinc-900 w-full rounded-b-lg py-3 flex flex-row items-center">     
                <Pressable className="w-full" onLongPress={onLongPress} onPress={() => multiSelectMode ? onLongPress(scan.path) : navigation.navigate('StackedPicture',{scan:scan})}>
                  <Text  className="text-white text-xs mx-auto" style={{fontSize:10}}>{scanDate}</Text>
                </Pressable>
              </View>
          </View>
  );
}
