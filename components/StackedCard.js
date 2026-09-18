import { View, StyleSheet, Pressable, Text, Button, Animated, Easing, Alert } from 'react-native';

import Loader from './Loader';
import Ionicons from '@expo/vector-icons/Ionicons'
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import AppContext from './AppContext';
import WebSocketContext from '../utils/WSContext';

import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import md5 from 'md5';
import { useTranslation } from 'react-i18next';
import PressableScale from './PressableScale';

// Main Card component for displaying scan information
export default function StackedCard({squareSize, scan, selected, multiSelectMode,  onLongPress}) {
  const { t, i18n } = useTranslation();
  const myContext = useContext(AppContext);

  // State variables
  const [isStarted, setIsStarted] = useState(false);
  const imgPreview = useRef(null);

  const navigation = useNavigation();
  const [subscribe, unsubscribe] = useContext(WebSocketContext)

  
  // Date formatting options
  // No weekday and a short month: the label sits under a small thumbnail, and
  // the weekday repeated across every tile of the grid was noise rather than info.
  let options = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  };

  // Format the scan date
  let scanDate = new Date(scan.creation_date*1000).toLocaleDateString(t('common:locale'), options);
  scanDate = scanDate.charAt(0).toUpperCase() + scanDate.slice(1);
  

  const imgPath = "http://"+myContext.apiURL+"/"+scan.path+'/stacked_clahe_preview.jpg?p='+encodeURI(scan.path);

  // Render the Card component
  return (
      <View className="rounded-xl bg-black flex flex-col justify-center items-center" style={{borderWidth:selected ? 2 : 1, borderColor:selected ? '#10b981' : 'rgba(255,255,255,0.08)'}}>
           
            <View  className="mx-auto w-full overflow-hidden rounded-t-xl">
              <View className="absolute top-0 p-2 right-0 z-20">
                {selected ? <Ionicons name="checkmark-circle" size={30} color="#10b981" onPress={onLongPress} />:(multiSelectMode ? <Ionicons name="checkmark-circle-outline" size={30} color="rgba(255,255,255,0.75)" onPress={onLongPress} />:<View></View>)}</View>
                  <PressableScale scaleTo={0.96} style={{height:squareSize}} className="mx-auto w-full rounded-lg grow flex items-center justify-center flex-none z-10" onLongPress={onLongPress} onPress={() => multiSelectMode? onLongPress(scan.path) : navigation.navigate('StackedPicture',{scan:scan})}  >
                  {/* Stack count badge, on a dark pill so it stays readable over bright previews */}
                  <View className="absolute flex flex-row items-center space-x-1 z-20 rounded-full px-2 py-1" style={{top:6, left:6, backgroundColor:'rgba(0,0,0,0.55)'}}><Ionicons name="logo-stackoverflow" size={14} color="white" onPress={onLongPress} /><Text className="text-white" style={{fontSize:11}}>{scan.stacked_img_count}</Text></View>
                
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
                </PressableScale>

              </View>
            {/* Footer with date and options */}
            <View  className="bg-zinc-900 w-full rounded-b-xl py-2.5 flex flex-row items-center" style={{borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:'rgba(255,255,255,0.08)'}}>     
                <Pressable onLongPress={onLongPress} onPress={() => multiSelectMode ? onLongPress(scan.path) : navigation.navigate('StackedPicture',{scan:scan})} style={({pressed}) => [{width:'100%'}, pressed && {opacity:0.6}]}>
                  <Text  className="text-zinc-300 mx-auto" style={{fontSize:11}}>{scanDate}</Text>
                </Pressable>
              </View>
          </View>
  );
}
