import  {  useContext,  useState, useCallback, useEffect } from 'react';
import { View,FlatList, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { NativeWindStyleSheet } from "nativewind";
import Animated, { FadeInDown, FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';

// Configure NativeWind to use native output
NativeWindStyleSheet.setOutput({
  default: "native",
});

import Card from '../components/Card';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import AppContext from '../components/AppContext';
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next';
import IrisSVG from '../components/svg/IrisSVG';
import StackedCard from '../components/StackedCard';
import AnimatedCard from '../components/AnimatedCard';
import AnimationOptionsModal from '../components/AnimationOptionsModal';
import StackingModal from '../components/StackingModal';
import PressableScale from '../components/PressableScale';

import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const getCardSize = () => {
  const { width, height } = Dimensions.get('window');
  return  width * 25 / 100; 
}

// Thumbnails fade up as they mount, staggered across the row so a page of
// results lands as a wave rather than all at once. The stagger is taken modulo
// a row count so the delay stays short on later pages, where the index keeps
// growing as more results are appended.
const cardEntering = (index) =>
  FadeInDown.duration(260).delay(((index ?? 0) % 9) * 35).springify().damping(18);

const itemStyle = (size) => ({width: size + 14, padding: 4});

// Component to render individual scan items
const ItemScan = (props) => {
  const size = getCardSize();
  return (<Animated.View entering={cardEntering(props.index)} style={itemStyle(size)}><Card squareSize={size} scan={props.scan} selected={props.selected} multiSelectMode={props.multiSelectMode} onLongPress={props.onLongPress} /></Animated.View>);
}

const ItemStacked = (props) => {
  const size = getCardSize();
  return (<Animated.View entering={cardEntering(props.index)} style={itemStyle(size)}><StackedCard squareSize={size}  scan={props.scan} selected={props.selected} multiSelectMode={props.multiSelectMode} onLongPress={props.onLongPress} /></Animated.View>);
}

const ItemAnimation = (props) => {
  const size = getCardSize();
  return (<Animated.View entering={cardEntering(props.index)} style={itemStyle(size)}><AnimatedCard squareSize={size}  scan={props.scan} selected={props.selected} multiSelectMode={props.multiSelectMode} onLongPress={props.onLongPress} /></Animated.View>);
}

const ItemSnapshot = (props) => {
  const size = getCardSize();
  return (<View style={itemStyle(size)}></View>);
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
  const [displayNewStackededItemNotif, setDisplayNewStackedItemNotif] = useState(false);
  const [displayNewAnimatedItemNotif, setDisplayNewAnimatedItemNotif] = useState(false);
  const [massEditMode, setMassEditMode] = useState(false);

  const myContext = useContext(AppContext);
  const isFocused = navigation.isFocused();

  // Function to fetch scans from the API
  async function getScans(page, forceRefresh=false) {
    setIsLoading(true);
    console.log('http://'+myContext.apiURL+`/sunscan/${currentView}?page=${page}&size=${size}`)
    fetch('http://'+myContext.apiURL+`/sunscan/${currentView}?page=${page}&size=${size}`).then(response => response.json())
    .then(json => {
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
    // The count is captured here: the selection is cleared on success, and the
    // pop-in still has to say how many frames it is working on.
    setStackingCount(selectedItems.length);
    setStackingError(false);
    setModalVisible(true);
    fetch('http://'+myContext.apiURL+"/sunscan/process/stack/",  {
      method: "POST", 
      headers: {
        'Content-Type': 'application/json'
    },
      body: JSON.stringify({paths:selectedItems.map(i => i+'/scan.ser'), observer:myContext.showWatermark?myContext.observer:' ', "patch_size":myContext.stackingOptions.patchSize, "step_size":myContext.stackingOptions.stepSize, "intensity_threshold":myContext.stackingOptions.intensityThreshold}),
    }).then(response => response.json())
    .then(json => {
      setDisplayNewStackedItemNotif(true);
      // Cleared on the real end of the job, not when an estimated timer ran out
      setSelectedItems([]);
      setModalVisible(false);
    })
    .catch(error => {
      // Without this the pop-in stayed up for ever on a dropped connection
      console.error('stacking failed:', error);
      setStackingError(true);
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
  const [stackingCount, setStackingCount] = useState(0);
  const [stackingError, setStackingError] = useState(false);

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

    const filename = currentView == 'scans' ? '/scan.ser' : '';

     const sortedPaths = selectedItems
     .map(i => i + filename)
     .sort((a, b) => a.localeCompare(b)); 

     console.log('sorted', sortedPaths);

    await fetch('http://'+myContext.apiURL+"/sunscan/process/animate/",  {
      method: "POST", 
      headers: {
        'Content-Type': 'application/json'
    },
      body: JSON.stringify({
        paths:sortedPaths,
        watermark:myContext.showWatermark,
        observer:myContext.showWatermark?myContext.observer:' ',
        ...options
      }),
    }).then(response => response.json())
    .then(json => {
      setDisplayNewAnimatedItemNotif(true);
      setSelectedItems([]);
      console.log(json)
    })
  }




const updateCurrentView = (view) => {
  if (view == currentView) {
    return;
  }
  setScans([]);
  setTotal(0);
  setSelectedItems([]);
  setCurrentView(view);
}

useEffect(() => {
  setMassEditMode(selectedItems.length > 0);
}, [selectedItems])




  const insets = useSafeAreaInsets();

  // Label for the item count in the header, following the selected tab
  const viewLabel = currentView == 'stacked' ? t('common:stacked')
    : currentView == 'animated' ? t('common:animations')
    : t('common:scans');

  return (
    <View className="bg-zinc-800 h-full" >
      {massEditMode > 0 && <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} className="absolute bottom-0 flex flex-row items-center justify-center w-full bg-zinc-950/95 py-3 px-0 space-x-2" style={{zIndex:20, borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:'rgba(255,255,255,0.12)'}}>
        <Text className="text-white text-xs mr-4">{selectedItems.length} {t('common:scanSelected')}</Text>
        {currentView == 'scans' && <View className="flex flex-row">
          <PressableScale className="bg-zinc-600 p-2 rounded-lg flex flex-row items-center space-x-2 mr-2" onPress={stackScans}><Ionicons name="logo-stackoverflow" size={20} color="white" /><Text className="text-white"> {t('common:stack')}</Text></PressableScale></View>}
         {currentView != 'animated' && <PressableScale className="bg-zinc-600 p-2 rounded-lg flex flex-row items-center space-x-2 mr-2" onPress={showAnimationOptionsModal}><Ionicons name="film-outline" size={20} color="white" /><Text className="text-white"> {t('common:animate')}</Text></PressableScale>}
        <PressableScale className="bg-red-600 p-2 rounded-lg flex flex-row items-center space-x-2" onPress={deleteButtonAlert}><Ionicons name="trash" size={20} color="white" /><Text className="text-white"> {t('common:delete')}</Text></PressableScale>
        <PressableScale className="bg-zinc-700 p-2 rounded-xl flex flex-row items-center space-x-2" onPress={()=>{setSelectedItems([])}}><Ionicons name="close" size={20} color="white" /></PressableScale>
      </Animated.View>}

      {/* Gallery header: pill tabs on a flat bar, with the item count on the left */}
      <View className="flex flex-row items-center justify-center w-full bg-zinc-950 space-x-2" style={{height:52, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:'rgba(255,255,255,0.10)'}}>

        {total > 0 && <Text className="absolute left-0 ml-4 text-zinc-500" style={{fontSize:12}}>{total} {viewLabel}</Text>}

        <PressableScale className={currentView == "scans" ? "bg-zinc-700 px-3 py-2 rounded-full flex flex-row items-center space-x-2" : "px-3 py-2 rounded-full flex flex-row items-center space-x-2"} onPress={()=>{updateCurrentView('scans')}}>
          <IrisSVG color={currentView == "scans" ? "white":"#71717a"} size={19} width={19} height={19}  />
          <Text className={currentView == "scans" ? "text-white uppercase":"text-zinc-500 uppercase"} style={{fontSize:13}}>{t('common:scans')}</Text>
        </PressableScale>

        <PressableScale className={currentView == "stacked" ? "bg-zinc-700 px-3 py-2 rounded-full flex flex-row items-center space-x-2" : "px-3 py-2 rounded-full flex flex-row items-center space-x-2"} onPress={()=>{updateCurrentView('stacked')}}>
          <Ionicons name="logo-stackoverflow" size={18} color={currentView == "stacked" ? "white":"#71717a"}  />
          <Text className={currentView == "stacked" ? "text-white uppercase":"text-zinc-500 uppercase"} style={{fontSize:13}}>{t('common:stacked')}</Text>
          {displayNewStackededItemNotif && <View className="flex justify-center items-center bg-red-600 absolute rounded-full w-4 h-4" style={{top:-2, right:-4}}><Text className="text-white" style={{fontSize:11}}>1</Text></View>}
        </PressableScale>

        <PressableScale className={currentView == "animated" ? "bg-zinc-700 px-3 py-2 rounded-full flex flex-row items-center space-x-2" : "px-3 py-2 rounded-full flex flex-row items-center space-x-2"} onPress={()=>{updateCurrentView('animated')}}>
          <Ionicons name="film-outline" size={18} color={currentView == "animated" ? "white":"#71717a"}  />
          <Text className={currentView == "animated" ? "text-white uppercase":"text-zinc-500 uppercase"} style={{fontSize:13}}>{t('common:animations')}</Text>
          {displayNewAnimatedItemNotif && <View className="flex justify-center items-center bg-red-600 absolute rounded-full w-4 h-4" style={{top:-2, right:-4}}><Text className="text-white" style={{fontSize:11}}>1</Text></View>}
        </PressableScale>

        <PressableScale className="absolute right-0 p-3 mr-2" onPress={()=>{setMassEditMode(true);}} style={{paddingRight:insets.right}}>
          <Ionicons name="build-outline" size={20} color={massEditMode ? "white":"#71717a"}  />
        </PressableScale>
      </View>

      <View className="flex flex-col pb-10" style={{paddingRight:insets.right}}>
        <View className="px-2">
          {scans.length ? <FlatList
            data={scans}
            numColumns={3}
            renderItem={({item, index}) =>
            {
              if(currentView == "scans"){
                return <ItemScan index={index} selected={selectedItems.includes(item.path)} scan={item} multiSelectMode={massEditMode} onLongPress={() => handleLongPress(item.path)} />
              }
              else if(currentView == "stacked"){
                return <ItemStacked index={index} selected={selectedItems.includes(item.path)} scan={item} multiSelectMode={massEditMode} onLongPress={() => handleLongPress(item.path)} />
              }
              else if(currentView == "animated"){
                return <ItemAnimation index={index} selected={selectedItems.includes(item.path)} scan={item} multiSelectMode={massEditMode} onLongPress={() => handleLongPress(item.path)} />
              }
              else if(currentView == "snapshots"){
                return <ItemSnapshot index={index} selected={selectedItems.includes(item.path)} scan={item} multiSelectMode={massEditMode} onLongPress={() => handleLongPress(item.path)} />
              }
            }
            }
            contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}
            keyExtractor={(item, index) => item.path.toString()}
            columnWrapperStyle={{ flex: 1, justifyContent: "center" }}
            ListHeaderComponent={<View className="mt-2"></View>}
            refreshing={isLoading}
            onRefresh={()=>{ getScans(1, true) }}
            onEndReached={loadMoreFiles}
            initialNumToRender={1}
            onEndReachedThreshold={2}
          />:
          /* Empty state, rather than a blank screen, once loading has settled */
          (!isLoading && <Animated.View entering={FadeIn.duration(400)} className="flex flex-col items-center justify-center w-full" style={{paddingTop:80}}>
            <Ionicons name="images-outline" size={44} color="#3f3f46" />
            <Text className="text-zinc-600 mt-3">{t('common:emptyGallery')}</Text>
          </Animated.View>)}
        </View>
      </View>

      <StackingModal
        visible={modalVisible}
        frameCount={stackingCount}
        error={stackingError}
        onClose={() => { setStackingError(false); setModalVisible(false); }}
      />
        <AnimationOptionsModal
        visible={animationOptionsModalVisible}
        itemCount={selectedItems.length}
        onClose={() => setAnimationOptionsModalVisible(false)}
        onSubmit={animateScans}
      />
    </View>
  );
}




