import  {  useContext,  useState, useCallback } from 'react';
import { View,FlatList, SafeAreaView, ActivityIndicator, Text, Pressable } from 'react-native';
import { NativeWindStyleSheet } from "nativewind";

// Configure NativeWind to use native output
NativeWindStyleSheet.setOutput({
  default: "native",
});

import Card from '../components/Card';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import AppContext from '../components/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next';
// Component to render individual scan items
const Item = (props) => {
  return (<View className="w-1/2 p-2"><Card scan={props.scan} selected={props.selected} multiSelectMode={props.multiSelectMode} onLongPress={props.onLongPress} /></View>);
}

export default function ListScreen({navigation}) {
  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [scans, setScans] = useState([]);
  const [curentPage, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const size = 20; // Nombre d'éléments par page
  const [selectedItems, setSelectedItems] = useState([]);

  const myContext = useContext(AppContext);
  const isFocused = navigation.isFocused();

  // Function to fetch scans from the API
  async function getScans(page, forceRefresh=false) {
    setIsLoading(true);
    
    console.log('http://'+myContext.apiURL+`/sunscan/scans?page=${page}&size=${size}`)
    fetch('http://'+myContext.apiURL+`/sunscan/scans?page=${page}&size=${size}`).then(response => response.json())
    .then(json => {

      if (scans.length == 0 || forceRefresh || json.scans[0].ser != scans[0].ser) {
        setPage(page);
        if (page == 1) {
          setScans([]);
          setTotal(0);
        }
  
        
        setScans(prevFiles => [...prevFiles, ...json.scans]);
        setTotal(json.total);
      }
      setIsLoading(false);
      
    })
    .catch(error => {
      console.error(error);
      setIsLoading(false);
    });
  }

  const loadMoreFiles = () => {
    if (scans.length < total) {
      getScans(curentPage+1)
    }
  };

  // Effect to load scans when the screen is focused
  useFocusEffect(
    useCallback(() => { 
        getScans(1);
  
      // // Load scans from AsyncStorage if available
      // if (!myContext.sunscanIsConnected) {
      //   AsyncStorage.getItem('SUNSCAN_APP::SCANS').then((d) => {
      //     if(d)  {
      //       setScans(JSON.parse(d));
      //     }
      //   });  
      // }
      // else {
      //   getScans(1);
      // }
    },[isFocused])
  );


  // Function to handle long press on items (for selection)
  const handleLongPress = (id) => {
    console.log(id)
    setSelectedItems((prevSelectedItems) => {
      if (prevSelectedItems.includes(id)) {
        return prevSelectedItems.filter((itemId) => itemId !== id);
      } else {
        return [...prevSelectedItems, id];
      }
    });
  };

  // Initialize translation hook
  const { t, i18n } = useTranslation();

  return (
    <SafeAreaView className="bg-zinc-800 h-screen" style={{flex:1}}>
      {selectedItems.length > 0 && <View className="absolute bottom-0 flex flex-row items-center justify-center w-full bg-zinc-900/80 py-2 space-x-2" style={{zIndex:20}}>
        <Text className="text-white text-xs mr-4">{selectedItems.length} {t('common:scanSelected')}</Text>
        {myContext.debug && <><Pressable className="bg-zinc-600 p-2 rounded-lg flex flex-row items-center space-x-2 mr-2" onPress={()=>{}}><Ionicons name="logo-stackoverflow" size={20} color="white" /><Text className="text-white"> {t('common:stack')}</Text></Pressable>
        <Pressable className="bg-zinc-600 p-2 rounded-lg flex flex-row items-center space-x-2 mr-2" onPress={()=>{}}><Ionicons name="film-outline" size={20} color="white" /><Text className="text-white"> {t('common:animate')}</Text></Pressable></>}
        <Pressable className="bg-red-600 p-2 rounded-lg flex flex-row items-center space-x-2" onPress={()=>{}}><Ionicons name="trash" size={20} color="white" /><Text className="text-white"> {t('common:delete')}</Text></Pressable>
        <Pressable className="bg-zinc-600 p-2 rounded-lg flex flex-row items-center space-x-2" onPress={()=>{setSelectedItems([])}}><Ionicons name="close" size={20} color="white" /></Pressable>
      </View>}
      <View className="flex flex-col" style={{flex:1}}>
        <View className="px-10">
          {scans.length ? <FlatList
            data={scans}
            numColumns={2}
            renderItem={({item}) => <Item selected={selectedItems.includes(item.ser)} scan={item} multiSelectMode={selectedItems.length > 0} onLongPress={() => handleLongPress(item.ser)} />}
            contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}
            keyExtractor={(item, index) => index.toString()}
            columnWrapperStyle={{ flex: 1, justifyContent: "center" }}
            ListHeaderComponent={<View className="mt-4"></View>}
            refreshing={isLoading}
            onRefresh={()=>{ getScans(1, true) }}
            onEndReached={loadMoreFiles}
            initialNumToRender={1}
            onEndReachedThreshold={2}
          />:<></>}
        </View>
      </View>
    </SafeAreaView>
  );
}




