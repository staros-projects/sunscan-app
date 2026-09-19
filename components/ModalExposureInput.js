// Manual exposure entry.
//
// In cropped mode the exposure is the observer's alone : the automatic loop
// only runs on the full frame colour preview, and the slider covers its whole
// range in a few tens of pixels, far too coarse to land on a given value. This
// types it in instead, so an exposure found once can be set again exactly.

import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import PressableScale from './PressableScale';
import { modalBackdrop, modalCard, colors } from './theme';

// Tolerates the comma decimal separator of a French keyboard, and the spaces
// that come with a long press paste. Returns null on anything else.
export function parseExposure(text) {
  const cleaned = String(text).replace(',', '.').trim();
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

// Short exposures are set to a tenth of a millisecond, longer ones are whole
// milliseconds : the field opens on the value as the toolbar reads it.
export function formatExposure(ms) {
  if (!Number.isFinite(ms)) return '';
  return String(ms < 20 ? Math.round(ms * 10) / 10 : Math.round(ms));
}

const ModalExposureInput = ({ visible, value, min, max, onCancel, onSubmit }) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  // Read on opening only : an exposure arriving from elsewhere (a camera status
  // coming back) must not wipe what is half typed.
  const valueRef = useRef(value);
  valueRef.current = value;

  // The slider may well have moved since the last time it was opened : the
  // field starts from the exposure in force, not from what was typed before.
  useEffect(() => {
    if (visible) {
      setText(formatExposure(valueRef.current));
    }
  }, [visible]);

  const parsed = parseExposure(text);
  const valid = parsed != null && parsed >= min && parsed <= max;
  // Nothing typed yet is not a mistake : the range is shown, not an error
  const showError = text.trim() !== '' && !valid;

  const submit = () => {
    if (valid) onSubmit(parsed);
  };

  return (
    <SafeAreaView>
      <Modal
        transparent={true}
        visible={visible}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={onCancel}
        supportedOrientations={['landscape']}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Ionicons name="stopwatch-outline" size={18} color={colors.accent} />
              <Text style={styles.title}>{t('common:manualExposureTitle')}</Text>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, showError && styles.inputError]}
                value={text}
                onChangeText={setText}
                keyboardType="numeric"
                autoFocus={true}
                selectTextOnFocus={true}
                returnKeyLabel="OK"
                returnKeyType="done"
                onSubmitEditing={submit}
                placeholder={formatExposure(value)}
                placeholderTextColor="#71717a"
              />
              <Text style={styles.unit}>ms</Text>
            </View>

            <Text style={[styles.hint, showError && styles.hintError]}>
              {t('common:manualExposureRange', { min: formatExposure(min), max: formatExposure(max) })}
            </Text>

            <View style={styles.buttonRow}>
              <PressableScale style={[styles.button, styles.cancelButton]} onPress={onCancel}>
                <Text style={styles.buttonText}>{t('common:cancel')}</Text>
              </PressableScale>
              <PressableScale
                style={[styles.button, !valid && styles.disabledButton]}
                disabled={!valid}
                onPress={submit}
              >
                <Text style={styles.buttonText}>{t('common:apply')}</Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  overlay: modalBackdrop,
  card: {
    ...modalCard,
    width: 320,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  title: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#52525b',
    backgroundColor: '#27272a',
    borderRadius: 10,
    paddingVertical: 8,
    width: 120,
    fontSize: 18,
    textAlign: 'center',
    color: '#fff',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  unit: {
    marginLeft: 8,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  hint: {
    marginTop: 10,
    fontSize: 11,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
  },
  hintError: {
    color: '#f87171',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
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
  cancelButton: {
    backgroundColor: '#3f3f46',
  },
  disabledButton: {
    backgroundColor: '#52525b',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default ModalExposureInput;
