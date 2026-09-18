import { Modal, View, Text, Pressable, StyleSheet, Switch, TextInput, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import SunscanLoader from './SunscanLoader';
import { t } from 'i18next';
import react, { useContext } from 'react';
import ReactNativeSegmentedControlTab from 'react-native-segmented-control-tab';
import { ScrollView } from 'react-native-gesture-handler';
import CustomNumericInput from './CustomNumericInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppContext from './AppContext';
import PressableScale from './PressableScale';
import ProcessingSteps from './ProcessingSteps';
import { modalBackdrop, modalCard, roundButton } from './theme';
import { errorTranslationKey } from '../utils/useScanProcess';


// Component for processing scans
export default function ProcessScan({ processMethod, isStarted, percent = null, step = null, errorKey = null, isVisible, onClose }) {

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
    // `isStarted` is owned by the caller's useScanProcess and flips on its own.
    processMethod(options);
  };

  // Styles
  const styles = StyleSheet.create({
    centeredView: modalBackdrop,
    modalView: {
      ...modalCard,
      margin: 20,
      width: "62%",
      maxHeight: '88%',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
    },
    title: {
      color: '#fff',
      fontSize: 16,
    },
  });

  const stylesTab = StyleSheet.create({
    tabsContainerStyle: {
      borderColor: '#52525b',
    },
    tabStyle: {
      backgroundColor: 'rgb(39 39 42)',
      borderColor: '#52525b',
    },
    tabTextStyle: {
      color: '#a1a1aa',
      fontSize: 12,
    },
    // Emerald rather than a white block: same accent as every other selected
    // state in the app, and far less glaring on a dark surface.
    activeTabStyle: {
      backgroundColor: '#059669',
      borderColor: '#059669',
    },
    activeTabTextStyle: {
      color: '#fff'
    },
  });

  const levels = [t('common:Off'), t('common:Low'), t('common:Medium'), t('common:High')];
  const dopplerColorValues = [t('common:orangeblue'), t('common:redblue')];

  return (
    <SafeAreaView>
      <Modal animationType="fade" transparent={true} visible={isVisible} supportedOrientations={['landscape']}>
        <View style={styles.centeredView}>
          <View style={styles.modalView} className="flex flex-col">
            {/* Header: title on the left, close button on the right */}
            <View className="flex flex-row items-center justify-between w-full pb-3" style={{borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:'rgba(255,255,255,0.10)'}}>
              <Text className="text-white font-bold" style={{fontSize:15}}>{t('common:advancedProcessing')}</Text>
              <PressableScale scaleTo={0.88} onPress={onClose} style={roundButton}>
                <MaterialIcons name="close" color="#fff" size={18} />
              </PressableScale>
            </View>

            <ScrollView className="w-full">
              {!isStarted ? (
                <View className="pt-3">
                  {/* Toggles grouped in a card, label left / switch right */}
                  <View className="rounded-xl bg-zinc-800 px-3 mb-3" style={{borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.08)'}}>
                    <View className="flex flex-row items-center justify-between w-full py-2">
                      <Text className="text-white text-xs">{t('common:doppler')}</Text>
                      <Switch
                        trackColor={{ false: '#767577', true: 'rgb(5 150 105)' }}
                        thumbColor="#fff"
                        value={context.processDoppler}
                        onValueChange={context.setProcessDoppler}
                        style={{
                          marginVertical: Platform.OS === 'android' ? -6 : 4,
                        }}
                      />
                    </View>

                    <View className="flex flex-row items-center justify-between w-full py-2" style={{borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:'rgba(255,255,255,0.08)'}}>
                      <Text className="text-white text-xs">{t('common:helium')}</Text>
                      <Switch
                        trackColor={{ false: '#767577', true: 'rgb(5 150 105)' }}
                        thumbColor="#fff"
                        value={advancedMode === 'heI'}
                        onValueChange={() => setAdvancedMode(advancedMode === 'heI' ? '' : 'heI')}
                        style={{
                          marginVertical: Platform.OS === 'android' ? -6 : 4,
                        }}
                      />
                    </View>

                    <View className="flex flex-row items-center justify-between w-full py-2" style={{borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:'rgba(255,255,255,0.08)'}}>
                      <Text className="text-white text-xs">{t('common:advancedProcessingOptions')}</Text>
                      <Switch
                        trackColor={{ false: '#767577', true: 'rgb(5 150 105)' }}
                        thumbColor="#fff"
                        value={displayOptions}
                        onValueChange={() => setDisplayOptions(!displayOptions)}
                        style={{
                          marginVertical: Platform.OS === 'android' ? -6 : 4,
                        }}
                      />
                    </View>
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
                          selectedIndex={parseInt(context.dopplerColor)}
                          onTabPress={context.setDopplerColor}
                        />
                      </View>
                    </View>
                  )}

                  {/* What went wrong last time, so the user is not sent back to
                      the same settings with no idea why they failed. */}
                  {errorKey !== null && (
                    <View className="rounded-xl bg-zinc-800 px-3 py-2 mb-2 flex flex-row items-center space-x-2" style={{borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(245,158,11,0.4)'}}>
                      <Ionicons name="warning-outline" size={16} color="#f59e0b" />
                      <Text className="text-amber-500 flex-1" style={{fontSize:11}}>{t(errorTranslationKey(errorKey))}</Text>
                    </View>
                  )}

                  {/* Primary action: emerald, so it reads as the way out of the dialog */}
                  <PressableScale
                    className="w-full bg-emerald-600 rounded-xl h-12 flex flex-row justify-center items-center space-x-2 mb-1"
                    onPress={handleProcess}
                  >
                    <Ionicons name="caret-forward-outline" size={18} color="white" />
                    <Text className="text-white font-bold" style={{fontSize:13}}>{t('common:startProcessing')}</Text>
                  </PressableScale>
                </View>
              ) : (
                <View className="mt-2 flex flex-col justify-center items-center w-full">
                  <SunscanLoader size={72} />
                  <ProcessingSteps percent={percent} step={step} />
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
