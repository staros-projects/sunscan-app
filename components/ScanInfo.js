import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useContext, useState } from 'react';
import AppContext from './AppContext';
import { ScrollView } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

// Component for displaying detailed scan information in a modal
export default function ScanInfo({ isVisible, logs, currentImage, scan, onClose }) {
  const { t, i18n } = useTranslation();
  const myContext = useContext(AppContext);
  const [hideScrollToEnd, setHideScrollToEnd] = useState(false);
  const [hideScrollToTop, setHideScrollToTop] = useState(true);

  // Styles for the modal and its contents
  const styles = StyleSheet.create({
    centeredView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 0,
    },
    modalView: {
      margin: 50,
      backgroundColor: 'rgba(80,80,80,0.9)',
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    title: {
      color: '#fff',
      fontSize: 16,
    },
  });

  // Options for formatting the scan date
  let options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  };
  // Format the scan date using the locale from translations
  let scanDate = new Date(scan.creation_date*1000).toLocaleDateString(t('common:locale'), options);

  // Function to scroll to the end of the content
  const scrollToEnd = () => {
    this.scroll.scrollToEnd();
    setHideScrollToEnd(true);
    setHideScrollToTop(false);
  }
  
  // Function to scroll to the top of the content
  const scrollToTop = () => {
    this.scroll.scrollTo({x: 0, y: 0, animated: true})
    setHideScrollToEnd(false);
    setHideScrollToTop(true);
  }

  return (
    <Modal animationType="slide" transparent={true} visible={isVisible}>
      <View style={styles.centeredView}>
        <View style={styles.modalView} className="flex flex-col justify-center items-center">
          {/* Close button */}
          <View className="absolute top-0 right-0 z-50 mx-4 mt-4">
            <Pressable onPress={onClose}>
              <MaterialIcons name="close" color="#fff" size={22} />
            </Pressable>
          </View>
          
          {/* Scroll to top button */}
          <View>
            {!hideScrollToTop && <Pressable onPress={()=>scrollToTop()}><Ionicons name="arrow-up" size={18} color="white" /></Pressable>}
          </View>
          
          <ScrollView className=""  ref={(scroll) => {this.scroll = scroll;}}>
            {/* Display scan information */}
            <View className="flex flex-row items-center space-x-2"><Ionicons name="information-circle-outline" size={18} color="white" /><Text className="text-white font-bold">{t('common:typeImage')} : </Text><Text className="text-white text-xs">{currentImage}</Text></View>
            <View className="flex flex-row items-center space-x-2"><Ionicons name="time-outline" size={18} color="white" /><Text className="text-white font-bold">{t('common:acquisitionTime')} : </Text><Text className="text-white text-xs">{scanDate}</Text></View>
            
            {/* Display file paths */}
            <View className="mt-4  flex flex-row items-center space-x-2"><Ionicons name="file-tray-full-outline" size={18} color="white" /><Text className="text-white font-bold">{t('common:filePath')} : </Text></View>
            <Text className="text-white text-xs"> {'http://'+myContext.apiURL+'/data/scans'}</Text>
            <Text className="text-white text-xs"> {'http://'+myContext.apiURL+'/'+scan.ser}</Text>

            {/* Display acquisition parameters */}
            <Text className="mt-4 text-white font-bold">Paramètre d'acquisition :</Text>
            <View className="flex flex-row items-center space-x-2"><Ionicons name="camera-outline" size={18} color="white" /><Text className="text-white">{t('common:camera')} : {scan.configuration?.camera}</Text></View>
            <View className="flex flex-row items-center space-x-2"><Ionicons name="aperture" size={18} color="white" /><Text className="text-white">{t('common:exposure')} : {parseInt(scan.configuration?.exposure_time/1000)} ms</Text></View>
            <View className="flex flex-row items-center space-x-2"><Ionicons name="analytics-outline" size={18} color="white" /><Text className="text-white">{t('common:gain')} : {scan.configuration?.gain.toFixed(2)} dB</Text></View>
            
            {/* Display processing logs */}
            <View className="mt-4  flex flex-row items-center space-x-2"><Ionicons name="bug-outline" size={18} color="white" /><Text className="text-white font-bold">{t('common:processingLog')} : </Text></View>
            <Text className="text-white text-xs italic">
              {logs}
            </Text>
          </ScrollView>
          
          {/* Scroll to end button */}
          <View>
            {!hideScrollToEnd && <Pressable onPress={()=>scrollToEnd()}><Ionicons name="arrow-down" size={18} color="white" /></Pressable>}
          </View>
        </View>
      </View>
    </Modal>
  );
}
