import React, { useCallback, useContext, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, TouchableHighlight, View, ScrollView, Switch, Alert, TextInput, SafeAreaView, Platform } from 'react-native';
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
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';

import { useTranslation } from 'react-i18next';
import { Zoomable } from '@likashefqet/react-native-image-zoom';
import { downloadSunscanImage } from '../utils/Helpers';

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
  let scanDate = new Date(scan?.creation_date * 1000).toLocaleDateString("fr-FR", options);
  scanDate = scanDate.charAt(0).toUpperCase() + scanDate.slice(1);

  const downloadAndroid = async () => {
    try {
      // Définir le chemin du fichier dans le répertoire de l'application
      const filename = `${FileSystem.documentDirectory}solar-image-${Date.now()}.jpg`;
  
      // Copier l'image vers ce répertoire
      await FileSystem.copyAsync({
        from: uri,
        to: filename,
      });
  
      console.log('Image saved at:', filename);
      return filename;
    } catch (error) {
      console.error('Error saving image:', error);
    }
  };

  // Function to download the current image
  const download = async () => {
    setMessage(t('common:downloading')+'...');
         const success =await downloadSunscanImage(currentImage, 'gif')
    
         if (success) {
           setMessage(t('common:downloaded')+' !');
         setTimeout(() => setMessage(''), 1500);
         }
         else {
           setMessage('');
         }
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

  // Render the component
  return (
    scan &&
    <SafeAreaView className="bg-black"  style={{flex:1}}>
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
              <View className="w-5/6 h-screen " >

              {/* Action buttons */}
              {myContext.sunscanIsConnected && <View className="absolute right-0 justify-center align-center h-screen z-50 flex space-y-4 flex-col">
                {images.length > 1 && <Pressable className="" onPress={() => myContext.setDisplayFullScreenImage(currentImage)}><Ionicons name="expand" size={28} color="white" /></Pressable>}  
                {images.length > 1 && <Pressable className="" onPress={() => download()}><Ionicons name="download" size={28} color="white" /></Pressable>}  
                <Pressable className="" onPress={deleteButtonAlert}><Ionicons name="trash" size={28} color="white" /></Pressable>
              </View>}

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
              <View style={{ width:95 }} className="p-2 mx-auto bg-black align-center justify-center text-center flex  " >
              <ScrollView >
                {images && images.map((i) => {
                  console.log(i)
                  return (
                    <View key={i}  className=" ">
                      <Pressable onPress={() => setcurrentImage(i)}>
                        <View className={currentImage == i ? "flex flex-col justify-center items-center z-10 border border-white mt-1 rounded-lg":" rounded-lg flex flex-col justify-center items-center z-10 border border-zinc-800 mt-1"}>
                          <Image
                            style={{ height: 70, width:70 }}
                            className="z-0 rounded-lg"
                            source={i}
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


     



           



        </SafeAreaProvider>


      </View>

    </View>
</SafeAreaView>


  );


}




