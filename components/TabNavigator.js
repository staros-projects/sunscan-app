import * as React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Dimensions, Pressable, View, StyleSheet, Button, Text, PanResponder } from 'react-native';
import { OrthographicCamera } from '@react-three/drei/native';
import {
    createNavigatorFactory,
    DefaultNavigatorOptions,
    ParamListBase,
    CommonActions,
    TabActionHelpers,
    TabNavigationState,
    TabRouter,
    TabRouterOptions,
    useNavigationBuilder,
  } from '@react-navigation/native';
  
// Import SVG components for tab icons
import HomeSVG from './svg/HomeSVG';
import IrisSVG from './svg/IrisSVG';
import GallerySVG from './svg/GallerySVG';
import SettingsSVG from './svg/SettingsSVG';
import AppContext from './AppContext';
import { Image } from 'expo-image';

import { Zoomable } from '@likashefqet/react-native-image-zoom';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SunSphere from './SunSphere';
import { Canvas } from '@react-three/fiber';


import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useDerivedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import SmoothCamera from './SmoothCamera';
import { FrameProbe } from './RootFrame';


const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Sidebar tabs, in display order
const TABS = [
  { name: 'Home', Icon: HomeSVG },
  { name: 'Scan', Icon: IrisSVG },
  { name: 'List', Icon: GallerySVG },
  { name: 'Settings', Icon: SettingsSVG },
];

// Sidebar tab styles.
//
// The active indicator and the icon highlight stay mounted with a fixed
// background and borderRadius; only their opacity and scale are animated. That
// also sidesteps an Android quirk where a view that already has a borderRadius
// loses its rounded corners when its background colour is repainted after mount
// (the highlight turned into a square as soon as you switched tabs).
const tabStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  indicatorSlot: {
    width: 3,
    height: 24,
    marginRight: 5,
  },
  indicatorBar: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// One sidebar tab. The active/inactive change is driven by a single 0->1
// progress value so the highlight, the indicator bar and the icon colour all
// move together; the icon "colour change" is really a cross-fade between a grey
// and a white copy, since an SVG fill cannot be animated on the UI thread.
function TabItem({Icon, active, onPress}) {
  const progress = useDerivedValue(
    () => withTiming(active ? 1 : 0, {duration: 200}),
    [active]
  );
  const scale = useSharedValue(1);

  const itemStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{scaleY: 0.4 + progress.value * 0.6}],
  }));
  const highlightStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{scale: 0.75 + progress.value * 0.25}],
  }));
  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.88, {damping: 20, stiffness: 400, mass: 0.5}); }}
      onPressOut={() => { scale.value = withSpring(1, {damping: 20, stiffness: 400, mass: 0.5}); }}
      style={[tabStyles.item, itemStyle]}
    >
      {/* Active indicator: rounded accent bar instead of a square border */}
      <View style={tabStyles.indicatorSlot}>
        <Animated.View style={[tabStyles.indicatorBar, indicatorStyle]} />
      </View>
      <View style={tabStyles.icon}>
        <Animated.View style={[tabStyles.iconHighlight, highlightStyle]} pointerEvents="none" />
        <Icon color="#71717a" size={26} width={26} height={26} />
        <Animated.View style={[tabStyles.iconLayer, activeIconStyle]} pointerEvents="none">
          <Icon color="#ffffff" size={26} width={26} height={26} />
        </Animated.View>
      </View>
    </AnimatedPressable>
  );
}

// Main TabNavigator component
export default function TabNavigator({
  initialRouteName,
  children,
  screenOptions,
  tabBarStyle,
  contentStyle,
}) {
    const { t, i18n } = useTranslation();

  // Use the navigation builder hook to create the tab navigation
  const { state, navigation, descriptors, NavigationContent } =
    useNavigationBuilder(TabRouter, {
      children,
      screenOptions,
      initialRouteName,
    });

    const sunRef = React.useRef();

  // Get the current screen name
  const screenName = state.routes[state.index].name;
  const myContext = React.useContext(AppContext);

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

    const insets = useSafeAreaInsets();
const cameraRef = React.useRef();



  return (
    <NavigationContent >

      {myContext.displayFullScreen3d !== '' && <View className="absolute bg-black w-full h-full" style={{zIndex:100, elevation:100}}>
        <Pressable className="absolute right-0 top-0 p-4" style={{zIndex:102, elevation:102, paddingRight:insets.right}} onPress={()=>{ myContext.setDisplayFullScreen3d('');  }}><MaterialIcons name="close" color="#fff" size={22} /></Pressable>
                            <View style={{ flex: 1 }}>
                                                    
    
              {/* pointerEvents none : le Canvas R3F installe un PanResponder qui capture toutes les touches, inutile ici (gyroscope + boutons) et en conflit avec gesture-handler sur iOS */}
              <View style={{ flex: 1 }} pointerEvents="none">
              <Canvas>

                <ambientLight intensity={0.1} />

                {/* On passe zoomScale comme prop à SunSphere */}
                <SunSphere
                  ref={sunRef}
                  textureUri={myContext.displayFullScreen3d}
                />
                 <SmoothCamera ref={cameraRef} initialZoom={150} />
              </Canvas>
              </View>
      
{/* Boutons Zoom */}
  <View className="absolute bottom-10 right-5 flex flex-row gap-3" style={{zIndex:102, elevation:102, paddingRight:insets.right}}>
      <Pressable
     
      onPress={() => cameraRef.current?.zoomOut()}
    >
      <Ionicons name="remove-circle" size={34} color="white" />
    </Pressable>
    <Pressable

      onPress={() => cameraRef.current?.zoomIn()}
    >
      <Ionicons name="add-circle" size={34} color="white" />
    </Pressable>
  
  </View>
                                <Pressable className="absolute p-10 bottom-0 flex flex-row gap-1 items-center" onPress={() => {sunRef.current?.resetRotation(); cameraRef.current?.resetZoom()}}><Ionicons name="refresh" size={24} color="white" /><Text className="text-white">{t('common:resetView')}</Text></Pressable>
                           
                    </View></View>}
        {myContext.displayFullScreenImage !== '' && <View className="absolute bg-black w-full h-full" style={{zIndex:100, elevation:100}}>
                  <Pressable className="absolute right-0 top-0 p-4" style={{zIndex:102, elevation:102, paddingRight:insets.right}} onPress={()=>{ myContext.setDisplayFullScreenImage('');  }}><MaterialIcons name="close" color="#fff" size={22} /></Pressable>
                        {/* Image zoom component */}
                         <Zoomable
                        isSingleTapEnabled
                        isDoubleTapEnabled
                        
                            >
                              <Image
                                style={styles.image}
                                source={myContext.displayFullScreenImage}
                                contentFit='contain'
                              />
                        </Zoomable>
                </View>}
        <View className="flex-1 flex flex-row bg-black" style={{zIndex:99, elevation:99, backgroundColor: '#000'}}>
                {/* Sidebar navigation */}
                <View  className="  flex-0  bg-black  py-2 flex flex-col justify-evenly align-center items-center" style={{zIndex:99, elevation:99, backgroundColor: '#000', paddingLeft:insets.left, paddingRight:0, borderRightWidth:StyleSheet.hairlineWidth, borderRightColor:'rgba(255,255,255,0.12)'}} >
                {TABS.map(({name, Icon}) => (
                  <TabItem
                    key={name}
                    Icon={Icon}
                    active={screenName === name}
                    onPress={() => navigation.navigate(name)}
                  />
                ))}
                </View>
            {/* Content area */}
            <View  className="grow">
            {/* Render the current screen */}
            {state.routes.map((route, i) => {
                return (
                <View
                    key={route.key}
                    style={[
                        StyleSheet.absoluteFill,
                    { display: i === state.index ? 'flex' : 'none' },
                    ]}
                >
                    {descriptors[route.key].render()}
                </View>
                );
            })}
            </View>
            {/* Size of this row in the debug readout, see RootFrame */}
            <FrameProbe name="nav" />
        </View>
    </NavigationContent>
  );
}