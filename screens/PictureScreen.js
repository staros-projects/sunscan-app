import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, TouchableHighlight, View, ScrollView, Switch, Alert, TextInput, SafeAreaView, useWindowDimensions, Linking } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeWindStyleSheet } from "nativewind";
import Ionicons from '@expo/vector-icons/Ionicons'
import IconButton from '../components/IconButton';
import PressableScale from '../components/PressableScale';

// Set up NativeWind for styling
NativeWindStyleSheet.setOutput({
  default: "native",
});

import { Image } from 'expo-image';
import AppContext from '../components/AppContext';
import useScanProcess from '../utils/useScanProcess';
import { useHubUpload } from '../utils/SpectroSolHub';
import HubUploadModal from '../components/HubUploadModal';
import useDetailActions from '../utils/useDetailActions';

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';
import ScanInfo from '../components/ScanInfo';
import ProcessScan from '../components/ProcessScan';
import { useTranslation } from 'react-i18next';
import { linesDict } from '../components/LineSelector';
import ModalLineSelector from '../components/ModalLineSelector';
import { Zoomable } from '@likashefqet/react-native-image-zoom';
import { downloadSunscanImage } from '../utils/Helpers';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { set } from 'lodash';

export default function PictureScreen({ route, navigation }) {

  // Initialize translation hook
  const { t, i18n } = useTranslation();
  const { width, height } = useWindowDimensions();
  
  // State variables for managing the component
  const [currentImage, setcurrentImage] = React.useState("");
  const [openSettings, setOpenSettings] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [displayInfo, setDisplayInfo] = React.useState(false);
  const [displayProcessScan, setDisplayProcessScan] = React.useState(false);
  const [displayHubUpload, setDisplayHubUpload] = React.useState(false);
  // Last successful SpectroSolHub upload of this scan (null if never sent)
  const [hubInfo, setHubInfo] = React.useState(null);
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
  let scanDate = new Date(scan?.creation_date * 1000).toLocaleDateString("fr-FR", options);
  scanDate = scanDate.charAt(0).toUpperCase() + scanDate.slice(1);


  // Function to download the current image
  const download = async () => {
    setMessage(t('common:downloading')+'...');
    const success = await downloadSunscanImage(currentImage[1], 'jpeg');
    if (success) {
      setMessage(t('common:downloaded')+' !');
    } else {
      setMessage(t('common:downloadError'));
    }
    setTimeout(() => setMessage(''), 2000);
  }

  const [dopcont, setDopCont] = useState(true);
  const [autocrop, setAutoCrop] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState("");
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const [tag, setTag] = useState("");
  const [avalaiblePlanispheres, setAvalaiblePlanispheres] = useState([]);

  const { isStarted, percent, step, errorKey, startProcess, refreshStatus } = useScanProcess(scan, {
    onCompleted: () => {
      setDisplayProcessScan(false);
      getScanDetails(scan);
    },
  });

  // Owned here rather than by the panel, so closing it does not stop
  // following an upload, and the button can show one is running.
  const hubUpload = useHubUpload(scan, {
    onCompleted: () => getScanDetails(scan),
  });

  // Function to fetch scans from the API
  async function getScanDetails(scan) {
    
    setIsLoading(true);
    fetch('http://'+myContext.apiURL+"/sunscan/scan", {
      method: "POST", 
      headers: {
        'Content-Type': 'application/json'
    },
      body: JSON.stringify({filename:scan.ser}),
    }).then(response => response.json())
    .then(json => {
      setImages([]);
      setcurrentImage([]);
      setCurrentPlanisphere("");
      
      const img = getImages(json.images, false);
      if (img.length) {
        setImages(img);
        setAvalaiblePlanispheres(json.planispheres);
        setcurrentImage(img[0])
        getLogs();
      }

      setTag(json.tag)
      setHubInfo(json.spectrosolhub ?? null);

      setIsLoading(false);
    })
    .catch(error => {
      console.error(error);
      setIsLoading(false);
    });
  }

  // Function to get images from the scan
  const getImages = (images, forceDownload) => {
    const results = Object.entries(images).map(([k, data]) => {
      if (data[1] || forceDownload) {
        //console.log('load '+"http://" + myContext.apiURL + "/" + scan.path + "/sunscan_" + k + ".jpg?v="+data[2]); 
        return [data[0], "http://" + myContext.apiURL + "/" + scan.path + "/sunscan_" + k + ".jpg?v="+data[2]]
      }
      return null
    })
    return results.filter(element => element !== null)
  }

  // Function to process the scan
  function processScan(options) {
    const {
      dopplerShift,
      continuumShift,
      noiseReduction,
      continuumSharpenLevel,
      protusSharpenLevel,
      surfaceSharpenLevel,
      offset,
      advancedMode,
      dopplerColor,
      processDoppler
    } = options;

    startProcess({
      dopcont: true,
      autocrop: true,
      autocrop_size: 1100,
      noisereduction: noiseReduction,
      doppler_shift: dopplerShift,
      continuum_shift: continuumShift,
      cont_sharpen_level: continuumSharpenLevel,
      surface_sharpen_level: surfaceSharpenLevel,
      pro_sharpen_level: protusSharpenLevel,
      offset,
      observer: myContext.showWatermark ? myContext.observer : " ",
      advanced: advancedMode,
      doppler_color: dopplerColor,
      process_doppler: processDoppler
    });
  }



  // Effect to run when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setMessage('');
      setImages([]);
      setcurrentImage([]);
      if (scan) {
       getScanDetails(scan);
       // The screen may be opened while the box is already busy with this scan,
       // for instance after the app was killed: the websocket alone would only
       // tell us on its next reconnection.
       refreshStatus();
       // Same for an upload to SpectroSolHub still under way.
       hubUpload.resume();
      }

    }, [scan]));
    

  // Function to open the share dialog
  const openShareDialogAsync = async () => {

    const fileDetails = {
      extension: '.jpg',
      shareOptions: {
        mimeType: 'image/jpg',
        dialosTitle: 'Check out this sunscan image!',
        UTI: 'image/jpg',
      },
    };

    const downloadPath = `${FileSystem.cacheDirectory}sunscan.jpg`;
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

  // Hε sits in the red wing of Ca II H, and the backend extracts it while
  // processing a scan tagged caIIH. A scan tagged after it was processed only
  // gets its Hε images from a new run, so offer one rather than let the user
  // look for them.
  const onTagged = (newTag) => {
    const previousTag = tag;
    setTag(newTag);
    if (newTag !== 'caIIH' || previousTag === 'caIIH' || !images.length) return;
    Alert.alert(t('common:hepsilonReprocessTitle'), t('common:hepsilonReprocessMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('common:hepsilonReprocessAction'), onPress: () => setDisplayProcessScan(true) },
    ]);
  };

  // Alert for confirming scan deletion
  // A scan sent to the hub reads as "backed up", but only some of its JPEGs
  // went: the SER, the FITS and the 16 bit PNG are lost with it.
  const deleteButtonAlert = () =>
    Alert.alert(t('common:warning'), hubInfo ? t('common:hubDeleteSentConfirm') : t('common:deleteConfirm'), [
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

  // Function to get logs for the scan
  async function getLogs() {
    fetch('http://' + myContext.apiURL + "/" + scan.path + '/_scan_log.txt', {
      method: "GET",
      headers: {
        'Content-Type': 'application/txt'
      }
    }).then(response => response.text())
      .then(txt => {
        setLogs(txt)
      })
      .catch(error => {
        console.error(error);
      });
  }
  
  const insets = useSafeAreaInsets();

  const [currentPlanisphere, setCurrentPlanisphere] = useState(""); 

  // Line of the scan, changed from the menu. Tagging used to have its own
  // round button in the column; it now opens the same chip grid as the end of
  // a scan.
  const [lineModalVisible, setLineModalVisible] = useState(false);
  const currentLine = tag ? linesDict.find(l => l.key === tag) : null;
  const tagScan = (key) => {
    setLineModalVisible(false);
    fetch('http://' + myContext.apiURL + "/sunscan/scan/tag/", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: scan.path, tag: key }),
    }).then(response => response.json())
      .then(() => onTagged(key))
      .catch(error => console.error(error));
  };

  const menuItems = [
    { key: 'line', icon: 'pricetag-outline', color: currentLine?.color,
      label: currentLine?.short ? t('common:menuLine', { line: `${currentLine.short} · ${currentLine.wl}` }) : t('common:menuChooseLine'),
      onPress: () => setLineModalVisible(true) },
    !!currentPlanisphere && { key: '3d', icon: '3d-rotation', IconSet: MaterialIcons, label: t('common:menuView3d'), onPress: () => myContext.setDisplayFullScreen3d(currentPlanisphere) },
  ];
  // Everything else needs the SUNSCAN
  if (myContext.sunscanIsConnected) menuItems.push(
    { key: 'info', icon: 'information-circle-outline', label: t('common:scanDetails'), onPress: () => setDisplayInfo(true) },
    (images.length > 1 || myContext.debug) && { key: 'process', icon: 'construct-outline', label: t('common:advancedProcessing'), onPress: () => setDisplayProcessScan(true) },
    images.length > 1 && { key: 'download', icon: 'download-outline', label: t('common:download'), onPress: download },
    // The observation of the last successful upload, published or draft
    hubInfo?.url && { key: 'hub', icon: 'open-outline', label: t('common:hubViewOnHub'), color: '#10b981', onPress: () => Linking.openURL(hubInfo.url).catch(() => {}) },
    { key: 'delete', icon: 'trash-outline', label: t('common:delete'), destructive: true, onPress: deleteButtonAlert },
  );
  // Secondary actions, grouped behind a "more" button, and the cloud button
  const { moreButtonRef, openMenu, hubButtonRef, onHubPress, hubIcon } = useDetailActions({
    items: menuItems,
    hubUpload,
    hubInfo,
    onHubOpen: () => setDisplayHubUpload(true),
    navigation,
  });

  useEffect(() => {
    if (!currentImage || !currentImage.length) return;
    const currentImagePlanisphere = currentImage[1].replace('.jpg', '_proj.jpg');
    setCurrentPlanisphere("");
    if (scan?.planispheres.length == 0){
      avalaiblePlanispheres.forEach(planisphere => {
        if (currentImagePlanisphere.includes(planisphere)) {
          setCurrentPlanisphere(planisphere);
        }
      });
    }else {
      scan?.planispheres.forEach(planisphere => {
        if (currentImagePlanisphere.includes(planisphere)) {
          setCurrentPlanisphere(planisphere);
        }
      });
    }

  }, [,currentImage]);

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
       
            <View className="flex flex-row " style={{zIndex:102, elevation:102, marginRight:insets.right}}>
              {/* Main image display */}
              <View className="w-5/6" style={{ height: height }}>

              {/* Action buttons */}
              {/* The column itself always renders so the line tag stays reachable
                  offline; only the SUNSCAN-dependent actions are conditional.
                  Conditions are repeated per button rather than wrapped in a
                  fragment, which would break NativeWind's space-y-* spacing. */}
              <View className="absolute right-0 z-50" style={{height:'100%', marginRight:12, justifyContent:'center', alignItems:'center', gap:10}}>
                {myContext.sunscanIsConnected && images.length > 1 && <IconButton name="expand" onPress={() => myContext.setDisplayFullScreenImage(currentImage[1])} />}
                {myContext.sunscanIsConnected && myContext.hubSupported && images.length > 0 && <View ref={hubButtonRef} collapsable={false}>
                  <IconButton name={hubIcon.name} color={hubIcon.color} onPress={onHubPress} />
                </View>}
                {/* Line, 3D view, info, processing, download and delete. Shown
                    offline too: the line stays reachable, like its old button. */}
                <View ref={moreButtonRef} collapsable={false}>
                  <IconButton name="ellipsis-horizontal" onPress={openMenu} />
                </View>
              </View>

              
                    {/* Image zoom component */}
                    {/* key : remonte le Zoomable (et ses gesture handlers) au changement d'image et à l'ouverture/fermeture d'un overlay plein écran */}
                    <Zoomable
                    key={`${currentImage[1]}-${myContext.displayFullScreen3d === '' && myContext.displayFullScreenImage === ''}`}
                    isSingleTapEnabled
                    isDoubleTapEnabled
                  >
                  <Image
                    style={styles.image}
                    source={currentImage[1]}
                    transition={300}
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
                  return (
                    <View key={i[1]}  className=" ">
                      <PressableScale scaleTo={0.92} onPress={() => setcurrentImage(i)}>
                        <View className="flex flex-col justify-center items-center z-10 overflow-hidden" style={currentImage[1] == i[1] ? {borderWidth:2, borderColor:'#ffffff', backgroundColor:'#000', borderRadius:12, marginTop:6} : {borderWidth:1, borderColor:'rgba(255,255,255,0.10)', backgroundColor:'#000', borderRadius:12, marginTop:6}}>
                          <Image
                            style={{ height: 70, width:70 }}
                            className="z-0"
                            source={i[1]}
                            contentFit="contain"
                            transition={200}
                          />
                         
                        </View>


                      </PressableScale>
                    </View>)
                })

                }
                </ScrollView>


              </View>
            </View>


     

            {/* Process scan and scan info components */}
            {lineModalVisible && <ModalLineSelector
              visible={lineModalVisible}
              title={t('common:lineModalTitle')}
              message={t('common:lineModalMessage')}
              selected={tag}
              onSelect={tagScan}
              onSkip={() => setLineModalVisible(false)}
            />}

            <HubUploadModal
              scan={scan}
              upload={hubUpload}
              isVisible={displayHubUpload}
              onClose={() => {
                setDisplayHubUpload(false);
                // A success is recorded in the scan (green cloud); a failure
                // stays on screen until retried, with its draft link.
                if (hubUpload.status === 'completed') hubUpload.reset();
              }}
              onOpenWifiSettings={() => { setDisplayHubUpload(false); navigation.navigate('Settings'); }}
            />

            <ProcessScan processMethod={processScan} isStarted={isStarted} percent={percent} step={step} errorKey={errorKey} isVisible={displayProcessScan} onClose={()=>setDisplayProcessScan(false)} />
            




           

            <ScanInfo scan={scan} onClose={()=>setDisplayInfo(false)} logs={logs} currentImage={currentImage[0]} isVisible={displayInfo} />

        </SafeAreaProvider>
       


      </View>

    </View>
</SafeAreaView>


  );


}




