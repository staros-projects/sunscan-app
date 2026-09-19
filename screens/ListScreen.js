import  {  useContext,  useState, useCallback, useEffect, useRef } from 'react';
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
import useJobs from '../utils/useJobProgress';
import PressableScale from '../components/PressableScale';
import GalleryFilters, { NO_FILTERS, filtersQuery, hasActiveFilter } from '../components/GalleryFilters';
import ModalLineSelector from '../components/ModalLineSelector';
import { tagItem } from '../utils/Helpers';

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
  // Filters of the current tab, see GalleryFilters. Stacks have the line and
  // SpectroSolHub ones, animations the line only; the filters are cleared on a
  // tab change.
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  // Per-value counts ({tags, statuses, days}) returned with the scans. Stays
  // null against a backend that cannot filter, and the filter button is then
  // not shown.
  const [facets, setFacets] = useState(null);
  // Line picker for the selected stacks or animations, and whether their
  // tagging is under way
  const [lineModalVisible, setLineModalVisible] = useState(false);
  const [isTagging, setIsTagging] = useState(false);
  // Filters change faster than the box answers: only the latest request may
  // update the list, or a slow answer for the previous filter would land last.
  const requestId = useRef(0);

  const myContext = useContext(AppContext);
  const isFocused = navigation.isFocused();

  // Function to fetch scans from the API
  async function getScans(page, forceRefresh=false) {
    setIsLoading(true);
    const filter = filtersQuery(filters);
    const url = 'http://'+myContext.apiURL+`/sunscan/${currentView}?page=${page}&size=${size}${filter}`;
    console.log(url)
    const id = ++requestId.current;
    fetch(url).then(response => response.json())
    .then(json => {
      if (id != requestId.current) {
        return;
      }
      if (currentView == 'scans') {
        setFacets(json.tags ? {tags: json.tags, statuses: json.statuses, days: json.days, hub_statuses: json.hub_statuses} : null);
      } else if (currentView == 'stacked') {
        // Stacks: line and SpectroSolHub counts, from a backend that sends
        // them (no line before the one that tags stacks). There is no date or
        // status filter on stacks.
        setFacets(json.tags || json.hub_statuses ? {tags: json.tags, hub_statuses: json.hub_statuses} : null);
      } else if (currentView == 'animated') {
        // Animations: the line only. They are not sent to the hub for now, so
        // its counts would only ever say "not sent".
        setFacets(json.tags ? {tags: json.tags} : null);
      }
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
      if (id == requestId.current) {
        setIsLoading(false);
      }
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
    },[isFocused, currentView, filters])
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

  // A stacking takes about 1 GB of RAM on the Pi and the backend does not stop
  // a second one: one job at a time.
  const { isRunning: jobIsRunning, start: startJob, completed: completedJob } = useJobs();
  useEffect(() => {
    if (!completedJob) {
      return;
    }
    if (!completedJob.resumed) {
      setSelectedItems([]);
    }
    const view = completedJob.kind == 'stack' ? 'stacked' : 'animated';
    if (view == currentView) {
      getScans(1, true);
    } else if (completedJob.kind == 'stack') {
      setDisplayNewStackedItemNotif(true);
    } else {
      setDisplayNewAnimatedItemNotif(true);
    }
  }, [completedJob]);

  const stackScans = () => {
    console.log('stack');
    if (jobIsRunning) {
      return;
    }
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
    startJob('stack', {
      paths: selectedItems.map(i => i+'/scan.ser'),
      observer: myContext.showWatermark?myContext.observer:' ',
      patch_size: myContext.stackingOptions.patchSize,
      step_size: myContext.stackingOptions.stepSize,
      intensity_threshold: myContext.stackingOptions.intensityThreshold,
    }, selectedItems.length);
  }

   // Alert for confirming scan deletion. "Sent" reads as "backed up", which it
   // is not: only the chosen JPEGs went to SpectroSolHub, the SER, the FITS and
   // the 16 bit PNG are lost for good. Selected pages that are not loaded are
   // only known through the filter.
   const deleteButtonAlert = () => {
    const sentSelected = filters.hub == 'sent'
      || scans.some(s => s.hub_status == 'sent' && selectedItems.includes(s.path));
    const sentMessage = currentView == 'scans' ? t('common:hubDeleteSentManyConfirm') : t('common:hubDeleteSentItemsConfirm');
    Alert.alert(t('common:warning'), sentSelected ? sentMessage : t('common:deleteGenericConfirm'), [
      {
        text: 'Annuler',
        style: 'cancel',
      },
      { text: 'OK', onPress: () => deleteScans() },
    ]);
   };

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

  // Line of the selected stacks or animations, mostly to catch up on those
  // made before the backend recorded it (it was only written in the
  // watermark). One call per item, one after the other: the Pi serves the
  // gallery at the same time.
  const tagSelection = async (key) => {
    setLineModalVisible(false);
    setIsTagging(true);
    let failed = 0;
    for (const path of selectedItems) {
      if (!(await tagItem(myContext.apiURL, path, key))) {
        failed++;
      }
    }
    setIsTagging(false);
    setSelectedItems([]);
    getScans(1, true);
    if (failed) {
      Alert.alert(t('common:warning'), t('common:tagManyFailed', { count: failed }));
    }
  }

  const showAnimationOptionsModal = () => {
    if (jobIsRunning) {
      return;
    }
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

    // The progress pop-in takes over from the options one. Opened while the
    // latter is still fading out, iOS would not show it.
    setAnimationOptionsModalVisible(false);
    await new Promise(resolve => setTimeout(resolve, 350));
    startJob('animation', {
      paths: sortedPaths,
      watermark: myContext.showWatermark,
      observer: myContext.showWatermark?myContext.observer:' ',
      ...options
    }, sortedPaths.length);
  }




const updateCurrentView = (view) => {
  if (view == currentView) {
    return;
  }
  setScans([]);
  setTotal(0);
  setSelectedItems([]);
  // The filters of one tab mean nothing on another
  setFilters(NO_FILTERS);
  setFacets(null);
  setCurrentView(view);
}

const updateFilters = (value) => {
  setScans([]);
  setTotal(0);
  setSelectedItems([]);
  setFilters(value);
}

// Only the loaded pages are known here, so the whole filtered series is asked
// for in one page as large as the filtered total.
const allSelected = total > 0 && selectedItems.length == total;
const toggleSelectAll = () => {
  if (allSelected) {
    setSelectedItems([]);
    return;
  }
  fetch('http://'+myContext.apiURL+`/sunscan/${currentView}?page=1&size=${total}${filtersQuery(filters)}`)
    .then(response => response.json())
    .then(json => setSelectedItems(json.scans.map(scan => scan.path)))
    .catch(error => console.error(error));
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
        {currentView != 'scans' && <PressableScale className="bg-zinc-600 p-2 rounded-lg flex flex-row items-center space-x-2 mr-2" disabled={isTagging} onPress={() => setLineModalVisible(true)}><Ionicons name="pricetag-outline" size={20} color="white" /><Text className="text-white"> {isTagging ? t('common:tagging') : t('common:line')}</Text></PressableScale>}
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

        {facets && <PressableScale className="absolute right-0 p-3" onPress={()=>{setShowFilters(!showFilters)}} style={{marginRight:44 + insets.right}}>
          <Ionicons name={hasActiveFilter(filters) ? "funnel" : "funnel-outline"} size={18} color={hasActiveFilter(filters) ? "#10b981" : (showFilters ? "white" : "#71717a")} />
        </PressableScale>}

        <PressableScale className="absolute right-0 p-3 mr-2" onPress={()=>{setMassEditMode(true);}} style={{paddingRight:insets.right}}>
          <Ionicons name="build-outline" size={20} color={massEditMode ? "white":"#71717a"}  />
        </PressableScale>
      </View>

      {facets && showFilters && <GalleryFilters
        facets={facets}
        filters={filters}
        onChange={updateFilters}
        total={total}
        allSelected={allSelected}
        onToggleSelectAll={toggleSelectAll}
      />}

      {/* The list takes what the header and the filter panel leave, rather
          than its own content height offset by a fixed padding: that padding
          matched the header alone, and with the filters open the last rows
          ended up below the screen, out of reach. */}
      <View className="flex flex-col" style={{flex:1, paddingRight:insets.right}}>
        <View className="px-2" style={{flex:1}}>
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
            // Room under the last row for the selection bar, which floats over the list
            contentContainerStyle={{flexGrow: 1, justifyContent: 'center', paddingBottom: massEditMode ? 72 : 16}}
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

      {lineModalVisible && <ModalLineSelector
        visible={lineModalVisible}
        title={t('common:lineModalTitleMany')}
        message={t('common:lineModalMessageMany', { count: selectedItems.length })}
        onSelect={tagSelection}
        onSkip={() => setLineModalVisible(false)}
      />}
        <AnimationOptionsModal
        visible={animationOptionsModalVisible}
        itemCount={selectedItems.length}
        onClose={() => setAnimationOptionsModalVisible(false)}
        onSubmit={animateScans}
      />
    </View>
  );
}




