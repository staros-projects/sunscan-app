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
import { linesDict } from './LineSelector';
import { itemDate } from '../utils/Helpers';

// Radius of the card, shared by the clip and the frame drawn over it.
const CARD_RADIUS = 12;

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
  let scanDate = itemDate(scan).toLocaleDateString(t('common:locale'), options);
  scanDate = scanDate.charAt(0).toUpperCase() + scanDate.slice(1);
  
  const imgPath = "http://"+myContext.apiURL+"/"+scan.path+'/animated_preview.gif?p='+encodeURI(scan.path);

  // Line of the animation, as on a scan card. Empty on an animation made
  // before the backend recorded it, or from untagged scans.
  const line = scan.tag ? linesDict.find(item => item.key === scan.tag) : null;

  // Render the Card component
  return (
      <View className="bg-black flex flex-col justify-center items-center" style={{borderRadius:CARD_RADIUS, overflow:'hidden'}}>
           
            <View  className="mx-auto w-full">
              <View className="absolute top-0 p-2 right-0 z-20">
                {selected ? <Ionicons name="checkmark-circle" size={30} color="#10b981" onPress={onLongPress} />:(multiSelectMode ? <Ionicons name="checkmark-circle-outline" size={30} color="rgba(255,255,255,0.75)" onPress={onLongPress} />:<View></View>)}</View>
                  <PressableScale scaleTo={0.96} style={{height:squareSize}} className="mx-auto w-full rounded-lg grow flex items-center justify-center flex-none z-10" onLongPress={onLongPress} onPress={() => multiSelectMode? onLongPress(scan.path) : navigation.navigate('AnimatedPicture',{scan:scan})}  >

                
                  <View sytle={{height:squareSize}} className="w-full">
                    <Image
                        style={{width:'100%', height:'100%'}}
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
            <View  className="bg-zinc-900 w-full py-2.5 flex flex-row items-center" style={{borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:'rgba(255,255,255,0.08)'}}>     
                <Pressable onLongPress={onLongPress} onPress={() => multiSelectMode ? onLongPress(scan.path) : navigation.navigate('AnimatedPicture',{scan:scan})} style={({pressed}) => [{width:'100%'}, pressed && {opacity:0.6}]}>
                  <Text  className="text-zinc-300 mx-auto" style={{fontSize:11}}>{scanDate}</Text>
                </Pressable>
              </View>
              {line?.short ? (
                <View className="absolute z-40 rounded-full px-2 py-0.5" style={{top:6, left:6, backgroundColor:line.color}}>
                  <Text className="text-white" style={{fontSize:10, fontWeight:'600'}}>{line.short}</Text>
                </View>
              ) : null}
              {/* Frame drawn over the content rather than as the card's own
                  border: the card clips everything to one radius, and the frame
                  follows that exact curve. A border on the card left the image
                  corners, rounded with their own radius inside it, visibly off
                  the green ring, and its width change shifted the layout. */}
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, {zIndex:50, borderRadius:CARD_RADIUS, borderWidth:selected ? 2 : 1, borderColor:selected ? '#10b981' : 'rgba(255,255,255,0.08)'}]} />
          </View>
  );
}
