import React, {  useContext,  useState } from 'react';
import { View,FlatList, SafeAreaView, ActivityIndicator } from 'react-native';
import { NativeWindStyleSheet } from "nativewind";

// Configure NativeWind to use native output
NativeWindStyleSheet.setOutput({
  default: "native",
});

import Card from '../components/Card';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import AppContext from '../components/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Component to render individual scan items
const Item = (props) => {
  return (<View className="w-1/2 p-2"><Card scan={props.scan}  /></View>);
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
  async function getScans(page) {
    setIsLoading(true);
    setPage(page);
    if (page == 1) {
      setScans([]);
      setTotal(0);
    }
    console.log('http://'+myContext.apiURL+`/sunscan/scans?page=${page}&size=${size}`)
    fetch('http://'+myContext.apiURL+`/sunscan/scans?page=${page}&size=${size}`).then(response => response.json())
    .then(json => {
      setIsLoading(false);
      setScans(prevFiles => [...prevFiles, ...json.scans]);
      setTotal(json.total);
      if(scans.length) {
        AsyncStorage.setItem('SUNSCAN_APP::SCANS', JSON.stringify(scans));
      }
      
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
    setSelectedItems((prevSelectedItems) => {
      if (prevSelectedItems.includes(id)) {
        return prevSelectedItems.filter((itemId) => itemId !== id);
      } else {
        return [...prevSelectedItems, id];
      }
    });
  };

  return (
    <SafeAreaView className="bg-zinc-800 h-screen" style={{flex:1}}>
      <View className="flex flex-col" style={{flex:1}}>
        <View className="px-10">
          {scans && <FlatList
            data={scans}
            numColumns={2}
            renderItem={({item}) => <Item scan={item} />}
            contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}
            keyExtractor={(item, index) => index.toString()}
            columnWrapperStyle={{ flex: 1, justifyContent: "center" }}
            ListHeaderComponent={<View className="mt-4"></View>}
            refreshing={isLoading}
            onRefresh={()=>{ getScans(1) }}
            onEndReached={loadMoreFiles}
            initialNumToRender={1}
            onEndReachedThreshold={2}
            ListFooterComponent={() => isLoading && <ActivityIndicator size="large" />}
          />}
        </View>
      </View>
    </SafeAreaView>
  );
}




