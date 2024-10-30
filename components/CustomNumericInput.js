import React, { useRef, useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons'

export default function CustomNumericInput({value, minValue, maxValue, onChange}) {
  const [v, setV] = React.useState(value);

  const addValue = () => {
    if (v < maxValue) {
      setV(v + 1);
    } 
  };

  const minusValue = () => {
    if (v > minValue) {
      setV(v - 1);
    }
  };

  useEffect(() => {
    onChange(v);
  }, [v]);
  
  return (
  <View className="flex flex-row justify-center items-center border border-zinc-500 rounded-lg">
    <Pressable className="bg-zinc-700 rounded-l-lg px-1" onPress={minusValue}><Ionicons name="remove-outline" size={24} color="white" /></Pressable>
      <Text className="text-white px-2 w-10 text-xs center text-center">{v}</Text>
      <Pressable className="bg-zinc-700 rounded-r-lg px-1" onPress={addValue}><Ionicons name="add-outline" size={24} color="white" /></Pressable>
    </View>
  );
}