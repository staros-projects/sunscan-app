import { View, StyleSheet, Pressable, Text, Button, Animated, Easing, Alert, Linking } from 'react-native';

import SunscanLoader from './SunscanLoader';
import Ionicons from '@expo/vector-icons/Ionicons'
import { useContext, useRef } from 'react';
import AppContext from './AppContext';

import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import PressableScale from './PressableScale';
import ProcessingSteps from './ProcessingSteps';
import { linesDict } from './LineSelector';
import useScanProcess, { errorTranslationKey } from '../utils/useScanProcess';

// Radius of the card, shared by the clip and the frame drawn over it.
const CARD_RADIUS = 12;

// Main Card component for displaying scan information
export default function Card({squareSize, scan, selected, multiSelectMode, onLongPress}) {
  const { t, i18n } = useTranslation();
  const myContext = useContext(AppContext);

  const imgPreview = useRef(null);

  const navigation = useNavigation();

  // Subscribed from the moment the card is mounted, so a run started elsewhere
  // -- from the picture screen, or before the app was backgrounded -- shows up
  // here on its own.
  const { isStarted, percent, step, errorKey, scanStatus, startProcess } = useScanProcess(scan);

  // Function to process the scan
  function processScan() {
    startProcess({
      autocrop: true,
      autocrop_size: 1100,
      dopcont: false,
      noisereduction: false,
      doppler_shift: 5,
      continuum_shift: 16,
      cont_sharpen_level: 2,
      surface_sharpen_level: 2,
      pro_sharpen_level: 1,
      offset: 0,
      observer: myContext.showWatermark ? myContext.observer : ' ',
      advanced: scan.tag,
      doppler_color: myContext.dopplerColor,
      process_doppler: false,
    });
  }

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
  
  const imgPath = "http://"+myContext.apiURL+"/"+scan.path+'/sunscan_preview.jpg?p='+encodeURI(scan.path);

  // Resolved once, and tolerant of a tag that is not in the dictionary
  const line = scan.tag ? linesDict.find(item => item.key === scan.tag) : null;

  // Render the Card component
  return (
      <View className="bg-black flex flex-col justify-center items-center" style={{borderRadius:CARD_RADIUS, overflow:'hidden'}}>

            <View  className="mx-auto w-full">
              <View className="absolute top-0 p-2 right-0 z-20">
                {selected ? <Ionicons name="checkmark-circle" size={30} color="#10b981" onPress={onLongPress} />:(multiSelectMode ? <Ionicons name="checkmark-circle-outline" size={30} color="rgba(255,255,255,0.75)" onPress={onLongPress} />:<View></View>)}</View>
              { scanStatus == "completed" ? 
                // Display completed scan image
                  <PressableScale scaleTo={0.96} style={{height:squareSize}} className="mx-auto w-full rounded-lg grow flex items-center justify-center flex-none z-10" onLongPress={onLongPress} onPress={() => multiSelectMode? onLongPress(scan.ser) : navigation.navigate('Picture',{scan:scan})}  >
                  <View sytle={{height:squareSize}} className="w-full">
                    <Image
                        style={{width:'100%', height:'100%'}}
                        className="w-full"
                        source={imgPath}
                        cacheKey={2}
                        ref={imgPreview}
                        contentFit="cover"
                        transition={200}
                    />
                  </View>
                </PressableScale>
                :
                // Display play button or loader for processing
                <PressableScale scaleTo={0.92} onLongPress={onLongPress} onPress={()=>multiSelectMode ? onLongPress(scan.ser) : processScan()} >
                  <View style={{width:squareSize, height:squareSize}} className="mx-auto h-full grow flex items-center justify-center flex-none" >
                      {!isStarted ?
                      <View className="flex flex-col items-center">
                        <Ionicons name="play-circle" size={squareSize/4} color="lightgray" />
                        {/* Why the last run produced nothing, rather than a play
                            button that looks like it was never pressed. */}
                        {scanStatus === 'failed' && errorKey !== null ? (
                          <Text numberOfLines={2} className="text-amber-500 text-center px-2" style={{fontSize:9, marginTop:6}}>
                            {t(errorTranslationKey(errorKey))}
                          </Text>
                        ) : null}
                      </View>
                        :
                        <View style={{width:'100%', paddingHorizontal:8, alignItems:'center'}}>
                          {/* Le logo pulse de gauche a droite : il dit "ca tourne"
                              meme a 0 %, la ou la barre est encore immobile. */}
                          <SunscanLoader size={squareSize*0.3} />
                          <ProcessingSteps compact percent={percent} step={step} />
                        </View>
                      }
                    </View>
                  </PressableScale>
                }
              </View>
            {/* Footer with date and options */}
            <View  className="bg-zinc-900 w-full py-2.5 flex flex-row items-center" style={{borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:'rgba(255,255,255,0.08)'}}>
                <Pressable onLongPress={onLongPress} onPress={() => multiSelectMode ? onLongPress(scan.ser) : navigation.navigate('Picture',{scan:scan})} style={({pressed}) => [{width:'100%'}, pressed && {opacity:0.6}]}>
                  <Text  className="text-zinc-300 mx-auto" style={{fontSize:11}}>{scanDate}</Text>
                </Pressable>
                {/* Sent to SpectroSolHub: the last upload of this scan succeeded.
                    Green once published, grey for a draft (as it was at upload
                    time: a draft published later from the site stays grey).
                    A tap opens the observation. */}
                {scan.hub_status === 'sent' ? (
                  <Pressable
                    hitSlop={10}
                    disabled={multiSelectMode || !scan.spectrosolhub?.url}
                    onPress={() => Linking.openURL(scan.spectrosolhub.url).catch(() => {})}
                    style={{position:'absolute', right:8}}>
                    <Ionicons
                      name={scan.spectrosolhub?.published === false ? 'cloud-outline' : 'cloud-done-outline'}
                      size={14}
                      color={scan.spectrosolhub?.published === false ? '#a1a1aa' : '#10b981'} />
                  </Pressable>
                ) : null}
              </View>
              {/* Spectral line badge: a small colour-coded pill inside the frame.
                  It used to be a 35-50px bookmark hanging off the top edge, which
                  shouted louder than the image it was labelling. */}
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
