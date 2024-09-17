
import React, { useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';
import {  Alert, Button, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';


import { NativeWindStyleSheet } from "nativewind";

import * as Application from 'expo-application';
import AppContext from '../components/AppContext';

import { useAssets } from 'expo-asset';
import { useTranslation } from 'react-i18next';
import { t } from 'i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';

NativeWindStyleSheet.setOutput({
  default: "native",
});

// Define available languages
const languages = [ // Language List
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

export default function SettingsScreen({navigation}) {
  // Get the global variables & functions via context
  const myContext = useContext(AppContext);
  const [apiInput, setAPIInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cacheIsCleared, setCacheIsCleared] = useState(false);
  // Load the firmware update ZIP file from assets
  const [assetZipPath, error] = useAssets([require('../assets/sunscan_backend_source.zip')]);

  // Initialize translation hook
  const { t, i18n } = useTranslation();
  const [lang, changeLang] = useState('en');
  const selectedLanguageCode = i18n.language;

  // Function to update firmware
  const updateFirmware = async () => {
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
        Alert.alert(`Success: ${jsonResponse.message}`);
      } else {
        const jsonResponse = await response.json();
        Alert.alert(`Failed: ${jsonResponse.detail}`);
      }
    } catch (error) {
      Alert.alert(`Error: ${error.message}`);
    }
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
      Image.clearMemoryCache();
      Image.clearDiskCache();
      setCacheIsCleared(true);

  };

  return (
    <View className="flex flex-col bg-zinc-800">
      <View className="h-full">
        <SafeAreaProvider  className="flex flex-col space-y-4 px-8 pt-4">
          <ScrollView >
            {/* Settings header */}
            <Text className="text-xl text-white font-bold pt-4">{t('common:configuration')}</Text>
            <Text className="text-xs text-zinc-500 mb-4 mt-1">Sunscan v{Application.nativeApplicationVersion} app by STAROS ©{new Date().getFullYear()}</Text>
            
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
            {/* <View className="flex flex-row  space-x-4 items-center">
              <Text className="text-white w-1/2" >{t('common:observer')}</Text>
              <TextInput className="bg-zinc-700 border border-zinc-500 w-40 text-white rounded-md" style={{padding:10}}  value={myContext.observer} onChangeText={myContext.setObserver}/>
            </View> */}

            {/* Debug mode toggle */}
            <View className="flex flex-row  space-x-4 items-start mt-2  ">
              <View className="w-1/2">
                <Text className="text-white mb-1" >{t('common:debugMode')}</Text>
                <Text className="text-white text-zinc-600" style={{fontSize:11}}>{t('common:debugDescription')}</Text>
              </View>
              <Switch
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
                value={myContext.demo}
                onValueChange={myContext.toggleDemo}
              />
            </View>

            {/* Firmware update section */}
            <View className="flex flex-row  space-x-4 items-start mt-2 ">
              <View className="w-1/2">
                <Text className="text-white mb-1" >{t('common:updateFirmware')} [v{myContext.backendApiVersion} &#62;&#62; v{Application.nativeApplicationVersion}]</Text>
                <Text className="text-zinc-600" style={{fontSize:11}}>{t('common:updateFirmwareDescription')}</Text>
              </View>
              <Button title={t('common:update')} className="mx-2" />
            </View>

            <View className="flex flex-row  space-x-4 items-start mt-2 ">
              <View className="w-1/2">
                <Text className="text-white mb-1" >{t('common:clearImageCache')}</Text>
                <Text className="text-zinc-600" style={{fontSize:11}}>{t('common:clearCacheDescription')}</Text>
              </View>
              {cacheIsCleared ? <Text className="text-white">Ok !</Text>:<Button title={t('common:clearImageCache')} onPress={clearImageCache} className="mx-2" />}
            </View>

            <View className="mt-8"></View>
          </ScrollView>
        </SafeAreaProvider>
      </View>
    </View>
  );
}




