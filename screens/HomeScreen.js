import React from 'react';
import { StyleSheet, View, ImageBackground } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NativeWindStyleSheet } from "nativewind";

// Configure NativeWind to output styles for native platforms
NativeWindStyleSheet.setOutput({
  default: "native",
});

import Infos from '../components/Infos';
import Status from '../components/Status';
import Reveal from '../components/Reveal';
import { useIsFocused } from '@react-navigation/native';

// Main HomeScreen component
export default function HomeScreen({navigation}) {
  // Reactive focus flag: navigation.isFocused() below is a one-off read, fine for
  // the refetch effects, but the reveal needs to re-run on every focus change.
  const isFocused = useIsFocused();

  return (
    // Main container with dark background
    <View className="flex flex-col bg-zinc-900 h-full">
      {/* Background image container */}
      <ImageBackground className="flex flex-col h-full items-center" source={require("../assets/bg.png")}>
        {/* Content wrapper */}
        <View  className="flex flex-col justify-between items-center">
          {/* Inner content container */}
          <View className="p-4 grow flex flex-col justify-center items-center">
            {/* Status component */}
            <Reveal active={isFocused} delay={120} style={{padding:8}}><Status isFocused={navigation.isFocused()}/></Reveal>
            {/* Infos component */}
            <Reveal active={isFocused} delay={340} style={{padding:8}}><Infos isFocused={navigation.isFocused()}/></Reveal>
          </View> 
        </View>
      </ImageBackground>
    </View>
  );
}

// StyleSheet for additional styles (currently unused)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  image: {
    flex:1,
    resizeMode: 'scale',
    justifyContent: 'top',
  },
  text: {
    color: 'white',
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#000000',
  },
});


