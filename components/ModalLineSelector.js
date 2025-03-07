import React, {useMemo} from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { linesDict } from './LineSelector';
import { useTranslation } from 'react-i18next';


const ModalLineSelector = ({ visible, onSelect }) => {
    const { t } = useTranslation();
    const memoizedLinesDict = useMemo(() => linesDict.filter((i) => i.key !== ''), [linesDict]);
    const renderOptions = useMemo(() => {
        
        const rows = [];
        const ld = memoizedLinesDict;
        for (let i = 0; i < ld.length; i += 4) {
          const rowItems = ld.slice(i, i + 4);
          rows.push(
            <View style={styles.row} key={`row-${i}`}>
              {rowItems.map((item) => (
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => { onSelect(item.key)} }
                  key={item.key}
                  className="relative"
                >
                  <Text style={styles.optionText}>{item.description ? item.description : 'Other'}</Text>
                  {item.color && <View className="absolute flex flex-row items-center space-x-2" style={{top:-4, left:-4}}><View style={{backgroundColor:item.color}} className="rounded-full  h-3 w-3 text-xs text-white text-center"></View></View>}
                </TouchableOpacity>
              ))}
            </View>
          );
        }
        return rows;
      }, [memoizedLinesDict]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      supportedOrientations={['landscape']}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.subtitle}>{t('common:selectLineMessage')}</Text>
          {renderOptions}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',

  },
  modalContainer: {
    width: '90%',
    height: 'auto',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    backgroundColor:'rgb(63 63 70)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  optionButton: {
    backgroundColor:'rgb(113 113 122)',
    padding: 5,
    borderRadius: 5,
    margin: 5,
    flex: 1,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 11,
    textAlign: 'center',
    color: 'white',
  },
});

export default ModalLineSelector;
