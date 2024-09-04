import { View, Text } from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useState } from 'react';

export default function DateTimeLocation({city}) {
  const [date, setDate] = useState(null);
  useEffect(() => {
    const interval =  setInterval(()=>setDate(new Date().toLocaleString()), 1000);
    return () => clearInterval(interval);
  }, [useState]);
  return (
    <View className="flex flex-col justify-between w-full border-b pb-2 border-slate-500">
      <View className="flex flex-row justify-between">
          <View className="flex flex-row items-center space-x-2">
              <View><Ionicons name="location-sharp" size={16} color="white"  /></View>   
              <Text className="text-white font-bold">{city}</Text> 
          </View>
          <View className="flex flex-row items-center space-x-2">
              <Text className="text-white text-right font-bold">{ date }</Text>
              <View><Ionicons name="time" size={16} color="white"  /></View>   
          </View>
          
      </View>
  

    </View>

 
  );
}
