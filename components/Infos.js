import { View,  Text } from 'react-native';
import DateTimeLocation from './DateTimeLocation';
import { Image } from 'expo-image';

import * as SunCalc from 'suncalc'

import * as Location from 'expo-location';
import { useCallback, useContext, useEffect, useState } from 'react';
import AppContext from './AppContext';
import { useFocusEffect } from '@react-navigation/native';
import SunGraph from './SunGraph';
import { useTranslation } from 'react-i18next';

export default function Infos({isFocused}) {
  const { t, i18n } = useTranslation();
  const myContext = useContext(AppContext);
  const [location, setLocation] = useState(null);
  const [geoCode, setGeoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sunTimes, setSunTimes] = useState({});
  const [sunPositions, setSunPositions] = useState({});
 
  useFocusEffect(
    useCallback(() => {
    async function fetchData()  {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        setLocation(location);
        
        let geocode = await Location.reverseGeocodeAsync({longitude:location.coords.longitude, latitude:location.coords.latitude});
        setGeoCode(geocode ? geocode[0].city:'');

        setSunTimes(SunCalc.getTimes(new Date(), location?.coords.latitude, location?.coords.longitude));
        setSunPositions(SunCalc.getPosition(new Date(), location?.coords.latitude, location?.coords.longitude));
      }
    }
    setTimeout(fetchData,500);  
  }, [location, geoCode]));
 

  const convertDDToDMS = (D) =>{
    return D ? ['0'|D, '°', 0|(D=(D<0?-D:D)+1e-4)%1*60, "'", 0|D*60%1*60, '"'].join(''):'';
  }


  return (location && sunTimes?.sunset != undefined && <View className="rounded-lg bg-zinc-700/80 p-4 flex flex-col align-center space-y-4 items-center justify-between" >
   
      <DateTimeLocation city={geoCode} />
      <View className="flex flex-row items-center space-x-4 w-full">

          <View className="mb-4 self-start">
          {myContext.observer && <View className="flex flex-row my-4"><Text className="text-slate-400 text-xs">{t('common:observer')} : </Text><Text className="text-slate-400 text-xs font-bold">{myContext?.observer}</Text></View>}
            <Text className="text-slate-400 text-xs ">{t('common:longitude')} : {convertDDToDMS(location?.coords.longitude)}</Text>
            <Text className="text-slate-400 text-xs">{t('common:latitude')} :  {convertDDToDMS(location?.coords.latitude)}</Text>
            <Text className="text-slate-400 text-xs">{t('common:altitude')} :  {location?.coords.altitude.toFixed(0)} m</Text>
          
       
          </View>

          <View className="flex flex-col items-center align-center">
            <View className="absolute right-0 flex flex-col items-end justify-end">

            <Text className="text-white text-md font-bold">{t('common:sun')}</Text>
            <Text className=" text-white">Alt. {(sunPositions?.altitude * 180 / Math.PI).toFixed(0)}°</Text>
            </View>
            
            <View  className="flex flex-row justify-between items-center" >
              <SunGraph sunTimes={sunTimes} />
            </View>
            <View  className="flex flex-row justify-evenly space-x-12">
              <View className="flex flex-col justify-center items-center">
                <Text className="text-slate-400 text-xs">{t('common:sunrise')}</Text>
                <Text className="text-slate-300 font-bold">{sunTimes?.sunrise?.getHours().toString().padStart(2, '0') + ':' + sunTimes?.sunrise?.getMinutes().toString().padStart(2, '0')}</Text>
              </View>
              
              <View className="flex flex-col justify-center items-center">
                <Text className="text-slate-400 text-xs">{t('common:transit')}</Text>
                <Text className="text-slate-300 font-bold">{sunTimes?.solarNoon?.getHours().toString().padStart(2, '0') + ':' + sunTimes?.solarNoon?.getMinutes().toString().padStart(2, '0')}</Text>
              </View>

              <View className="flex flex-col justify-center items-center">
                <Text className="text-slate-400 text-xs">{t('common:sunset')}</Text>
                <Text className="text-slate-300 font-bold">{sunTimes?.sunset?.getHours().toString().padStart(2, '0') + ':' + sunTimes?.sunset?.getMinutes().toString().padStart(2, '0')}</Text>
              </View>
            </View>
          </View>
      </View>


    </View>)
}
