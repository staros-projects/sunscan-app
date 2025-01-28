import  {  useContext,  useState, useCallback, useEffect } from 'react';
import { View,FlatList, SafeAreaView, ActivityIndicator, Text, Pressable, StyleSheet, Modal, Alert } from 'react-native';
import { NativeWindStyleSheet } from "nativewind";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useDerivedValue, useAnimatedProps, runOnJS, Easing } from 'react-native-reanimated';

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
import IrisSVG from '../components/svg/IrisSVG';
import StackedCard from '../components/StackedCard';
import AnimatedCard from '../components/AnimatedCard';
import AnimationOptionsModal from '../components/AnimationOptionsModal';
import { StatusBar } from 'expo-status-bar';
import { size } from 'lodash';

import { Dimensions } from 'react-native';

const getCardSize = () => {
  const { width, height } = Dimensions.get('window');
  return  width * 25 / 100; 
}

// Component to render individual scan items
const ItemScan = (props) => {
  const size = getCardSize();
  return (<View style={{width:size+20}} className="p-1"><Card squareSize={size} scan={props.scan} selected={props.selected} multiSelectMode={props.multiSelectMode} onLongPress={props.onLongPress} /></View>);
}

const ItemStacked = (props) => {
  const size = getCardSize();
  return (<View style={{width:size+20}} className="p-1"><StackedCard squareSize={size}  scan={props.scan} selected={props.selected} multiSelectMode={props.multiSelectMode} onLongPress={props.onLongPress} /></View>);
}

const ItemAnimation = (props) => {
  const size = getCardSize();
  return (<View style={{width:size+20}} className="p-1"><AnimatedCard squareSize={size}  scan={props.scan} selected={props.selected} multiSelectMode={props.multiSelectMode} onLongPress={props.onLongPress} /></View>);
}

const ItemSnapshot = (props) => {
  const size = getCardSize();
  return (<View style={{width:size+20}} className="p-1"></View>);
}

export default function ListScreen({navigation}) {
  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [animationOptionsModalVisible, setAnimationOptionsModalVisible] = useState(false);
  const [scans, setScans] = useState([]);
  const [curentPage, setPage] = useState(1);
  const [currentView, setCurrentView] = useState("scans");
  const [total, setTotal] = useState(0);
  const size = 20; // Nombre d'éléments par page
  const [selectedItems, setSelectedItems] = useState([]);

  const myContext = useContext(AppContext);
  const isFocused = navigation.isFocused();

  // Function to fetch scans from the API
  async function getScans(page, forceRefresh=false) {
    setIsLoading(true);
    console.log('http://'+myContext.apiURL+`/sunscan/${currentView}?page=${page}&size=${size}`)
    fetch('http://'+myContext.apiURL+`/sunscan/${currentView}?page=${page}&size=${size}`).then(response => response.json())
    .then(json => {
      console.log(scans.length)
      if (scans.length == 0 || forceRefresh || (json.scans.length > 0 && json.scans[0].path != scans[0].path)) {
        setPage(page);
        if (page == 1) {
          setScans([]);
          setTotal(0);
        }
  
        setScans(prevFiles => [...prevFiles, ...json.scans]);
        setTotal(json.total);
      
      }
      setIsLoading(false);
      setDisplayNewAnimatedItemNotif(false);
      setDisplayNewStackedItemNotif(false);
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
        setSelectedItems([]);
        getScans(1);
    },[isFocused, currentView])
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

  // Initialize translation hook
  const { t, i18n } = useTranslation();

  const stackScans = () => {
    console.log('stack');
    if(myContext.cameraIsConnected) {
      Alert.alert(t('common:warning'), t('common:disconnectCameraBeforeStacking'), [
        { text: 'OK', onPress: async () => {}}]);
      return;
    }
    if(selectedItems.length <2) {
      Alert.alert(t('common:warning'), t('common:selectAtLeastOneItem'), [
        { text: 'OK', onPress: async () => {}}]);
      return;
    }
    console.log(selectedItems)
    startModalProcessing(selectedItems.length, 13);
    fetch('http://'+myContext.apiURL+"/sunscan/process/stack/",  {
      method: "POST", 
      headers: {
        'Content-Type': 'application/json'
    },
      body: JSON.stringify({paths:selectedItems.map(i => i+'/scan.ser'), observer:myContext.showWatermark?myContext.observer:''}),
    }).then(response => response.json())
    .then(json => {
      setDisplayNewStackedItemNotif(true);
      setModalVisible(false);
    })


  }

   // Alert for confirming scan deletion
   const deleteButtonAlert = () =>
    Alert.alert(t('common:warning'), t('common:deleteGenericConfirm'), [
      {
        text: 'Annuler',
        style: 'cancel',
      },
      { text: 'OK', onPress: () => deleteScans() },
    ]);

  const deleteScans = () => {
    console.log('delete scans');
    fetch('http://'+myContext.apiURL+"/sunscan/scans/delete/",  {
      method: "POST", 
      headers: {
        'Content-Type': 'application/json'
    },
      body: JSON.stringify({paths:selectedItems}),
    }).then(response => response.json())
    .then(json => {
      setSelectedItems([]);
      getScans(1, true);
    })


  }

  const [modalVisible, setModalVisible] = useState(false);
  const progress = useSharedValue(0); 

  const startModalProcessing = (count, duration) => {
    setModalVisible(true);
    progress.value = 0;
    progress.value = withTiming(1, {
      easing: Easing.linear,
      duration: (duration * count * 1000), 
    }, () => {
          //runOnJS(setModalVisible)(false);
          runOnJS(setSelectedItems)([]);
    });
  };

  const [progressValue, setProgressValue] = useState(0);

  const animatedBarStyle = useAnimatedStyle(() => {
    const txt =  `${Math.round(progress.value * 100)}%`;
    runOnJS(setProgressValue)(txt);
    return {
      width: `${progress.value * 100}%`,
    };
  });

  const showAnimationOptionsModal = () => {
    if(selectedItems.length <2) {
      Alert.alert(t('common:warning'), t('common:selectAtLeastOneItem'), [
        { text: 'OK', onPress: async () => {}}]);
      return;
    }
    setAnimationOptionsModalVisible(true);
  }

  const animateScans = async (options) => {
    console.log('animate', options);
   

     const sortedPaths = selectedItems
     .map(i => i + '/scan.ser')
     .sort((a, b) => a.localeCompare(b)); 


    await fetch('http://'+myContext.apiURL+"/sunscan/process/animate/",  {
      method: "POST", 
      headers: {
        'Content-Type': 'application/json'
    },
      body: JSON.stringify({
        paths:sortedPaths,
        watermark:myContext.showWatermark,
        observer:myContext.observer,
        ...options
      }),
    }).then(response => response.json())
    .then(json => {
      setDisplayNewAnimatedItemNotif(true);
      setSelectedItems([]);
      console.log(json)
    })
  }




const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    width: 300,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  progressBarContainer: {
    width: '100%',
    height: 20,
    backgroundColor: 'rgb(161 161 170)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'rgb(132 204 22)',
  },
  percentageText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
  },
});


const updateCurrentView = (view) => {
  if (view == currentView) {
    return;
  }
  setScans([]);
  setSelectedItems([]);
  setCurrentView(view);
}

useEffect(() => {
  setMassEditMode(selectedItems.length > 0);
}, [selectedItems])

const [displayNewStackededItemNotif, setDisplayNewStackedItemNotif] = useState(false);
const [displayNewAnimatedItemNotif, setDisplayNewAnimatedItemNotif] = useState(false);
const [massEditMode, setMassEditMode] = useState(false);



  return (
    <>
    <SafeAreaView className="bg-zinc-700 h-screen" style={{flex:1}}>
      {massEditMode > 0 && <View className="absolute bottom-0 flex flex-row items-center justify-center w-full bg-zinc-900/80 py-2 space-x-2" style={{zIndex:20}}>
        <Text className="text-white text-xs mr-4">{selectedItems.length} {t('common:scanSelected')}</Text>
        {currentView == 'scans' && <><Pressable className="bg-zinc-600 p-2 rounded-lg flex flex-row items-center space-x-2 mr-2" onPress={stackScans}><Ionicons name="logo-stackoverflow" size={20} color="white" /><Text className="text-white"> {t('common:stack')}</Text></Pressable>
       <Pressable className="bg-zinc-600 p-2 rounded-lg flex flex-row items-center space-x-2 mr-2" onPress={showAnimationOptionsModal}><Ionicons name="film-outline" size={20} color="white" /><Text className="text-white"> {t('common:animate')}</Text></Pressable></>}
        <Pressable className="bg-red-600 p-2 rounded-lg flex flex-row items-center space-x-2" onPress={deleteButtonAlert}><Ionicons name="trash" size={20} color="white" /><Text className="text-white"> {t('common:delete')}</Text></Pressable>
        <Pressable className="bg-zinc-600 p-2 rounded-lg flex flex-row items-center space-x-2" onPress={()=>{setSelectedItems([])}}><Ionicons name="close" size={20} color="white" /></Pressable>
      </View>}
      <View className="flex flex-row items-center justify-center w-full bg-zinc-900/80 pt-1 space-x-2" style={{height:40}}>
        <Pressable className={currentView == "scans" ?   "bg-zinc-700 p-2 rounded-t-lg flex flex-row items-center space-x-2":"p-2 rounded-lg flex flex-row items-center space-x-2"} onPress={()=>{updateCurrentView('scans')}}>
          <IrisSVG color={currentView == "scans" ? "white":"#71717a"} size={21}  />
          <Text className={currentView == "scans" ? "text-white uppercase":"text-zinc-500 uppercase"}>{t('common:scans')}</Text>
        </Pressable>
        <Pressable className={currentView == "stacked" ? "bg-zinc-700 p-2 rounded-t-lg flex flex-row items-center space-x-2":"p-2 rounded-lg flex flex-row items-center space-x-2"} onPress={()=>{updateCurrentView('stacked')}}>
          <Ionicons name="logo-stackoverflow" size={20} color={currentView == "stacked" ? "white":"#71717a"}  />
          <Text className={currentView == "stacked" ? "text-white uppercase":"text-zinc-500 uppercase"}>{t('common:stacked')}</Text>
          {displayNewStackededItemNotif && <View className="flex justify-center items-center bg-red-600 absolute rounded-full w-4 h-4" style={{top:0, right:-6}}><Text className="text-white" style={{fontSize:11}}>1</Text></View>}
        </Pressable>
        <Pressable className={currentView == "animated" ? "bg-zinc-700 p-2 rounded-t-lg flex flex-row items-center space-x-2":"p-2 rounded-lg flex flex-row items-center space-x-2"} onPress={()=>{updateCurrentView('animated')}}>
          <Ionicons name="film-outline" size={20} color={currentView == "animated" ? "white":"#71717a"}  />
          <Text className={currentView == "animated" ? "text-white uppercase":"text-zinc-500 uppercase"}>{t('common:animations')}</Text>
          {displayNewAnimatedItemNotif && <View className="flex justify-center items-center bg-red-600 absolute rounded-full w-4 h-4" style={{top:0, right:-6}}><Text className="text-white" style={{fontSize:11}}>1</Text></View>}
        </Pressable>

         <Pressable className="absolute right-0 top-0 p-3" onPress={()=>{setMassEditMode(true);}}>
          <Ionicons name="build-outline" size={20} color={massEditMode ? "white":"#71717a"}  />
        </Pressable> 
      {/* <Pressable className={currentView == "snapshots" ? "bg-zinc-700 p-2 rounded-t-lg flex flex-row items-center space-x-2":"p-2 rounded-lg flex flex-row items-center space-x-2"} onPress={()=>{updateCurrentView('snapshots')}}>
        <Ionicons name="camera" size={20} color={currentView == "snapshots" ? "white":"#71717a"}  />
        <Text className={currentView == "snapshots" ? "text-white uppercase":"text-zinc-500 uppercase"}>{t('common:snapshots')}</Text>
      </Pressable> */}
    </View>


      <View className="flex flex-col" style={{flex:1}}>
        <View className="px-10">
          {scans.length ? <FlatList
            data={scans}
            numColumns={3}
            renderItem={({item}) => 
            {
              if(currentView == "scans"){
                return <ItemScan selected={selectedItems.includes(item.path)} scan={item} multiSelectMode={massEditMode} onLongPress={() => handleLongPress(item.path)} />
              }
              else if(currentView == "stacked"){
                return <ItemStacked selected={selectedItems.includes(item.path)} scan={item} multiSelectMode={massEditMode} onLongPress={() => handleLongPress(item.path)} />
              }
              else if(currentView == "animated"){
                return <ItemAnimation selected={selectedItems.includes(item.path)} scan={item} multiSelectMode={massEditMode} onLongPress={() => handleLongPress(item.path)} />
              }
              else if(currentView == "snapshots"){
                return <ItemSnapshot selected={selectedItems.includes(item.path)} scan={item} multiSelectMode={massEditMode} onLongPress={() => handleLongPress(item.path)} />
              }
            }
            }
            contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}
            keyExtractor={(item, index) => index.toString()}
            columnWrapperStyle={{ flex: 1, justifyContent: "center" }}
            ListHeaderComponent={<View className="mt-2"></View>}
            refreshing={isLoading}
            onRefresh={()=>{ getScans(1, true) }}
            onEndReached={loadMoreFiles}
            initialNumToRender={1}
            onEndReachedThreshold={2}
          />:<></>}
        </View>
      </View>
    </SafeAreaView>
          <Modal
          transparent={true}
          visible={modalVisible}
          animationType="fade"
          statusBarTranslucent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalBackground}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalText}>Traitement en cours...</Text>
  
              <View style={styles.progressBarContainer}>
                <Animated.View style={[styles.progressBar, animatedBarStyle]} />
              </View>
              <Animated.Text style={styles.percentageText}>{progressValue}</Animated.Text>
            </View>
          </View>
        </Modal>
        <AnimationOptionsModal
        visible={animationOptionsModalVisible}
        itemCount={selectedItems.length}
        onClose={() => setAnimationOptionsModalVisible(false)}
        onSubmit={animateScans}
      />
        </>
  );
}




