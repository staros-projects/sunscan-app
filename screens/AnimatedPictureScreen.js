import React, { useCallback, useContext, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, TouchableHighlight, View, ScrollView, Switch, Alert, TextInput, SafeAreaView, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeWindStyleSheet } from "nativewind";
import Ionicons from '@expo/vector-icons/Ionicons'
import IconButton from '../components/IconButton';
import PressableScale from '../components/PressableScale';
import md5 from 'md5';

// Set up NativeWind for styling
NativeWindStyleSheet.setOutput({
  default: "native",
});

import { Image } from 'expo-image';
import AppContext from '../components/AppContext';
import WebSocketContext from '../utils/WSContext';
import useDetailActions from '../utils/useDetailActions';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';

import { useTranslation } from 'react-i18next';
import { Zoomable } from '@likashefqet/react-native-image-zoom';
import { downloadSunscanImage, itemDate, tagItem } from '../utils/Helpers';
import { linesDict } from '../components/LineSelector';
import ModalLineSelector from '../components/ModalLineSelector';

export default function AnimatedPictureScreen({  route, navigation }) {

  // Initialize translation hook
  const { t, i18n } = useTranslation();
  // State variables for managing the component
  const [currentImage, setcurrentImage] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [displayInfo, setDisplayInfo] = React.useState(false);
  const [displayProcessScan, setDisplayProcessScan] = React.useState(false);
  const [images, setImages] = React.useState([]);
  const myContext = useContext(AppContext);
  const scan = route.params?.scan

  // Format the scan date
  let options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  };
  let scanDate = itemDate(scan).toLocaleDateString("fr-FR", options);
  scanDate = scanDate.charAt(0).toUpperCase() + scanDate.slice(1);

  // Function to download the current image
  const download = async () => {
    setMessage(t('common:downloading')+'...');
    const success = await downloadSunscanImage(currentImage, 'gif');
    if (success) {
      setMessage(t('common:downloaded')+' !');
    } else {
      setMessage(t('common:downloadError'));
    }
    setTimeout(() => setMessage(''), 2000);
  }

  const [isStarted, setIsStarted] = useState(false);
  const [logs, setLogs] = useState("");
  const [fullScreenMode, setFullScreenMode] = useState(false);

  const [subscribe, unsubscribe] = useContext(WebSocketContext)

  // Effect to run when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setMessage('');
      if (scan) {
        setTag(scan.tag ?? '');
        setImages([]);
        const images  = [];
        scan.images.map((i) => {
            images.push("http://"+myContext.apiURL+"/"+i);
        })
        
        setImages(images.sort((a, b) => a.localeCompare(b)));
        setcurrentImage(images[0]);
      }
    }, [scan]));

  // Function to open the share dialog
  const openShareDialogAsync = async () => {

    const fileDetails = {
      extension: '.gif',
      shareOptions: {
        mimeType: 'image/gif',
        dialosTitle: 'Check out this sunscan image!',
        UTI: 'image/gif',
      },
    };

    const downloadPath = `${FileSystem.cacheDirectory}sunscan.gif`;
    const { uri: localUrl } = await FileSystem.downloadAsync(
      currentImage,
      downloadPath
    );
    if (!(await Sharing.isAvailableAsync())) {
      showMessage({
        message: 'Sharing is not available',
        description: 'Your device does not allow sharing',
        type: 'danger',
      });
      return;
    }
    await Sharing.shareAsync(localUrl, fileDetails.shareOptions);
  };

  // Styles for the component
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',

    },
    image: {
      flex: 1,
     
      backgroundColor: 'transparent',
    },
  });

  // Alert for confirming scan deletion
  const deleteButtonAlert = () =>
    Alert.alert(t('common:warning'), t('common:deleteStackedConfirm'), [
      {
        text: 'Annuler',
        style: 'cancel',
      },
      { text: 'OK', onPress: () => deleteScan() },
    ]);

  // Function to delete the scan
  async function deleteScan() {
    fetch('http://' + myContext.apiURL + "/sunscan/scan/delete/", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filename: scan.path }),
    }).then(response => response.json())
      .then(json => {
        navigation.navigate('List');

      })
      .catch(error => {
        console.error(error);
      });
  }
  const insets = useSafeAreaInsets();

  // Line of the animation, changed from the menu with the chip grid of a scan.
  // Empty on one made before the backend recorded it: the watermark of the
  // image usually tells the user which line it was.
  const [tag, setTag] = React.useState(scan?.tag ?? '');
  const [lineModalVisible, setLineModalVisible] = React.useState(false);
  const currentLine = tag ? linesDict.find(l => l.key === tag) : null;
  const tagThis = async (key) => {
    setLineModalVisible(false);
    if (await tagItem(myContext.apiURL, scan.path, key)) {
      setTag(key);
    }
  };
  const lineItem = myContext.sunscanIsConnected && { key: 'line', icon: 'pricetag-outline', color: currentLine?.color,
    label: currentLine?.short ? t('common:menuLine', { line: `${currentLine.short} · ${currentLine.wl}` }) : t('common:menuChooseLine'),
    onPress: () => setLineModalVisible(true) };

  // Secondary actions, grouped behind a "more" button like on a scan. No
  // SpectroSolHub upload for animations for now: GIFs were never tried on the
  // hub, and a refusal would leave an empty draft on the account.
  const menuItems = [
    lineItem,
    myContext.sunscanIsConnected && images.length > 0 && { key: 'download', icon: 'download-outline', label: t('common:download'), onPress: download },
    myContext.sunscanIsConnected && { key: 'delete', icon: 'trash-outline', label: t('common:delete'), destructive: true, onPress: deleteButtonAlert },
  ];
  const { moreButtonRef, openMenu } = useDetailActions({ items: menuItems, navigation });
  // Render the component
  return (
    scan &&
    <SafeAreaView className="bg-black"  style={{flex:1}}>
    <View className="flex flex-col bg-black">
        {/* Back button */}
        <View className="absolute left-0 z-50 p-4">
          <IconButton name="chevron-back" size={24} onPress={() => navigation.navigate('List')} />
        </View>
      
      {/* Message display */}
      {message &&
        <View className="absolute z-40 bottom-0 w-full " style={{ right: 0, top: 10 }}>
          <Text className="mx-auto text-white text-xs text-center">{message}</Text>
        </View>}
      <View className="h-full ">
        <SafeAreaProvider className="flex flex-col justify-between">
             <View className="flex flex-row" style={{zIndex:102, elevation:102, marginRight:insets.right}}>
              {/* Main image display */}
              <View className="w-5/6 h-screen " >

              {/* Action buttons */}
              <View className="absolute right-0 z-50" style={{height:'100%', marginRight:12, justifyContent:'center', alignItems:'center', gap:10}}>
                {myContext.sunscanIsConnected && images.length > 1 && <IconButton name="expand" onPress={() => myContext.setDisplayFullScreenImage(currentImage)} />}
                {/* Line, download and delete */}
                {menuItems.some(Boolean) && <View ref={moreButtonRef} collapsable={false}>
                  <IconButton name="ellipsis-horizontal" onPress={openMenu} />
                </View>}
              </View>

                    {/* Image zoom component */}
                    <Zoomable
                        isSingleTapEnabled
                        isDoubleTapEnabled
                      
                            >
                  <Image
                    style={styles.image}
                    source={currentImage}
                    transition={200}
                    contentFit='contain'
                  
                  />
                </Zoomable>
                 {/* Image name display */}
                 {/* <Text className="absolute z-50 bottom-0 text-white text-center mb-2 ml-2" style={{ fontSize: 10 }}>{currentImage[0]}</Text>  */}
              </View>
              {/* Thumbnail scrollview */}
               <View style={{ width:74 }} className="mx-auto bg-transparent align-center   text-center flex  " >
              <ScrollView >
                {images && images.map((i) => {
                  console.log(i)
                  return (
                    <View key={i}  className=" ">
                      <PressableScale scaleTo={0.92} onPress={() => setcurrentImage(i)}>
                        <View className="flex flex-col justify-center items-center z-10 overflow-hidden" style={currentImage == i ? {borderWidth:2, borderColor:'#ffffff', backgroundColor:'#000', borderRadius:12, marginTop:6} : {borderWidth:1, borderColor:'rgba(255,255,255,0.10)', backgroundColor:'#000', borderRadius:12, marginTop:6}}>
                          <Image
                            style={{ height: 70, width:70 }}
                            className="z-0"
                            source={i}
                            contentFit="contain"
                          />
                         
                        </View>


                      </PressableScale>
                    </View>)
                })

                }
                </ScrollView>


              </View>
            </View>


     



           



            {lineModalVisible && <ModalLineSelector
              visible={lineModalVisible}
              title={t('common:lineModalTitleAnimation')}
              message={t('common:lineModalMessageAnimation')}
              selected={tag}
              onSelect={tagThis}
              onSkip={() => setLineModalVisible(false)}
            />}

        </SafeAreaProvider>


      </View>

    </View>
</SafeAreaView>


  );


}




