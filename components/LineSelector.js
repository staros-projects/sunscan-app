import React, { useCallback, useContext, useEffect } from 'react';
import {Dimensions, StyleSheet, Text, View} from 'react-native';
import SelectDropdown from 'react-native-select-dropdown';
import Ionicons from '@expo/vector-icons/Ionicons'
import { useFocusEffect } from '@react-navigation/native';
import AppContext from './AppContext';


// `wl` duplicates the wavelength already present in `description`, so a compact
// UI (the end of scan picker) can show the short name and the wavelength on two
// lines without having to parse the sentence.
export const linesDict = [
  {key:'', description:'Select your line'},
  {key:'halpha', short:"Hα", wl:'6562.81 Å', description:'Hα line - 6562.81 Å', color:'#b91c1c'},
  {key:'feX', short:"Fe X", wl:'6374.56 Å', description:'Fe X line - 6374.56 Å', color:'#ea580c'},
  {key:'feI', short:"Fe I", wl:'6173 Å', description:'Fe I line - 6173 Å', color:'#ea580c'},
  {key:'sodium', short:"Na I", wl:'5893 Å', description:'Sodium line - 5893 Å', color:'#ca8a04'},
  {key:'heI', short :"He I", wl:'5875.65 Å', description:'He I line (D3) - 5875.65 Å', color:'#ca8a04'},
  {key:'feXIV', short:"Fe XIV", wl:'5302.86 Å', description:'Fe XIV line - 5302.86 Å', color:'#65a30d'},
  {key:'mgI3', short:"Mg I", wl:'5183 Å', description:'Mg I line - 5183 Å', color:'#65a30d'},
  {key:'mgI2', short:"Mg I", wl:'5172 Å', description:'Mg I line - 5172 Å', color:'#65a30d'},
  {key:'mgI1', short:"Mg I", wl:'5167 Å', description:'Mg I line - 5167 Å', color:'#65a30d'},
  {key:'hbeta', short:"Hβ", wl:'4861.34 Å', description:'Hβ line - 4861.34 Å', color:'#0369a1'},
  {key:'hgamma', short:"Hγ", wl:'4340.48 Å', description:'Hγ line - 4340.48 Å', color:'#1d4ed8'},
  {key:'hdelta', short:"Hδ", wl:'4101.75 Å', description:'Hδ line - 4101.75 Å', color:'#4338ca'},
  {key:'hepsilon', short:"Hε", wl:'3970.08 Å', description:'Hε line - 3970.08 Å', color:'#6d28d9'},
  {key:'caIIH', short:"Ca II H", wl:'3968 Å', description:'Ca II H line - 3968  Å', color:'#7e22ce'},
  {key:'caIIK', short:"Ca II K", wl:'3934 Å', description:'Ca II K line - 3934 Å', color:'#7e22ce'},
  {key:'other', short:"", description:'', color:'#bbbbbb'},
];




const MENU_WIDTH = 240;

// Keep the trigger a circle whatever the line is called: drop the spaces from
// the short name ("Ca II K" -> "CaIIK") and step the font size down as it grows,
// instead of letting the button stretch into an oval.
const compactLabel = (short) => (short || '').replace(/\s+/g, '');

const labelFontSize = (label) => {
  if (label.length <= 2) return 13;
  if (label.length === 3) return 11;
  if (label.length === 4) return 10;
  return 9;
};

const LineSelector = ({ path, tag}) => {

    const [selectedValue, setSelectedValue] = React.useState('');
    const lineSelectorComponent = React.useRef(null);

    const myContext = useContext(AppContext);

    // The trigger now sits in the right-hand action column, so the menu would
    // run off screen if it opened from the button's left edge (the library's
    // default). Measure the trigger and right-align the menu with it instead.
    const wrapperRef = React.useRef(null);
    const [menuLeft, setMenuLeft] = React.useState(undefined);

    const measureTrigger = () => {
      wrapperRef.current?.measureInWindow((x, y, w) => {
        if (typeof x !== 'number') return;
        const winW = Dimensions.get('window').width;
        const left = Math.min(Math.max(12, x + w - MENU_WIDTH), winW - MENU_WIDTH - 12);
        setMenuLeft(left);
      });
    };

    // An unknown or missing tag must still resolve to an entry that exists in
    // `data`, otherwise the dropdown ends up with nothing selected.
    useEffect(() => {
        const match = tag ? linesDict.find(item => item.key === tag) : null;
        setSelectedValue(match || linesDict[0]);
    }, [path, tag]);


   // Function to tag the scan
   async function tagScan(value) {
    fetch('http://' + myContext.apiURL + "/sunscan/scan/tag/", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filename: path, tag:value.key }),
    }).then(response => response.json())
      .then(json => {
        //console.log(json)
      })
      .catch(error => {
        console.error(error);
      });
  }


    return (
      // collapsable={false} keeps the wrapper as a real native view on Android,
      // without which measureInWindow returns nothing.
      <View ref={wrapperRef} onLayout={measureTrigger} collapsable={false}>
        <SelectDropdown
          // Remount per scan. SelectDropdown only re-applies `defaultValue`
          // when JSON.stringify(defaultValue) changes, so moving between two
          // scans carrying the SAME tag left it showing no selection at all.
          key={path}
          ref={lineSelectorComponent}
          dropdownOverlayColor="rgba(0, 0, 0, 0.35)"
          data={linesDict}
          onSelect={(selectedItem, index) => {
            tagScan(selectedItem);
          }}
          defaultValue={selectedValue}
          renderButton={(selectedItem, isOpen) => {
            const label = compactLabel(selectedItem && selectedItem.short);
            // Same dark disc as the neighbouring actions; the line is carried by
            // a coloured ring rather than a solid fill, which read as a primary
            // action sitting right under the red delete button.
            return (
              <View
                style={[styles.trigger, label && {borderColor: selectedItem.color, borderWidth: 2}]}>
                {label
                  ? <Text numberOfLines={1} style={[styles.triggerLabel, {fontSize: labelFontSize(label)}]}>{label}</Text>
                  : <Ionicons name="pricetag-outline" size={19} color="#fff" />}
              </View>
            );
          }}
          renderItem={(item, index, isSelected) => {
            return (
              <View
                style={{
                  ...styles.dropdown1ItemStyle,
                  ...(isSelected && {backgroundColor: 'rgba(16,185,129,0.18)'}),
                }}>
                <View style={{width: 8, height: 8, borderRadius: 4, marginRight: 10, backgroundColor: item.color || 'transparent'}} />
                <Text style={styles.dropdown1ItemTxtStyle}>{item.description || 'Select your line'}</Text>
              </View>
            );
          }}
          dropdownStyle={{...styles.dropdown1MenuStyle, ...(menuLeft !== undefined && {left: menuLeft})}}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };
  
  export default LineSelector;
  
  const styles = StyleSheet.create({

 
    ////////////// dropdown1
    // Trigger: the same round control as the other on-image actions, showing
    // the line's short name inside a ring in that line's colour once tagged.
    trigger: {
      // Fixed width, not minWidth: the disc must stay perfectly round
      width: 42,
      height: 42,
      borderRadius: 21,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.18)',
      // Constant: only the border changes with the selection, so the rounded
      // corners are never lost to a background repaint on Android.
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    triggerLabel: {
      fontWeight: '700',
      color: '#FFFFFF',
    },
    // An explicit width is required: the menu would otherwise inherit the
    // trigger's, which is now only 42px wide.
    dropdown1MenuStyle: {
      width: 240,
      backgroundColor: '#18181b',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    dropdown1ItemStyle: {
      width: '100%',
      flexDirection: 'row',
      paddingHorizontal: 14,
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    dropdown1ItemTxtStyle: {
      flex: 1,
      fontSize: 12,
      fontWeight: '500',
      color: '#FFFFFF',
    },
    dropdown1ItemIconStyle: {
      fontSize: 12,
      marginRight: 8,
      color: '#FFFFFF',
    },
    
  });