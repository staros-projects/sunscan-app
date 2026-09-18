import React, { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { linesDict } from './LineSelector';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import PressableScale from './PressableScale';
import Reveal from './Reveal';
import { modalBackdrop, modalCard, colors, roundButton } from './theme';

// Chips are laid out by wrapping rather than by slicing the dictionary into
// rows of four: the grid no longer breaks when a line is added or removed, and
// every chip keeps the same size whatever the length of its label.
const CHIP_WIDTH = 104;

const ModalLineSelector = ({ visible, onSelect, onSkip }) => {
  const { t } = useTranslation();

  // The empty "Select your line" placeholder belongs to the dropdown, not here,
  // and "other" is pulled out so it can close the row as a neutral choice.
  const lines = useMemo(() => linesDict.filter((i) => i.key !== '' && i.key !== 'other'), []);

  // Marking the tap before the parent unmounts the modal: tagging goes through
  // the network, so without it the chip stays inert for as long as the request
  // takes and the tap feels lost.
  const [pending, setPending] = useState(null);

  const choose = (key) => {
    if (pending) return;
    setPending(key);
    onSelect(key);
  };

  return (
    <SafeAreaView>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={onSkip}
        supportedOrientations={['landscape']}
      >
        <View style={styles.overlay}>
          <Reveal active={visible} distance={16} duration={260} style={styles.cardWrapper}>
            <View style={styles.card}>
              {/* Header: the dialog used to open with nothing but an instruction,
                  giving no sign that the scan had actually been recorded. */}
              <View style={styles.header}>
                <View style={styles.headerTitle}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  <Text style={styles.title}>{t('common:scanCompleteTitle')}</Text>
                </View>
                {onSkip && (
                  <PressableScale style={styles.closeButton} onPress={onSkip} hitSlop={8}>
                    <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
                  </PressableScale>
                )}
              </View>

              <Text style={styles.subtitle}>{t('common:selectLineMessage')}</Text>

              {/* Scrollable so the picker survives a short window (small phone in
                  landscape) instead of pushing the chips off the card. */}
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator={false}
              >
                {lines.map((item) => {
                  const isPending = pending === item.key;
                  return (
                    <PressableScale
                      key={item.key}
                      scaleTo={0.94}
                      onPress={() => choose(item.key)}
                      style={[
                        styles.chip,
                        { borderColor: isPending ? colors.accent : 'rgba(255,255,255,0.10)' },
                        isPending && { backgroundColor: 'rgba(16,185,129,0.18)' },
                      ]}
                    >
                      {/* The colour used to be a dot floating outside the button.
                          As a top bar it identifies the line without escaping
                          the chip's rounded corners. */}
                      <View style={[styles.chipBar, { backgroundColor: item.color }]} />
                      <Text numberOfLines={1} style={styles.chipLabel}>{item.short}</Text>
                      <Text numberOfLines={1} style={styles.chipWavelength}>{item.wl}</Text>
                    </PressableScale>
                  );
                })}

                <PressableScale
                  scaleTo={0.94}
                  onPress={() => choose('other')}
                  style={[
                    styles.chip,
                    styles.otherChip,
                    pending === 'other' && {
                      borderColor: colors.accent,
                      backgroundColor: 'rgba(16,185,129,0.18)',
                    },
                  ]}
                >
                  <Ionicons name="help-circle-outline" size={18} color="rgba(255,255,255,0.7)" />
                  <Text numberOfLines={1} style={styles.otherLabel}>{t('common:otherLine')}</Text>
                </PressableScale>
              </ScrollView>
            </View>
          </Reveal>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...modalBackdrop,
  },
  cardWrapper: {
    width: '92%',
    maxWidth: 720,
  },
  card: {
    ...modalCard,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    ...roundButton,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  // Capped rather than sized: the grid keeps its natural height when the whole
  // set of lines fits, and only then starts to scroll.
  scroll: {
    maxHeight: 260,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Centred so the last, partly filled row stays under the rest of the grid
    // instead of hanging on the left edge.
    justifyContent: 'center',
  },
  chip: {
    width: CHIP_WIDTH,
    margin: 5,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  chipBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chipWavelength: {
    marginTop: 2,
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
  },
  otherChip: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  otherLabel: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
});

export default ModalLineSelector;
