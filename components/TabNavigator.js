import * as React from 'react';
import { Text, Pressable, View, StyleSheet } from 'react-native';
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
  

import HomeSVG from './svg/HomeSVG';
import IrisSVG from './svg/IrisSVG';
import GallerySVG from './svg/GallerySVG';
import SettingsSVG from './svg/SettingsSVG';


export default function TabNavigator({
  initialRouteName,
  children,
  screenOptions,
  tabBarStyle,
  contentStyle,
}) {
  const { state, navigation, descriptors, NavigationContent } =
    useNavigationBuilder(TabRouter, {
      children,
      screenOptions,
      initialRouteName,
    });
const screenName = state.routes[state.index].name
  return (
    <NavigationContent>
        <View className="flex-1 flex flex-row" style={{zIndex:99, elevation:99}}>
                <View  className="  flex-0 w-14 bg-black  py-2 flex flex-col justify-evenly align-center items-center" style={{zIndex:99, elevation:99}} >
                <View  className={screenName == "Home" ? "border-l-white border-2 pl-1":"border-l-black border-2 pl-1"}>
                    <Pressable onPress={() =>navigation.navigate('Home') } className="flex flex-col justify-center items-center w-12">
                    <HomeSVG color="white" size="32"  />
                    </Pressable>
                </View>

                <View className={screenName == "Scan" ? "border-l-white border-2 pl-1":"border-l-black border-2 pl-1"}>
                    <Pressable onPress={() =>navigation.navigate('Scan') } className="flex flex-col justify-center items-center w-12">
                    <IrisSVG color="white" size="32"  />
                    </Pressable>
                </View>

                <View className={screenName == "List" ? "border-l-white border-2 pl-1":"border-l-black border-2 pl-1"}>
                <Pressable onPress={() =>navigation.navigate('List') } className="flex flex-col justify-center items-center w-12">
                <GallerySVG color="white" size="32"  />
                    </Pressable>
                </View>

                <View className={screenName == "Settings" ? "border-l-white border-2 pl-1":"border-l-black border-2 pl-1"}>
                <Pressable onPress={() =>navigation.navigate('Settings') } className="flex flex-col justify-center items-center w-12">
                <SettingsSVG color="white" size="32"  />
                    </Pressable>
                </View>
                </View>
            
            <View  className="grow">
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