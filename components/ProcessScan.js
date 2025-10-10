import { Modal, View, Text, Pressable, StyleSheet, Switch, TextInput } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import Loader from '../components/Loader';
import { t } from 'i18next';
import react, { useContext } from 'react';
import ReactNativeSegmentedControlTab from 'react-native-segmented-control-tab';
import { ScrollView } from 'react-native-gesture-handler';
import CustomNumericInput from './CustomNumericInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppContext from './AppContext';

// Component for processing scans
export default function ProcessScan({ processMethod, isStarted, setIsStarted, isVisible, onClose }) {

  const [noiseReduction, setNoiseReduction] = react.useState(false);
  const [continuumSharpenLevel, setContinuumSharpenLevel] = react.useState(2);
  const [protusSharpenLevel, setProtuSharpenLevel] = react.useState(1);
  const [surfaceSharpenLevel, setSurfaceSharpenLevel] = react.useState(2);
  const [displayOptions, setDisplayOptions] = react.useState(false);
  const [dopplerShift, setDopplerShift] = react.useState(5);
  const [continuumShift, setContinuumShift] = react.useState(16);
  const [offset, setOffset] = react.useState(0);
  const [advancedMode, setAdvancedMode] = react.useState('');

  const context = useContext(AppContext);

  const buildProcessOptions = () => ({
    dopplerShift,
    continuumShift,
    noiseReduction,
    continuumSharpenLevel,
    protusSharpenLevel,
    surfaceSharpenLevel,
    offset,
    advancedMode,
    dopplerColor: context.dopplerColor,
    processDoppler: context.processDoppler,
  });

  const handleProcess = () => {
    const options = buildProcessOptions();
    processMethod(options);
    setIsStarted(true);
  };

  // Styles
  const styles = StyleSheet.create({
    centeredView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 0,
    },
    modalView: {
      margin: 20,
      width: "60%",
      backgroundColor: 'rgba(80,80,80,0.9)',
      borderRadius: 20,
      padding: 10,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    title: {
      color: '#fff',
      fontSize: 16,
    },
  });

  const stylesTab = StyleSheet.create({
    tabsContainerStyle: {
      borderColor: '#fff',
    },
    tabStyle: {
      backgroundColor: 'rgb(63 63 70)',
      borderColor: '#888888',
    },
    tabTextStyle: {
      color: '#ffffff',
      fontSize: 12,
    },
    activeTabStyle: {
      backgroundColor: '#fff',
    },
    activeTabTextStyle: {
      color: '#000'
    },
  });

  const levels = [t('common:Off'), t('common:Low'), t('common:Medium'), t('common:High')];
  const dopplerColorValues = [t('common:orangeblue'), t('common:redblue')];

  return (
    <SafeAreaView>
      <Modal animationType="fade" transparent={true} visible={isVisible} supportedOrientations={['landscape']}>
        <View style={styles.centeredView}>
          <View style={styles.modalView} className="flex flex-col">
            {/* Close button */}
            <View className="absolute top-0 right-0 z-50 mx-4 mt-4">
              <Pressable onPress={onClose}>
                <MaterialIcons name="close" color="#fff" size={22} />
              </Pressable>
            </View>

            {/* Title */}
            <Text className="mt-1 text-white font-bold">{t('common:advancedProcessing')}</Text>

            <ScrollView className="w-full">
              {!isStarted ? (
                <View>
                  <View className="flex flex-row items-center">
                    <Text className="text-white text-xs">{t('common:doppler')}</Text>
                    <Switch
                      trackColor={{ false: '#767577', true: 'rgb(5 150 105)' }}
                      thumbColor="#fff"
                      value={context.processDoppler}
                      onValueChange={context.setProcessDoppler}
                     style={{
                        marginVertical: -6,
                      }}
                    />
                  </View>

                  <View className="flex flex-row items-center">
                    <Text className="text-white text-xs">{t('common:helium')}</Text>
                    <Switch
                      trackColor={{ false: '#767577', true: 'rgb(5 150 105)' }}
                      thumbColor="#fff"
                      value={advancedMode === 'heI'}
                      onValueChange={() => setAdvancedMode(advancedMode === 'heI' ? '' : 'heI')}
                                        style={{
                        marginVertical: -6,
                      }}
                    />
                  </View>

                  <View className="flex flex-row items-center">
                    <Text className="text-white text-xs">{t('common:advancedProcessingOptions')}</Text>
                    <Switch
                      trackColor={{ false: '#767577', true: 'rgb(5 150 105)' }}
                      thumbColor="#fff"
                      value={displayOptions}
                      onValueChange={() => setDisplayOptions(!displayOptions)}
                                        style={{
                        marginVertical: -6,
                      }}
                    />
                  </View>

                  {displayOptions && (
                    <View className="flex flex-col space-y-1 rounded-xl p-3 bg-zinc-800 mb-2">
                      <View className="flex flex-row items-start space-x-2">
                        <View className="flex flex-col items-center space-y-2">
                          <View className="flex flex-row items-center space-x-2">
                            <Text className="text-white text-xs w-32">{t('common:dopplerShift')}</Text>
                            <CustomNumericInput minValue={0} maxValue={40} value={dopplerShift} onChange={setDopplerShift} />
                          </View>
                          <View className="flex flex-row items-center space-x-2">
                            <Text className="text-white text-xs w-32">{t('common:continuumShift')}</Text>
                            <CustomNumericInput minValue={-40} maxValue={40} value={continuumShift} onChange={setContinuumShift} />
                          </View>
                        </View>
                        <View className="flex flex-row items-center space-x-2">
                          <Text className="text-white text-xs mr-4">{t('common:offset')}</Text>
                          <CustomNumericInput minValue={-80} maxValue={80} value={offset} onChange={setOffset} />
                        </View>
                      </View>

                      {/* Levels */}
                      <View className="flex flex-col space-x-2">
                        <Text className="text-white text-xs mb-2">{t('common:surfaceSharpenLevel')}</Text>
                        <ReactNativeSegmentedControlTab
                          tabsContainerStyle={stylesTab.tabsContainerStyle}
                          tabStyle={stylesTab.tabStyle}
                          tabTextStyle={stylesTab.tabTextStyle}
                          activeTabStyle={stylesTab.activeTabStyle}
                          activeTabTextStyle={stylesTab.activeTabTextStyle}
                          values={levels}
                          selectedIndex={surfaceSharpenLevel}
                          onTabPress={setSurfaceSharpenLevel}
                        />
                      </View>

                      <View className="flex flex-col space-x-2">
                        <Text className="text-white text-xs mb-2">{t('common:continuumSharpenLevel')}</Text>
                        <ReactNativeSegmentedControlTab
                          tabStyle={stylesTab.tabStyle}
                          tabTextStyle={stylesTab.tabTextStyle}
                          activeTabStyle={stylesTab.activeTabStyle}
                          activeTabTextStyle={stylesTab.activeTabTextStyle}
                          values={levels}
                          selectedIndex={continuumSharpenLevel}
                          onTabPress={setContinuumSharpenLevel}
                        />
                      </View>

                      <View className="flex flex-col space-x-2">
                        <Text className="text-white text-xs mb-2">{t('common:protusSharpenLevel')}</Text>
                        <ReactNativeSegmentedControlTab
                          tabStyle={stylesTab.tabStyle}
                          tabTextStyle={stylesTab.tabTextStyle}
                          activeTabStyle={stylesTab.activeTabStyle}
                          activeTabTextStyle={stylesTab.activeTabTextStyle}
                          values={levels}
                          selectedIndex={protusSharpenLevel}
                          onTabPress={setProtuSharpenLevel}
                        />
                      </View>

                      <View className="flex flex-col space-x-2">
                        <Text className="text-white text-xs mb-2">{t('common:dopplerColor')}</Text>
                        <ReactNativeSegmentedControlTab
                          tabStyle={stylesTab.tabStyle}
                          tabTextStyle={stylesTab.tabTextStyle}
                          activeTabStyle={stylesTab.activeTabStyle}
                          activeTabTextStyle={stylesTab.activeTabTextStyle}
                          values={dopplerColorValues}
                          selectedIndex={context.dopplerColor}
                          onTabPress={context.setDopplerColor}
                        />
                      </View>
                    </View>
                  )}

                  <Pressable
                    className="w-40 bg-zinc-800 p-2 rounded-md h-12 text-white text-center flex flex-row justify-center items-center space-x-2"
                    onPress={handleProcess}
                  >
                    <Ionicons name="caret-forward-outline" size={18} color="white" />
                    <Text className="text-white text-xs">{t('common:startProcessing')}</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="mt-4 bg-zinc-800 p-2 rounded-md h-12 text-white text-center flex justify-center items-center">
                  <Loader type="white" />
                </View>
              )}

              <Text className="text-xs my-2 text-gray-200 italic">{t('common:pleaseWait')}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
