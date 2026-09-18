import { View,  Text, Pressable, StyleSheet } from 'react-native';
import DateTimeLocation from './DateTimeLocation';
import { Image } from 'expo-image';

import * as SunCalc from 'suncalc'

import { acquirePosition, reverseGeocode } from '../utils/Position';
import { useCallback, useContext, useEffect, useState } from 'react';
import AppContext from './AppContext';
import { useFocusEffect } from '@react-navigation/native';
import SunGraph, { GRAPH_WIDTH } from './SunGraph';
import { useTranslation } from 'react-i18next';
import { set } from 'lodash';
import { panelStyle, PANEL_WIDTH } from './theme';
// Shared with the scan assistant, so both pick the same kind of instant offline
import { randomDaytime } from '../utils/SolarGeometry';

// hh:mm, zero padded
const formatHM = (d) =>
  d ? `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}` : '';

// One cell of the strip under the graph : micro label above, value below.
const Stat = ({ label, value }) => (
  <View className="flex-1 items-center px-1">
    <Text className="text-slate-500 uppercase" style={{ fontSize: 10, letterSpacing: 0.8 }}>{label}</Text>
    <Text className="text-slate-200 text-sm font-bold">{value}</Text>
  </View>
);

// Separates the times from the coordinates inside the strip
const CellDivider = () => (
  <View style={{ width: StyleSheet.hairlineWidth, height: 26, backgroundColor: 'rgba(255,255,255,0.12)' }} />
);

export default function Infos({isFocused}) {
  const { t, i18n } = useTranslation();
  const myContext = useContext(AppContext);
  const [location, setLocation] = useState(null);
  const [geoCode, setGeoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sunTimes, setSunTimes] = useState({});
  const [sunPositions, setSunPositions] = useState({});
  // Non null only in offline mode : the fake "now" the graph and the altitude use
  const [simulatedNow, setSimulatedNow] = useState(null);

  const fetchData = async () => {
    const result = await acquirePosition();
    if (result.status !== 'ok') {
      return;
    }
    const { location } = result;
    // Stored before the geocoding, which needs the network and is usually
    // unavailable on the SunScan hotspot : the ephemeris only needs the fix.
    setLocation(location);
    myContext.setLocationData({ location, geocode: null });

    const geocode = await reverseGeocode(location);
    if (geocode?.length) {
      setGeoCode(geocode[0].city ?? '');
      myContext.setLocationData({ location, geocode });
    }
  }

  // Calculate sun times and positions using SunCalc library
  const computeEphemeris = async () => {
    const times = SunCalc.getTimes(new Date(), location?.coords.latitude, location?.coords.longitude);
    const now = myContext.demo ? randomDaytime(times) : null;
    setSimulatedNow(now);
    setSunTimes(times);
    setSunPositions(SunCalc.getPosition(now ?? new Date(), location?.coords.latitude, location?.coords.longitude));
  }
 
  // Effect hook that runs when the component gains focus
  // Fetches location data, performs reverse geocoding, and calculates sun times and positions
  useFocusEffect(
    useCallback(() => {
      if (myContext.locationData.location){
        setLocation(myContext.locationData.location);
        setGeoCode(myContext.locationData.geocode?.[0]?.city ?? '');
      }
    fetchData();
  }, [isFocused]));

  useEffect(() => {
    computeEphemeris();
  }, [location, myContext.demo])
 

  // Utility function to convert decimal degrees to degrees, minutes, seconds format
  const convertDDToDMS = (D) =>{
    return D ? ['0'|D, '°', 0|(D=(D<0?-D:D)+1e-4)%1*60, "'"].join(''):'';
  }


  // Render component
  return (sunTimes?.sunset != undefined && <View className="rounded-2xl bg-zinc-700/80 px-4 py-3 flex flex-col items-center space-y-2" style={[panelStyle, { width: PANEL_WIDTH }]}>
      <Pressable onPress={fetchData} className="w-full"><DateTimeLocation city={geoCode} /></Pressable>

      {/* The graph carries the panel : the numbers line up underneath it rather
          than sitting in a column of their own beside it. */}
      <View className="relative" style={{ width: GRAPH_WIDTH }}>
        <SunGraph sunTimes={sunTimes} now={simulatedNow} />
        <View className="absolute left-0 top-0">
          <Text className="text-slate-300 text-xs font-bold uppercase">{t('common:sun')}</Text>
          {simulatedNow && (
            <Text className="text-amber-400 text-xs">{formatHM(simulatedNow)}</Text>
          )}
        </View>
        <View className="absolute right-0 top-0 items-end">
          <View className="flex flex-row items-end space-x-1">
            <Text className="text-slate-400 text-xs">Alt.</Text>
            <Text className="text-white text-lg font-bold leading-5">{(sunPositions?.altitude * 180 / Math.PI).toFixed(0)}°</Text>
          </View>
          <Text className="text-slate-400 text-xs">Az. {((sunPositions?.azimuth * 180 / Math.PI + 180 + 360) % 360).toFixed(0)}°</Text>
        </View>
      </View>

      {/* Times on the left, place on the right, one row */}
      <View className="flex flex-row items-center border-t border-white/10 pt-2" style={{ width: GRAPH_WIDTH }}>
        <Stat label={t('common:sunrise')} value={formatHM(sunTimes?.sunrise)} />
        <Stat label={t('common:transit')} value={formatHM(sunTimes?.solarNoon)} />
        <Stat label={t('common:sunset')} value={formatHM(sunTimes?.sunset)} />
        <CellDivider />
        <Stat label="Lon" value={convertDDToDMS(location?.coords.longitude)} />
        <Stat label="Lat" value={convertDDToDMS(location?.coords.latitude)} />
        {/* altitude is null on some fixes, hence the guard rather than a crash */}
        <Stat label="Alt" value={location?.coords?.altitude != null ? `${location.coords.altitude.toFixed(0)} m` : '—'} />
      </View>
    </View>)
}
