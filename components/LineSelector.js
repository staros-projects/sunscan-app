import React, { useCallback, useContext, useEffect } from 'react';
import {StyleSheet, Text, View} from 'react-native';
import SelectDropdown from 'react-native-select-dropdown';
import Ionicons from '@expo/vector-icons/Ionicons'
import { useFocusEffect } from '@react-navigation/native';
import AppContext from './AppContext';


export const linesDict = [
  {key:'', description:'Select your line'},
  {key:'halpha', short:"Hα", description:'Hα line - 6562.81 Å', color:'#b91c1c'},
  {key:'feX', short:"Fe X", description:'Fe X line - 6374.56 Å', color:'#ea580c'},
  {key:'feI', short:"Fe I", description:'Fe I line - 6173 Å', color:'#ea580c'},
  {key:'sodium', short:"Na I", description:'Sodium line - 5893 Å', color:'#ca8a04'},
  {key:'heI', short :"He I", description:'He I line (D3) - 5875.65 Å', color:'#ca8a04'},
  {key:'feXIV', short:"Fe XIV", description:'Fe XIV line - 5302.86 Å', color:'#65a30d'},
  {key:'mgI3', short:"Mg I", description:'Mg I line - 5183 Å', color:'#65a30d'},
  {key:'mgI2', short:"Mg I", description:'Mg I line - 5172 Å', color:'#65a30d'},
  {key:'mgI1', short:"Mg I", description:'Mg I line - 5167 Å', color:'#65a30d'},
  {key:'hbeta', short:"Hβ", description:'Hβ line - 4861.34 Å', color:'#0369a1'},
  {key:'hgamma', short:"Hγ", description:'Hγ line - 4340.48 Å', color:'#1d4ed8'},
  {key:'hdelta', short:"Hδ", description:'Hδ line - 4101.75 Å', color:'#4338ca'},
  {key:'hepsilon', short:"Hε", description:'Hε line - 3970.08 Å', color:'#6d28d9'},
  {key:'caIIH', short:"Ca II H", description:'Ca II H line - 3968  Å', color:'#7e22ce'},
  {key:'caIIK', short:"Ca II K", description:'Ca II K line - 3934 Å', color:'#7e22ce'},
  {key:'other', short:"", description:'', color:'#bbbbbb'},
];




const LineSelector = ({ path, tag}) => {

    const [selectedValue, setSelectedValue] = React.useState('');
    const lineSelectorComponent = React.useRef(null);
  
    const myContext = useContext(AppContext);

    useEffect(() => {
        lineSelectorComponent.current.reset();
        if (tag === undefined) {
          setSelectedValue(linesDict[0]);
          return;
        }
        setSelectedValue(linesDict.find(item => item.key === tag)) 
        console.log(tag);
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
        <SelectDropdown
          ref={lineSelectorComponent}
          dropdownOverlayColor="rgba(0, 0, 0, 0)"
          data={linesDict}
          onSelect={(selectedItem, index) => {
            tagScan(selectedItem);
          }}
          defaultValue={selectedValue}
          renderButton={(selectedItem, isOpen) => {
            return (
              <View style={styles.dropdown1ButtonStyle}>
                <Text style={styles.dropdown1ButtonTxtStyle}>
                  {(selectedItem && selectedItem.description) || 'Select your line'}
                </Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} style={styles.dropdown1ButtonArrowStyle} />
              </View>
            );
          }}
          renderItem={(item, index, isSelected) => {
            return (
              <View
                style={{
                  ...styles.dropdown1ItemStyle,
                  ...(isSelected && {backgroundColor: 'grey'}),
                }}>
                <Text style={styles.dropdown1ItemTxtStyle}>{item.description}</Text>
              </View>
            );
          }}
          dropdownStyle={styles.dropdown1MenuStyle}
          showsVerticalScrollIndicator={false}
        />
    );
  };
  
  export default LineSelector;
  
  const styles = StyleSheet.create({

 
    ////////////// dropdown1
    dropdown1ButtonStyle: {
      width: '100%',
      height: 30,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
      backgroundColor: '#27272a',
    },
    dropdown1ButtonTxtStyle: {
      flex: 1,
      fontSize: 12,
      fontWeight: '500',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    dropdown1ButtonArrowStyle: {
      fontSize: 12,
      color: '#FFFFFF',
    },
    dropdown1ButtonIconStyle: {
      fontSize: 12,
      marginRight: 8,
      color: '#FFFFFF',
    },
    dropdown1MenuStyle: {
      backgroundColor: '#444444',
      borderRadius: 8,
    },
    dropdown1ItemStyle: {
      width: '100%',
      flexDirection: 'row',
      paddingHorizontal: 12,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#B1BDC8',
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