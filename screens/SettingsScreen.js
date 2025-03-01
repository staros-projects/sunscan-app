
import React, { useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';
import {  Alert, Button, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons'

import { NativeWindStyleSheet } from "nativewind";

import * as Application from 'expo-application';
import AppContext from '../components/AppContext';

import { useAssets } from 'expo-asset';
import { useTranslation } from 'react-i18next';
import { t, use } from 'i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import firmareIsUpToDate from '../utils/Helpers';
import { backend_current_version } from '../utils/Helpers';

NativeWindStyleSheet.setOutput({
  default: "native",
});

// Define available languages
const languages = [ // Language List
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

export default function SettingsScreen({navigation, isFocused}) {

  // Get the global variables & functions via context
  const myContext = useContext(AppContext);
  const [apiInput, setAPIInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cacheIsCleared, setCacheIsCleared] = useState(false);
  const [sunscanIsShutdown, setSunscanIsShutdown] = useState(false);
  const [sunscanIsReboot, setSunscanIsReboot] = useState(false);


  // Load the firmware update ZIP file from assets
  const [assetZipPath, error] = useAssets([require('../assets/sunscan_backend_source.zip')]);

  // Initialize translation hook
  const { t, i18n } = useTranslation();
  const [lang, changeLang] = useState('en');
  const selectedLanguageCode = i18n.language;

  // Function to update firmware
  const updateFirmware = async () => {

    Alert.alert(t('common:warning'), t('common:updateFirmwareconfirm'), [
      {
        text: 'Annuler',
        style: 'cancel',
      },
      { text: 'OK', onPress: async () => {

              try {
                // Create FormData and append the ZIP file
                const formData = new FormData();
                formData.append('file', {
                  uri: assetZipPath[0].localUri,
                  name: 'sunscan_backend_source.zip',
                  type: 'application/zip',
                });
                
                // Send the ZIP file to the FastAPI server
                const response = await fetch('http://'+myContext.apiURL+"/update", {
                  method: 'POST',
                  body: formData,
                  headers: {
                    'Content-Type': 'multipart/form-data',
                  },
                });

                // Handle the response
                if (response.ok) {
                  const jsonResponse = await response.json();
                  Alert.alert(t('common:success'), t('common:firmwarePostUpdateMessage'));
                } else {
                  const jsonResponse = await response.json();
                  Alert.alert(`Failed: ${jsonResponse.detail}`);
                }
              } catch (error) {
                Alert.alert(`Error: ${error.message}`);
              }
            }}]);
  }

  // Update apiInput when myContext.apiURL changes
  useEffect(()=>{
    setAPIInput(myContext.apiURL);
    console.log(languages)
  }, [myContext.apiURL]);

  // Effect to fetch stats when the component gains focus
  useFocusEffect(
    useCallback(() => {
    setCacheIsCleared(false);
  }, []));

  // Function to save language preference to AsyncStorage
  const saveData = async (code) => {
    try {
      await AsyncStorage.setItem('SUNSCAN_APP::LANGUAGE', code);
      console.log('saved', code);
    } catch {
      console.log('err in saving data');
    }
  };



  const clearImageCache = async () => {
  
      Alert.alert(t('common:warning'), t('common:clearCacheConfirm'), [
        {
          text: t('common:cancel'),
          style: 'cancel',
        },
        { text: 'OK', onPress: async () => {
  
          Image.clearMemoryCache();
          Image.clearDiskCache();
          setCacheIsCleared(true);
              }}]);

      

  };

  
  const shutdown = async () => {
    Alert.alert(t('common:warning'), t('common:shutdownConfirm'),[
      {
        text: t('common:cancel'),
        style: 'cancel',
      },
      { text: 'OK', onPress: async () => {
        const url = 'http://'+myContext.apiURL+"/sunscan/shutdown/"
        fetch(url, {
          method: "POST", 
          headers: {
            'Content-Type': 'application/json'
        },
          body: JSON.stringify({}),
        }).then(response => response.json())
        .then(json => {
          setSunscanIsShutdown(true);
        })
        .catch(error => {
          console.error(error);
        });
     }}]);
  };

  const reboot = async () => {
    Alert.alert(t('common:warning'), t('common:rebootConfirm'),[
      {
        text: t('common:cancel'),
        style: 'cancel',
      },
      { text: 'OK', onPress: async () => {
        const url = 'http://'+myContext.apiURL+"/sunscan/reboot/"
        fetch(url, {
          method: "POST", 
          headers: {
            'Content-Type': 'application/json'
        },
          body: JSON.stringify({}),
        }).then(response => response.json())  
        .then(json => {
          setSunscanIsReboot(true);
        })
        .catch(error => {
          console.error(error);
        });
     }}]);
  };


  useFocusEffect(
    useCallback(() => {
      if (myContext.sunscanIsConnected) {
        setSunscanIsShutdown(false);
        setSunscanIsReboot(false);
      }
  }, [isFocused, myContext.sunscanIsConnected]));

  return (
    <View className="flex flex-col bg-zinc-800">
      <View className="h-full">
        <SafeAreaProvider  className="flex flex-col space-y-4 px-8 pt-4">
          <ScrollView >
            {/* Settings header */}
            <Text className="text-xl text-white font-bold pt-4">{t('common:configuration')}</Text>
            <Text className="text-xs text-zinc-500 mb-4 mt-1">Sunscan v{Application.nativeApplicationVersion} app by STAROS ©{new Date().getFullYear()}</Text>
            <View  className="flex flex-col mb-4 ">
            <View  className="flex flex-row  space-x-4 items-start  ">
              {(myContext.sunscanIsConnected || myContext.debug) && <>
              <Pressable className="bg-red-600 p-2 rounded-lg flex flex-row items-center space-x-2" onPress={shutdown}><Ionicons name="power" size={20} color="white" /><Text className="text-white">{t('common:shutdown')}</Text></Pressable> 
              <Pressable className="bg-red-600 p-2 rounded-lg flex flex-row items-center space-x-2" onPress={reboot}><Ionicons name="power" size={20} color="white" /><Text className="text-white">{t('common:reboot')}</Text></Pressable></>}
              </View>
              {sunscanIsReboot && <View className="flex flex-row  space-x-4 items-start mt-2 ">
                  <Text className="text-white mb-1 text-xs italic" >{t('common:rebootOk')}</Text>
                </View>}
                {sunscanIsShutdown && <View className="flex flex-row  space-x-4 items-start mt-2 ">
                  <Text className="text-white mb-1 text-xs italic" >{t('common:shutdownOk')}</Text>
                </View>}
                </View>
            
            
            {/* Language selection */}
            <View className="flex flex-row  space-x-4 items-center mb-4">
              <Text className="text-white w-1/2" >{t('common:language')}</Text>
              {languages.map((currentLang, i) => {
                const selectedLanguage = currentLang.code === selectedLanguageCode;
                return (
                  <Text
                    key={i}
                    onPress={() => {
                      changeLang(currentLang.code);
                      i18n.changeLanguage(currentLang.code);
                      saveData(currentLang.code);
                    }}
                    style={{
                      color:  selectedLanguage ?'#fff':'gray',
                      padding: 10,
                      fontWeight: selectedLanguage ? 'bold' : 'normal',
                    }}>
                    {currentLang.label}
                  </Text>
                );
              })}
            </View>

            {/* Observer input */}
            <View className="flex flex-row  space-x-4 items-center">
              <Text className="text-white w-1/2" >{t('common:observer')}</Text>
              <TextInput className="bg-zinc-700 border border-zinc-500 grow mr-2 text-white rounded-md" style={{padding:5}}  value={myContext.observer} onChangeText={myContext.setObserver}/>
            </View> 

             {/* Watermark toggle */}
             <View className="flex flex-row  space-x-4 items-start mt-2  ">
              <View className="w-1/2"> 
                <Text className="text-white mb-1" >{t('common:displayWatermark')}</Text>
                <Text className="text-white text-zinc-600" style={{fontSize:11}}>{t('common:displayWatermarkDescription')}</Text>
              </View>
              <Switch
               trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
             thumbColor='#fff'
                value={myContext.showWatermark}
                onValueChange={myContext.toggleShowWaterMark}
              />
            </View>

            {/* Debug mode toggle */}
            <View className="flex flex-row  space-x-4 items-start mt-2  ">
              <View className="w-1/2">
                <Text className="text-white mb-1" >{t('common:debugMode')}</Text>
                <Text className="text-white text-zinc-600" style={{fontSize:11}}>{t('common:debugDescription')}</Text>
              </View>
              <Switch
               trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
             thumbColor='#fff'
                value={myContext.debug}
                onValueChange={myContext.toggleDebug}
              />
            </View>

            {/* Offline mode toggle */}
            <View className="flex flex-row  space-x-4 items-start mt-2 ">
              <View className="w-1/2">
                <Text className="text-white mb-1" >{t('common:offlineMode')}</Text>
                <Text className="text-white text-zinc-600" style={{fontSize:11}}>{t('common:offlineDescription')}</Text>
              </View>
              <Switch
               trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
             thumbColor='#fff'
                value={myContext.demo}
                onValueChange={myContext.toggleDemo}
              />
            </View>

            {/* Firmware update section */}
            {(myContext.sunscanIsConnected || myContext.debug) && <View className="flex flex-row  space-x-4 items-start mt-2 ">
              <View className="w-1/2">
                <Text className="text-white mb-1" >{t('common:updateFirmware')}</Text>
                  <Text className="text-zinc-600" style={{fontSize:11}}>{t('common:currentVersion')} : {myContext.backendApiVersion}</Text>
                  {(!firmareIsUpToDate(myContext) || myContext.debug) && <>
                  <Text className="text-zinc-600" style={{fontSize:11}}>{t('common:newVersion')} : {backend_current_version}</Text>
                  <Text className="text-zinc-600" style={{fontSize:11}}>{t('common:updateFirmwareDescription')}</Text>
                </>}
              </View>
              {!firmareIsUpToDate(myContext) || myContext.debug ?
              <Pressable className="bg-red-600 p-2 rounded-lg flex flex-row items-center space-x-2" onPress={updateFirmware}><Ionicons name="refresh" size={20} color="white" /><Text className="text-white">{t('common:update')}</Text></Pressable>:
              <View className="text-white flex flex-row items-center align-center space-x-2"><Text className="text-white ">{t('common:upToDate')}</Text><Ionicons name="checkmark-circle" size={20} color="white" /></View>}
            </View>}

            <View className="flex flex-row  space-x-4 items-start mt-2 ">
              <View className="w-1/2">
                <Text className="text-white mb-1" >{t('common:clearImageCache')}</Text>
                <Text className="text-zinc-600" style={{fontSize:11}}>{t('common:clearCacheDescription')}</Text>
              </View>
              {cacheIsCleared ? <Text className="text-white">Ok !</Text>:<Pressable className="bg-zinc-600 p-2 rounded-lg flex flex-row items-center space-x-2" onPress={clearImageCache}><Ionicons name="trash" size={20} color="white" /><Text className="text-white">{t('common:clearImageCache')}</Text></Pressable>}
            </View>

                        {/* Stacking Configuration */}
                        <View className="flex flex-col space-y-4 mt-4">
              <Text className="text-xl text-white font-bold">{t('common:stackingConfiguration')}</Text>
              
              {/* Patch Size */}
              <View className="flex flex-row space-x-4 items-center">
                <Text className="text-white w-1/2">{t('common:patchSize')}</Text>
                <TextInput 
                  className="bg-zinc-700 border border-zinc-500 grow mr-2 text-white rounded-md" 
                  style={{ padding: 5 }}
                  keyboardType="numeric"
                  value={String(myContext.stackingOptions.patchSize)}
                  onChangeText={(value) => myContext.setStackingOptions({
                    ...myContext.stackingOptions,
                    patchSize: Number(value)
                  })}
                />
              </View>
              
              {/* Step Size */}
              <View className="flex flex-row space-x-4 items-center">
                <Text className="text-white w-1/2">{t('common:stepSize')}</Text>
                <TextInput 
                  className="bg-zinc-700 border border-zinc-500 grow mr-2 text-white rounded-md" 
                  style={{ padding: 5 }}
                  keyboardType="numeric"
                  value={String(myContext.stackingOptions.stepSize)}
                  onChangeText={(value) => myContext.setStackingOptions({
                    ...myContext.stackingOptions,
                    stepSize: Number(value)
                  })}
                />
              </View>
              
              {/* Intensity Threshold */}
              <View className="flex flex-row space-x-4 items-center">
                <Text className="text-white w-1/2">{t('common:intensityThreshold')}</Text>
                <TextInput 
                  className="bg-zinc-700 border border-zinc-500 grow mr-2 text-white rounded-md" 
                  style={{ padding: 5 }}
                  keyboardType="numeric"
                  value={String(myContext.stackingOptions.intensityThreshold)}
                  onChangeText={(value) => myContext.setStackingOptions({
                    ...myContext.stackingOptions,
                    intensityThreshold: Number(value)
                  })}
                />
              </View>
            </View>


     
            <View className="mt-14"></View>
            <View>
              <Text className="text-zinc-500 text-xs italic">Behind the SUNSCAN is a passionate and dedicated team: STAROS Projects. Five members each bring their unique expertise to bear on making the SUNSCAN a success : Guillaume BERTRAND, Christian BUIL, Valérie DESNOUX, Olivier GARDE et Matthieu LE LAIN</Text>
            </View>
            <View className="mt-8"></View>
          </ScrollView>
        </SafeAreaProvider>
      </View>
    </View>
  );
}




