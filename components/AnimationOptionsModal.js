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
  ActivityIndicator, // Importer ActivityIndicator pour le loader
} from 'react-native';

const AnimationOptionsModal = ({
  visible,
  itemCount,
  onClose,
  onSubmit,
  defaultOptions = {
    frame_duration: 120,
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
    <>
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>{t('common:frameDuration')} :</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(frameDuration)}
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
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>{t('common:resizeGif')} :</Text>
            <Switch 
             trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
             thumbColor='#fff'
            value={resizeGif} onValueChange={setResizeGif} />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>{t('common:bidirectional')} :</Text>
            <Switch 
             trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
             thumbColor='#fff'
           value={bidirectional} onValueChange={setBidirectional} />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>{t('common:addAverageFrame')} :</Text>
            <Switch
             trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
             thumbColor='#fff'
              value={addAverageFrame}
              onValueChange={setAddAverageFrame}
            />
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading} // Désactiver pendant le chargement
            >
              <Text style={styles.buttonText}>{t('common:cancel')}</Text>
            </Pressable>

            <Pressable
              style={[styles.button, isLoading ? styles.disabledButton : null]}
              onPress={handleSubmit}
              disabled={isLoading} // Désactiver pendant le chargement
            >
              {isLoading ? (
                <ActivityIndicator color="white" /> // Afficher le loader
              ) : (
                <Text style={styles.buttonText}>{t('common:animate')}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    width: 400,
    padding: 15,
    backgroundColor: 'rgb(63 63 70)',
    borderRadius: 10,
    alignItems: 'center',
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
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 0,
    width: 60,
    textAlign: 'center',
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    width: '100%',
  },
  button: {
    flex: 1,
    backgroundColor: 'rgb(5 150 105)',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  disabledButton: {
    backgroundColor: '#888', // Couleur grisée pour désactiver le bouton

  },
  buttonText: {
    color: 'white',
    fontWeight: 'normal',
  },
});

export default AnimationOptionsModal;
