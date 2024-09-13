import { Modal, View, Text, Pressable, StyleSheet, Switch } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import Ionicons from '@expo/vector-icons/Ionicons';
import Loader from '../components/Loader';

// Component for processing scans
export default function ProcessScan({ processMethod, isStarted, setIsStarted, isVisible, onClose }) {

    // Styles for the component
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

    
  return (
    <Modal animationType="slide" transparent={true} visible={isVisible} supportedOrientations={['landscape']}>
        <View style={styles.centeredView}>
            <View style={styles.modalView} className="flex flex-col justify-center items-center">
                {/* Close button */}
                <View className="absolute top-0 right-0 z-50 mx-4 mt-4">
                    <Pressable onPress={onClose}>
                        <MaterialIcons name="close" color="#fff" size={22} />
                    </Pressable>
                </View>
                
                {/* Title */}
                <Text className="mt-4 text-white font-bold">Calcul des images Continuum + Doppler</Text>
                
                {/* Start processing button or loading indicator */}
                {!isStarted ? (
                    <Pressable 
                        className="mt-4 bg-zinc-800 p-2 rounded-md h-12 text-white text-center flex flex-row align-center justify-center items-center space-x-2"
                        onPress={() => {processMethod(); setIsStarted(true);}}
                    >
                        <Ionicons name="caret-forward-outline" size={18} color="white" />
                        <Text className="text-white text-xs">Lancer le traitement</Text>
                    </Pressable>
                ) : (
                    <View className="mt-4 bg-zinc-800 p-2 rounded-md h-12 text-white text-center flex justify-center items-center">
                        <Loader type="white" />
                    </View>
                )}
                
                {/* Processing time information */}
                <Text className="text-xs my-2 text-gray-200 italic">Le traitement peut prendre plusieurs minutes...</Text>
            </View>
        </View>
    </Modal>
  );
}
