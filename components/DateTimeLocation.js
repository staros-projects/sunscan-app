import { View, Text } from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useState } from 'react';

// Component to display date, time, and location
export default function DateTimeLocation({city}) {
  // State to store the current date and time
  const [date, setDate] = useState(null);

  useEffect(() => {
    // Update the date every second
    const interval = setInterval(() => setDate(new Date().toLocaleString()), 1000);
    // Clean up the interval on component unmount
    return () => clearInterval(interval);
  }, []);  // Empty dependency array, as we want this effect to run only once

  return (
    <View className="flex flex-col justify-between w-full border-b pb-2 border-slate-500">
      <View className="flex flex-row justify-between">
          {/* City display */}
          <View className="flex flex-row items-center space-x-2">
              <View><Ionicons name="location-sharp" size={16} color="white" /></View>   
              <Text className="text-white font-bold">{city}</Text> 
          </View>
          {/* Date and time display */}
          <View className="flex flex-row items-center space-x-2">
              <Text className="text-white text-right font-bold">{date}</Text>
              <View><Ionicons name="time" size={16} color="white" /></View>   
          </View>
      </View>
    </View>
  );
}
