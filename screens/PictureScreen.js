import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, TouchableHighlight, View, ScrollView, Switch, Alert, TextInput, SafeAreaView, useWindowDimensions } from 'react-native';
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

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';
import ScanInfo from '../components/ScanInfo';
import ProcessScan from '../components/ProcessScan';
import { useTranslation } from 'react-i18next';
import LineSelector from '../components/LineSelector';
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

  // Alert for confirming scan deletion
  const deleteButtonAlert = () =>
    Alert.alert(t('common:warning'), t('common:deleteConfirm'), [
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
                {myContext.sunscanIsConnected && <IconButton name="information-circle-outline" onPress={() => {setDisplayInfo(!displayInfo)}} />}
                {myContext.sunscanIsConnected && images.length > 1 && <IconButton name="expand" onPress={() => myContext.setDisplayFullScreenImage(currentImage[1])} />}
                {myContext.sunscanIsConnected && (images.length > 1 || myContext.debug) && <IconButton name="construct" onPress={() => {setDisplayProcessScan(!displayProcessScan)}} />}
                {myContext.sunscanIsConnected && images.length > 1 && <IconButton name="download" onPress={() => download()} />}
                {myContext.sunscanIsConnected && <IconButton name="trash" onPress={deleteButtonAlert} />}
                <LineSelector tag={tag} path={scan.path} />
              </View>

                {currentPlanisphere && <View className="absolute left-0 bottom-0 justify-end  m-4 align-center z-50 flex space-y-4 flex-col">
                  <IconButton IconSet={MaterialIcons} name="3d-rotation" size={26} onPress={() => myContext.setDisplayFullScreen3d(currentPlanisphere)} />
                </View>}
              
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
            <ProcessScan processMethod={processScan} isStarted={isStarted} percent={percent} step={step} errorKey={errorKey} isVisible={displayProcessScan} onClose={()=>setDisplayProcessScan(false)} />
            




           

            <ScanInfo scan={scan} onClose={()=>setDisplayInfo(false)} logs={logs} currentImage={currentImage[0]} isVisible={displayInfo} />

        </SafeAreaProvider>
       


      </View>

    </View>
</SafeAreaView>


  );


}




