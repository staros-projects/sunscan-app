import React, { useCallback, useContext, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, TouchableHighlight, View, ScrollView, Switch, Alert, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativeWindStyleSheet } from "nativewind";
import Ionicons from '@expo/vector-icons/Ionicons';
import md5 from 'md5';

// Set up NativeWind for styling
NativeWindStyleSheet.setOutput({
  default: "native",
});

import { Image } from 'expo-image';
import AppContext from '../components/AppContext';
import ImageZoom from 'react-native-image-pan-zoom';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect } from '@react-navigation/native';
import ScanInfo from '../components/ScanInfo';
import ProcessScan from '../components/ProcessScan';
import { useTranslation } from 'react-i18next';

export default function PictureScreen({ route, navigation }) {

  // Initialize translation hook
  const { t, i18n } = useTranslation();
  // State variables for managing the component
  const [currentImage, setcurrentImage] = React.useState("");
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
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
    if (permissionResponse.status !== 'granted') {
      await requestPermission();
    }

    try {
      const downloadPath = `${FileSystem.cacheDirectory}sunscan.png`;
      const { uri: localUrl } = await FileSystem.downloadAsync(
        currentImage[1].replace('.jpg', '.png'),
        downloadPath
      );

      const asset = await MediaLibrary.createAssetAsync(downloadPath);

      const album = await MediaLibrary.getAlbumAsync('Download');
      if (album == null) {
        await MediaLibrary.createAlbumAsync('Download', asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        setMessage(t('common:downloaded')+' !');
        setTimeout(() => setMessage(''), 1500);
      }
    } catch (e) {
      handleError(e);
    }
  }

  const [isStarted, setIsStarted] = useState(false);
  const [dopcont, setDopCont] = useState(true);
  const [autocrop, setAutoCrop] = useState(true);
  const [scanStatus, setScanStatus] = useState(scan?.status);
  const [logs, setLogs] = useState("");


  const [subscribe, unsubscribe] = useContext(WebSocketContext)

  // Function to get images from the scan
  const getImages = (forceDownload) => {
    results = Object.entries(scan.images).map(([k, data]) => {
      if (data[1] || forceDownload) {
        console.log('load '+"http://" + myContext.apiURL + "/" + scan.path + "/sunscan_" + k + ".jpg"); 
        return [data[0], "http://" + myContext.apiURL + "/" + scan.path + "/sunscan_" + k + ".jpg"]
      }
      return null
    })
    return results.filter(element => element !== null)
  }

  // Function to process the scan
  async function processScan() {

    fetch('http://' + myContext.apiURL + "/sunscan/scan/process/", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filename: scan.ser, autocrop: autocrop, autocrop_size: 1200, dopcont: dopcont }),
    }).then(response => response.json())
      .then(json => {
        setIsStarted(true);


        key = md5(scan.ser);
        console.log('subscribe to ', 'scan_process_' + key)
        subscribe('scan_process_' + key, (message) => {
          setIsStarted(false);
          setDisplayProcessScan(false);
          setScanStatus(message[1])
          unsubscribe('scan_process_' + key);
          setImages([]);
          setImages(getImages(true));
        });
      })
      .catch(error => {
        console.error(error);
      });
  }


  // Effect to run when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setIsStarted(false);
      setImages([]);
      setcurrentImage([])
      if (scan) {
        const img = getImages(false);
        if (img.length) {
          setImages(img)
          setcurrentImage(img[0])
          getLogs();
        }
      }

    }, [scan]));

  // Function to open the share dialog
  const openShareDialogAsync = async () => {

    const fileDetails = {
      extension: '.png',
      shareOptions: {
        mimeType: 'image/png',
        dialosTitle: 'Check out this sunscan image!',
        UTI: 'image/png',
      },
    };

    const downloadPath = `${FileSystem.cacheDirectory}sunscan.png`;
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
      body: JSON.stringify({ filename: scan.path, autocrop: true, dopcont: false, autocrop_size: 1200 }),
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



  // Render the component
  return (
    scan &&
    <View className="flex flex-col bg-black">
        {/* Back button */}
        <View className="absolute left-0 z-50 p-4">
          <Pressable className="" onPress={() => navigation.navigate('List')}><Ionicons name="chevron-back" size={28} color="white" /></Pressable>
        </View>
      {/* Message display */}
      {message &&
        <View className="absolute z-40 bottom-0 w-full " style={{ right: 0, top: 10 }}>
          <Text className="mx-auto text-white text-xs text-center">{message}</Text>
        </View>}
      <View className="h-full ">
        <SafeAreaProvider className="flex flex-col justify-between">
            <View className="flex flex-row" >
              {/* Main image display */}
              <View className="w-5/6  " >

              {/* Action buttons */}
              {myContext.sunscanIsConnected && <View className="absolute right-0 justify-center align-center h-full z-50 flex space-y-4 flex-col">
                <Pressable className="" onPress={() => {setDisplayInfo(!displayInfo)}}><Ionicons name="information-circle-outline" size={28} color="white" /></Pressable>
                {images.length > 1 && <Pressable className="" onPress={() => {setDisplayProcessScan(!displayProcessScan)}}><Ionicons name="construct" size={28} color="white" /></Pressable>}
                {images.length > 1 && <Pressable className="" onPress={() => openShareDialogAsync()}><Ionicons name="share-social" size={28} color="white" /></Pressable>}
                {images.length > 1 && <Pressable className="" onPress={() => download()}><Ionicons name="download" size={28} color="white" /></Pressable>}  
                <Pressable className="" onPress={deleteButtonAlert}><Ionicons name="trash" size={28} color="white" /></Pressable>
              </View>}

                    {/* Image zoom component */}
                    <ImageZoom cropWidth={Dimensions.get('window').width-120}
                  cropHeight={Dimensions.get('window').height}
                  imageWidth={400}
                  imageHeight={400}>
                  <Image
                    style={styles.image}
                    source={currentImage[1]}
                    contentFit='contain'
                  />
                </ImageZoom>
                 {/* Image name display */}
                 <Text className="absolute z-50 bottom-0 text-white text-center mb-2 ml-2" style={{ fontSize: 10 }}>{currentImage[0]}</Text> 
              </View>
              {/* Thumbnail scrollview */}
              <View style={{ width:95 }} className="p-2 mx-auto bg-black align-center justify-center text-center flex  " >
              <ScrollView >
                {images && images.map((i) => {
                  return (
                    <View key={i[1]}  className=" ">
                      <Pressable onPress={() => setcurrentImage(i)}>
                        <View className={currentImage[1] == i[1] ? "flex flex-col justify-center items-center z-10 border border-white mt-1 rounded-lg":" rounded-lg flex flex-col justify-center items-center z-10 border border-zinc-800 mt-1"}>
                          <Image
                            style={{ height: 70, width:70 }}
                            className="z-0 rounded-lg"
                            source={i[1]}
                            contentFit="contain"
                          />
                         
                        </View>


                      </Pressable>
                    </View>)
                })

                }
                </ScrollView>


              </View>
            </View>


     

            {/* Process scan and scan info components */}
            <ProcessScan processMethod={processScan} isStarted={isStarted} setIsStarted={setIsStarted}  isVisible={displayProcessScan} onClose={()=>setDisplayProcessScan(false)} />
            <ScanInfo scan={scan} onClose={()=>setDisplayInfo(false)} logs={logs} currentImage={currentImage[0]} isVisible={displayInfo} />




           



        </SafeAreaProvider>


      </View>

    </View>



  );


}




