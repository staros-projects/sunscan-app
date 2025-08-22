import * as React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Dimensions, Pressable, View, StyleSheet, Button, Text } from 'react-native';
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


  return (


    <NavigationContent>

      {myContext.displayFullScreen3d !== '' && <View className="absolute bg-black w-full h-full" style={{zIndex:100, elevation:100}}>
        <Pressable className="absolute right-0 top-0 p-4" style={{zIndex:102, elevation:102}} onPress={()=>{ myContext.setDisplayFullScreen3d('');  }}><MaterialIcons name="close" color="#fff" size={22} /></Pressable>
                            <View style={{ flex: 1 }}>
                                                      <Canvas  >
                                                        <OrthographicCamera
                                                          makeDefault
                                                          position={[0, 0, 3]}  // Place la caméra diagonalement pour effet iso
                                                          zoom={130}             // Zoom pour ajuster la taille de la sphère
                                                          near={0.1}
                                                          far={200}
                                                        />
                                  <ambientLight intensity={0.1} />
                                  
                                  <SunSphere ref={sunRef} textureUri={myContext.displayFullScreen3d} /> 
                                </Canvas>
                                <Pressable className="absolute p-10 bottom-0 flex flex-row gap-1 items-center" onPress={() => {sunRef.current?.resetRotation()}}><Ionicons name="refresh" size={24} color="white" /><Text className="text-white">{t('common:resetView')}</Text></Pressable>
                           
                    </View></View>}
        {myContext.displayFullScreenImage !== '' && <View className="absolute bg-black w-full h-full" style={{zIndex:100, elevation:100}}>
                  <Pressable className="absolute right-0 top-0 p-4" style={{zIndex:102, elevation:102}} onPress={()=>{ myContext.setDisplayFullScreenImage('');  }}><MaterialIcons name="close" color="#fff" size={22} /></Pressable>
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
        <View className="flex-1 flex flex-row" style={{zIndex:99, elevation:99, paddingLeft:insets.left, paddingRight:insets.right, backgroundColor:'#000'}}>
                {/* Sidebar navigation */}
                <View  className="  flex-0 w-14 bg-black  py-2 flex flex-col justify-evenly align-center items-center" style={{zIndex:99, elevation:99}} >
                {/* Home tab */}
                <View  className={screenName == "Home" ? "border-l-white border-2 pl-1":"border-l-black border-2 pl-1"}>
                    <Pressable onPress={() =>navigation.navigate('Home') } className="flex flex-col justify-center items-center w-12">
                    <HomeSVG color="white" size="32"  />
                    </Pressable>
                </View>
                {/* Scan tab */}
                <View className={screenName == "Scan" ? "border-l-white border-2 pl-1":"border-l-black border-2 pl-1"}>
                    <Pressable onPress={() =>navigation.navigate('Scan') } className="flex flex-col justify-center items-center w-12">
                    <IrisSVG color="white" size="32"  />
                    </Pressable>
                </View>
                {/* List tab */}
                <View className={screenName == "List" ? "border-l-white border-2 pl-1":"border-l-black border-2 pl-1"}>
                <Pressable onPress={() =>navigation.navigate('List') } className="flex flex-col justify-center items-center w-12">
                <GallerySVG color="white" size="32"  />
                    </Pressable>
                </View>
                {/* Settings tab */}
                <View className={screenName == "Settings" ? "border-l-white border-2 pl-1":"border-l-black border-2 pl-1"}>
                <Pressable onPress={() =>navigation.navigate('Settings') } className="flex flex-col justify-center items-center w-12">
                <SettingsSVG color="white" size="32"  />
                    </Pressable>
                </View>
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
        </View>
    </NavigationContent>
  );
}