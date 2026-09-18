import { StatusBar } from 'expo-status-bar';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  Switch,
  ActivityIndicator,
  Platform, // Importer ActivityIndicator pour le loader
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import PressableScale from './PressableScale';
import { modalBackdrop, modalCard } from './theme';

const AnimationOptionsModal = ({
  visible,
  itemCount,
  onClose,
  onSubmit,
  defaultOptions = {
    frame_duration: 160,
    display_datetime: true,
    resize_gif: true,
    bidirectional: true,
    add_average_frame: false,
  },
}) => {
  const [frameDuration, setFrameDuration] = useState(defaultOptions.frame_duration);
  const [displayDatetime, setDisplayDatetime] = useState(defaultOptions.display_datetime);
  const [resizeGif, setResizeGif] = useState(defaultOptions.resize_gif);
  const [bidirectional, setBidirectional] = useState(defaultOptions.bidirectional);
  const [addAverageFrame, setAddAverageFrame] = useState(defaultOptions.add_average_frame);
  const [isLoading, setIsLoading] = useState(false); 

  const handleSubmit = async () => {

    setIsLoading(true);
      await onSubmit({
        frame_duration:frameDuration,
        display_datetime:displayDatetime,
        resize_gif:resizeGif,
        bidirectional,
        add_average_frame:addAverageFrame,
      })

      setIsLoading(false);  // Terminer le chargement
      onClose();  // Fermer la modal
  };

  return (
    <SafeAreaView>
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
      supportedOrientations={['landscape']}
    >
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer} className="space-y-1">
          {/* Header: itemCount was passed in but never shown, so the dialog gave
              no clue how many scans were about to be animated. */}
          <View style={styles.header}>
            <View className="flex flex-row items-center space-x-2">
              <Ionicons name="film-outline" size={18} color="#fff" />
              <Text className="text-white font-bold" style={{fontSize:15}}>{t('common:animate')}</Text>
            </View>
            {itemCount > 0 && <Text className="text-zinc-400" style={{fontSize:12}}>{itemCount}</Text>}
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>{t('common:frameDuration')} :</Text>
            <TextInput
              style={styles.input}
              key='frameDuration'
              keyboardType="numeric"
              value={frameDuration ? String(frameDuration):'0'}
              returnKeyLabel='OK'
              returnKeyType='done'
              onChangeText={(value) => setFrameDuration(Number(value))}
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>{t('common:displayDatetime')} :</Text>
            <Switch
              value={displayDatetime}
               trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
             thumbColor='#fff'
              onValueChange={setDisplayDatetime}
               style={{
                                      marginVertical: Platform.OS === 'android' ? -6 : 4,
                                    }}
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>{t('common:resizeGif')} :</Text>
            <Switch 
             trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
             thumbColor='#fff'
              style={{
                                     marginVertical: Platform.OS === 'android' ? -6 : 4,
                                   }}
            value={resizeGif} onValueChange={setResizeGif} />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>{t('common:bidirectional')} :</Text>
            <Switch 
             trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
             thumbColor='#fff'
              style={{
                                     marginVertical: Platform.OS === 'android' ? -6 : 4,
                                   }}
           value={bidirectional} onValueChange={setBidirectional} />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>{t('common:addAverageFrame')} :</Text>
            <Switch
             trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
             thumbColor='#fff'
              value={addAverageFrame}
               style={{
                                      marginVertical: Platform.OS === 'android' ? -6 : 4,
                                    }}
              onValueChange={setAddAverageFrame}
            />
          </View>

          <View style={styles.buttonRow}>
            <PressableScale
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading} // Désactiver pendant le chargement
            >
              <Text style={styles.buttonText}>{t('common:cancel')}</Text>
            </PressableScale>

            <PressableScale
              style={[styles.button, isLoading ? styles.disabledButton : null]}
              onPress={handleSubmit}
              disabled={isLoading} // Désactiver pendant le chargement
            >
              {isLoading ? (
                <ActivityIndicator color="white" /> // Afficher le loader
              ) : (
                <Text style={styles.buttonText}>{t('common:animate')}</Text>
              )}
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal></SafeAreaView>
  );
};

const styles = StyleSheet.create({
  modalBackground: modalBackdrop,
  modalContainer: {
    ...modalCard,
    width: 400,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    margin:0,
    padding:0,

  },
  optionLabel: {
    fontSize: 12,
    flex: 1,
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#52525b',
    backgroundColor: '#27272a',
    borderRadius: 10,
    paddingVertical: 5,
    width: 64,
    textAlign: 'center',
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    width: '100%',
  },
  button: {
    flex: 1,
    backgroundColor: 'rgb(5 150 105)',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  // Cancel is not destructive: a neutral button, not the red one it used to be
  cancelButton: {
    backgroundColor: '#3f3f46',
  },
  disabledButton: {
    backgroundColor: '#52525b', // Couleur grisée pour désactiver le bouton

  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default AnimationOptionsModal;
