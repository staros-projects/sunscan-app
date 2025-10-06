
// Import necessary React and React Native components
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Platform, Pressable, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import { SafeAreaView } from 'react-native';

// Import icons from Expo vector icons
import Ionicons from '@expo/vector-icons/Ionicons'
import Entypo from '@expo/vector-icons/Entypo';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

import { debounce } from 'lodash';

// Import NativeWind for styling
import { NativeWindStyleSheet } from "nativewind";

// Import Image component from Expo
import { Image } from 'expo-image';

// Configure NativeWind to output styles for native platforms
NativeWindStyleSheet.setOutput({
  default: "native",
});


// Import custom components
import Loader from '../components/Loader';
import WebSocketContext  from '../utils/WSContext';
import AppContext from '../components/AppContext';
import TooltipPopin from '../components/TooltipPopin';
import Spectrum from '../components/Spectrum';

// Import Slider component
import Slider from '@react-native-community/slider';
import VerticalSlider from 'rn-vertical-slider';

// Import translation hook
import { useTranslation } from 'react-i18next';
import { Zoomable } from '@likashefqet/react-native-image-zoom';
import ModalLineSelector from '../components/ModalLineSelector';
import { useFocusEffect } from '@react-navigation/native';

// Main ScanScreen component
export default function ScanScreen({navigation}) {

    // Initialize translation hook
    const { t, i18n } = useTranslation();

    // State variables for managing the component
    const [frame, setFrame] = useState(null);
    const [fc, setFC] = useState(0);
    const fcRef = React.useRef(fc);
    const [pixelStats, setPixelStats] = useState({r:0, g:0, b:0});
    const [sharpness, setSharpness] = useState(0);
    const [bestSharpness, setBestSharpness] = useState(0);
    const webSocket = useRef(null);
    const [displaySpectrum, setDisplaySpectrum] = useState(false);
    const [displaySpectrumType, setDisplaySpectrumType] = useState("vertical");
    const [spectrumData, setSpectrumData] = useState([]);
    const [intensityData, setIntensityData] = useState([]);
    const [fwhm, setFwhm] = useState('');

    const lowerExpLimit = 2000;
    const upperMaxLimit = 4095;

    // Styles for the component
    const styles = StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      },
      image: {
        flex: 1,
        backgroundColor: 'transparent',
      },
    });

    // Get the global variables & functions via context
    const myContext = useContext(AppContext);
    const isFocused = navigation.isFocused();
    const [subscribe, unsubscribe] = useContext(WebSocketContext);
    const [lastScanPath, setLastScanPath] = useState("");

    // Effect hook for managing subscriptions and fetching camera status
    //console.log('render')
    useFocusEffect(
      useCallback(() => {
        // Debounce avec lodash (déclenche l'action après 200ms d'inactivité)
        const debouncedUpdate = debounce((callback) => {
          callback();
        }, 200); // 200ms, ce qui permet une mise à jour maximum toutes les 5 fois par seconde
    
        // Appel à la fonction pour récupérer l'état de la caméra
        getCameraStatus();
    
        // Subscribe to 'camera' events
        subscribe('camera', (message) => {
          fcRef.current += 1;
          setFC(fcRef.current);
          if (!displaySpectrum && !modalLineSelectorVisible) {
            debouncedUpdate(() => setFrame(message[3]));
          }
        });
    
        // Subscribe to 'adu' events
        subscribe('adu', (message) => {
          if (fcRef.current % 5 === 0) {
            setPixelStats({ r: parseInt(message[1]), g: parseInt(message[2]), b: parseInt(message[3]) });
          }
        });

         // Subscribe to 'focus' events
        subscribe('focus', (message) => {
          //console.log(message)
          if (fcRef.current % 5 === 0) {
            const current = parseFloat(message[1])/100;
            setSharpness(current);

            setBestSharpness(prev => {
              if (current > prev) {
                return current;
              }
              return prev;
            });

          }
        });
    
        // Subscribe to 'spectrum' events
        subscribe('spectrum', (message) => {
          if (displaySpectrumType === 'vertical' && displaySpectrum) {
            if (fcRef.current % 2 === 0) {
              debouncedUpdate(() => {
                setFwhm(message[1]);
                setSpectrumData(message[2].split(','));
              });
            }
          } else {
            unsubscribe('spectrum');
          }
        });
    
        // Subscribe to 'intensity' events
        subscribe('intensity', (message) => {
          
          if (displaySpectrumType === 'horizontal' && displaySpectrum) {
            if (fcRef.current % 2 === 0) {
              debouncedUpdate(() => setIntensityData(message[1].split(',')));
            }
          } else {
            unsubscribe('intensity');
          }
        });
    
        // Cleanup function to unsubscribe from all events
        return () => {
          unsubscribe('camera');
          unsubscribe('adu');
          unsubscribe('spectrum');
          unsubscribe('intensity');
        };
      }, [isFocused, displaySpectrum, displaySpectrumType])
    );
    
    // Function to fetch camera status and update state
    async function getCameraStatus() {
      fetch('http://'+myContext.apiURL+"/camera/status").then(response => response.json())
      .then(json => {
        myContext.setCameraIsConnected(json.camera_status == "connected")
        fetch('http://'+myContext.apiURL+"/camera/infos/").then(response => response.json())
        .then(json => {
          if(json) {
            setCrop(json.crop);
            setGain(json.gain);
            setExptime(json.exposure_time/1e3);
            setNormMode(json.normalize);
            setDisplayFocusAssistant(json.focus_assistant);
            setColorMode(!json.monobin);
            setBinMode(json.bin);
            setRec(json.record);
            setMonoBinMode(parseInt(json.monobin_mode));
          }

        })
      })
      .catch(error => {
        myContext.setCameraIsConnected(false)
        console.error(error);
      });
    }

    const toggleExpMode = async () => {
  
      const newExpMode = (expMode+1)%3;
      setExpMode(newExpMode)
      setExptime(newExpMode == 0 ? 130.0:newExpMode == 1 ? 15.0:200.0);

      
    }

    const toggleNormMode = async () => {
      const newNormMode = normMode?0:1;
      setIsLoading(true);
      fetch('http://'+myContext.apiURL+"/camera/toggle-normalize/"+newNormMode.toString()).then(response => response.json())
      .then(json => {
        setNormMode(json.normalize);
        setIsLoading(false);
      })
      .catch(error => {
        console.error(error);
        setIsLoading(false);
      });
    }
     
    // State variables for timer functionality
    const [time, setTime] = React.useState(0);
    const timerRef = React.useRef(time);
    const [timerId, setTimerId] = React.useState(null);

    // State variables for various camera settings
    const [rec, setRec] = React.useState(false);
    const [expMode, setExpMode] = React.useState(false);
    const [crop, setCrop] = React.useState(false);
    const [binMode, setBinMode] = React.useState(false);
    const [colorMode, setColorMode] = React.useState(false);
    const [expTime, setExptime] = React.useState(130);
    const [gain, setGain] = React.useState(1.0);
    const [isLoading, setIsLoading] = useState(false);
    const [displayGrid, setDisplayGrid] = useState(false);
    const [displayFocusAssistant, setDisplayFocusAssistant] = useState(false);
    const [displayOptions, setDisplayOptions] = useState(false);
    const [snapShotFilename, setSnapShotFilename] = useState("");
    const [settings, setSettings] = useState("exp");
    const [monoBinMode, setMonoBinMode] = useState(false);
    const [normMode, setNormMode] = useState(false);
    const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
    const [maxThreshold, setMaxThreshold] = useState(256);

    // Function to update camera controls
    async function updateControls() {
      setIsLoading(true);
      fetch('http://'+myContext.apiURL+"/camera/controls/",{
        method: "POST", 
        headers: {
          'Content-Type': 'application/json'
      },
        body: JSON.stringify({gain:gain, exp:expTime, max_visu_threshold:maxThreshold}),
      }).then(response => response.json())
      .then(json => {
        setIsLoading(false);
      })
      .catch(error => {
        console.error(error);
        setIsLoading(false);
      });
    }

    // Function to take a snapshot
    async function takeSnapShot() {
      setIsLoading(true);
      setIsTakingSnapshot(true);
      fetch('http://'+myContext.apiURL+"/camera/take-snapshot/").then(response => response.json())
      .then(json => {
        setSnapShotFilename(json.filename)
        setTimeout(()=>{setSnapShotFilename('')},2000);
        setTimeout(()=>{setIsTakingSnapshot(false)},2000);
        setIsLoading(false);
      })
      .catch(error => {
        setSnapShotFilename(error)
        setIsLoading(false);
      });
    }

    // Function to toggle crop mode
    async function toggleCrop() {
      if (displayFocusAssistant && crop) {
        fetch('http://'+myContext.apiURL+"/camera/toggle-focus-assistant/").then(response => response.json())
        .then(json => {
          setDisplayFocusAssistant(json.focus_assistant);
          setIsLoading(false);
        })
        .catch(error => {
          console.error(error);
          setIsLoading(false);
        });
      }

      setIsLoading(true);
      fetch('http://'+myContext.apiURL+"/camera/toggle-crop/").then(response => response.json())
      .then(json => {
        setCrop(!crop);

        setIsLoading(false);
      })
      .catch(error => {
        console.error(error);
        setIsLoading(false);
      });
    }

    // Function to toggle spectrum display
    async function toggleSpectrum(type) {
      
        if(type == displaySpectrumType && displaySpectrum){
          setDisplaySpectrumType("");
          setDisplaySpectrum(false);
        }
        else
        {
          setDisplaySpectrumType(type);
          setDisplaySpectrum(true);
        }
     
    }

    // Function to toggle color mode
    async function toggleColorMode() {
    
      // If focus assistant is on, turn it off first
      if (displayFocusAssistant && !colorMode) {
        fetch('http://'+myContext.apiURL+"/camera/toggle-focus-assistant/").then(response => response.json())
        .then(json => {
          setDisplayFocusAssistant(false);
          setIsLoading(false);
        })
        .catch(error => {
          console.error(error);
          setIsLoading(false);
        });
      }

      setIsLoading(true);
      fetch('http://'+myContext.apiURL+"/camera/toggle-color-mode/").then(response => response.json())
      .then(json => {
        setColorMode(!colorMode)
        setIsLoading(false);
      })
      .catch(error => {
        console.error(error);
        setIsLoading(false);
      });
    }

    const [modalLineSelectorVisible, setModalLineSelectorVisible] = useState(false);

    // Function to update recording status
    async function updateRec(type) {
      // Check if there is enough storage space (1.2 Go minimum) before starting a new scan
      if (parseFloat(myContext.freeStorage) / 10e8 < 1.2) {
        console.log("low storage, free : ", parseFloat(myContext.freeStorage))
        Alert.alert(t('common:warning'), t('common:lowStorageWarning'));
        return;
      }

      setIsLoading(true);
      fetch('http://'+myContext.apiURL+"/camera/record/"+type+"/").then(response => response.json())
      .then(json => {
        setRec(!rec)
        setIsLoading(false);

        if (displayFocusAssistant) {
          toggleFocus();
        }

        if (type === 'stop') {
          setLastScanPath(json.scan);
          setModalLineSelectorVisible(true);
        }
      })
      .catch(error => {
        console.error(error);
        setIsLoading(false);
      });
    }

    // Function to update Y-axis crop position
    async function updatePosYCrop(type) {
      if(rec){
        return;
      }
      setIsLoading(true);
      fetch('http://'+myContext.apiURL+"/camera/crop/"+type+"/").then(response => response.json())
      .then(json => {
        setIsLoading(false);
      })
      .catch(error => {
        console.error(error);
        setIsLoading(false);
      });
    }

    // State and function for tooltip popin
    const [popinVisible, setPopinVisible] = useState(false);

  const togglePopin = () => {
      setPopinVisible(!popinVisible);
  };


  // Function to toggle mono/bin mode
  async function toggleMonoBinMode() {
    setIsLoading(true);
    fetch('http://'+myContext.apiURL+"/camera/toggle-monobin-mode/").then(response => response.json())
    .then(json => {
      setMonoBinMode(parseInt(json.monobin_mode))
      setIsLoading(false);
    })
    .catch(error => {
      console.error(error);
      setIsLoading(false);
    });
  }

  const setTagOnScan = (tag) => {
    console.log('setTagOnScan', tag);
    setModalLineSelectorVisible(false);
    fetch('http://'+myContext.apiURL+"/sunscan/scan/tag/", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filename: lastScanPath, tag:tag }),
    }).then(response => {
      setModalLineSelectorVisible(false);
    })
      .catch(error => {
        console.error(error);
      });
  };

  

  // Function to toggle options displaya
  const toggleOptions = () => {
      setDisplayOptions(!displayOptions);
  };

  // Function to toggle grid display
  const toggleGrid = () => {
      setDisplayGrid(!displayGrid);
  };

  const toggleFocus = () => {
      setIsLoading(true);
      setBestSharpness(0);
      fetch('http://'+myContext.apiURL+"/camera/toggle-focus-assistant/").then(response => response.json())
      .then(json => {
        setDisplayFocusAssistant(json.focus_assistant);
        setIsLoading(false);
      })
      .catch(error => {
        console.error(error);
         setDisplayFocusAssistant(false);
      });
  };

  // Styles for right toolbar (platform-specific)
  const stylesRighttoolBar = StyleSheet.create({
    right: 16,
  });

  useEffect(() => {
  updateControls();
}, [expTime, gain, maxThreshold]);


    return (
    
     <SafeAreaView className="bg-zinc-800" style={{flex:1}}>
      {/* Modal to select spectral line */}
      {modalLineSelectorVisible&& <ModalLineSelector visible={modalLineSelectorVisible} onSelect={setTagOnScan} />}
      <View className="flex flex-col " style={{flex:1}}>
  
            {/* Main container for displaying the camera feed or spectrum */}
            <View className="absolute z-1 flex flex-col justify-center" style={{ right:0, left:0, top:0, width:"100%", height:"100%"}}>
            {!displaySpectrum && (!modalLineSelectorVisible && frame && myContext.cameraIsConnected ? 
            
                                    <Zoomable
                                    isSingleTapEnabled
                                    isDoubleTapEnabled
                                        >
                        {/* Grid overlay for alignment */}
                        {displayGrid && !rec && <View className="absolute w-full h-full z-30 "><View className="mx-auto z-40 h-full" style={{width:1, backgroundColor:"lime"}}></View></View>} 
                        {displayGrid && !rec && <View className="absolute w-full h-full z-30 flex flex-row items-center "><View className="z-40 w-full" style={{height:1, backgroundColor:"lime"}}></View></View>}
                {/* Camera feed image */}
                <View className="h-full w-full  flex flex-row justify-center items-center"><Image
                style={{width:crop?470:402, height:crop ? 30:200}}
                source={{ uri: frame }} 
                contentFit='contain'
                className="border border-white mx-auto"
                /></View>
                </Zoomable>:<View className="mx-auto"><Loader type="white" /></View>)}

                {/* Spectrum display */}
                {displaySpectrum && displaySpectrumType === "vertical"  && <Spectrum rawData={spectrumData} fwhm={fwhm} title={t('common:verticalProfileTitle')} subtitle={t('common:verticalProfile')} />}
                {displaySpectrum && displaySpectrumType === "horizontal"  && <Spectrum rawData={intensityData} title={t('common:horizontalProfileTitle')} subtitle={t('common:horizontalProfile')} />}
               
            </View>

            {/* Tooltip popup */}
            {popinVisible && <TooltipPopin className="z-10" onClose={togglePopin}/>}
      
            {/* Recording timer display */}
            <View className="absolute bottom-0 w-full h-14 " style={{ left:0, top:10}}>
                {rec && myContext.cameraIsConnected && <Text className="mx-auto text-white text-3xl font-bold text-center">  {time} s  </Text>}
                </View>
                {/* Snapshot filename display */}
                <View className="absolute bottom-0 w-full h-14 " style={{ left:0, top:10}}>
                {snapShotFilename && myContext.cameraIsConnected && <Text className="mx-auto text-white text-xs">./{snapShotFilename}</Text>}
                </View>

      
          {/* focus assistant */}
          {displayFocusAssistant && sharpness && !displaySpectrum && <View className="absolute bottom-0 w-full h-14 z-5 " style={{ right:0, bottom:75}}>
            <View style={{ left:0, top:0}} className=" flex flex-col mx-auto justify-center items-center rounded-lg px-2 py-1 bg-zinc-600/70 space-y-0">
               <View className="flex flex-row gap-1 items-center">
                <Text className="mx-auto text-white text-xs ">{t('common:focusMsg')} :</Text>
                <Text className="mx-auto text-white text-base font-bold">{sharpness.toFixed(2)}</Text>
                <Text className="mx-auto text-white text-xs">(Best: {bestSharpness.toFixed(2)})</Text>
                <Pressable onPress={()=>setBestSharpness(0)}><Ionicons name="refresh-sharp" size={14} color="white" /></Pressable> 
              </View>
               
               <Text className="mx-auto text-gray-400 text-xs italic leading-3" style={{fontSize:10}}>{t('common:focusMsg1')}</Text>
                <Text className="mx-auto text-gray-400 text-xs italic leading-3" style={{fontSize:10}}>{t('common:focusMsg2')}</Text>
          </View></View>}

           {/* Bottom toolbar */}
           {!rec && !displaySpectrum && (myContext.cameraIsConnected || myContext.demo)  &&
           <View className="absolute bottom-0 w-full h-14 z-10 " style={{ right:0, bottom:10}}>

       
            <View style={{ left:0, top:0}} className=" flex flex-row mx-auto justify-center items-center rounded-lg px-2 py-1 bg-zinc-600/70 ">
                          {/* Snapshot button */}
                          <TouchableHighlight underlayColor="rgb(113 113 122)"  onPress={()=>takeSnapShot() } className="flex flex-col justify-center items-center p-1 mr-3 ">
                              <View className="flex flex-col items-center space-y-1">
                              <Ionicons name="camera" size={18} color={isTakingSnapshot?"red":"white"}  />
                              <Text style={{fontSize:10,color:isTakingSnapshot?"red":"#fff"}}>{t('common:snapShot')}</Text>
                            </View>
                          </TouchableHighlight>
                          {/* Color mode toggle */}
                          <TouchableHighlight underlayColor="rgb(113 113 122)"   onPress={()=>toggleColorMode() } className="flex flex-col justify-center items-center p-1 mr-3">
                            <View className="flex flex-col items-center space-y-1">
                              <Ionicons name="color-palette-outline" size={18} color={colorMode ? "lime":"white"}   />
                              <Text style={{fontSize:10,color:colorMode ? "#32CD32":"#fff"}}>{t('common:color')}</Text>
                            </View>
                          </TouchableHighlight>
                         
                            {/* Normalize toggle */}
                            <TouchableHighlight underlayColor="rgb(113 113 122)" onPress={()=>toggleNormMode()} className="flex flex-col justify-center items-center p-1 mr-3 ">
                              <View className="flex flex-col items-center space-y-1">

                              <Ionicons name="flash" size={18} color={normMode > 0 ? "lime":"white"}  />
                            
                             
                              <Text style={{fontSize:10,color:normMode > 0 ? "#32CD32":"#fff"}}>{t('common:auto')}</Text>
                              
                              </View>
                             
                            </TouchableHighlight>

                            {/* Options toggle */}
                            <TouchableHighlight underlayColor="rgb(113 113 122)" onPress={toggleOptions} className="flex flex-col justify-center items-center p-1 mr-3">
                              <View className="flex flex-col items-center space-y-1">

                              <Ionicons name="options" size={18} color={displayOptions? "lime":"white"}  />
                              <Text style={{fontSize:10,color:displayOptions ? "#32CD32":"#fff"}}>{t('common:adjust')}</Text>
                              </View>
                             
                            </TouchableHighlight>
                            {/* Grid toggle */}
                            <TouchableHighlight underlayColor="rgb(113 113 122)" onPress={toggleGrid} className="flex flex-col justify-center items-center p-1 mr-3">
                              <View className="flex flex-col items-center space-y-1">

                              <Ionicons name="scan" size={18} color={displayGrid? "lime":"white"}  />
                              <Text style={{fontSize:10,color:displayGrid ? "#32CD32":"#fff"}}>{t('common:grid')}</Text>
                              </View>
                             
                            </TouchableHighlight>
                             {/* Focus toggle */}
                             { crop && 
                            <TouchableHighlight underlayColor="rgb(113 113 122)" onPress={toggleFocus} className="flex flex-col justify-center items-center p-1 mr-3">
                              <View className="flex flex-col items-center space-y-1">
                              <Ionicons name="prism" size={18} color={displayFocusAssistant ? "lime":"white"}  />
                              <Text style={{fontSize:10,color:displayFocusAssistant  ? "#32CD32":"#fff"}}>{t('common:focus')}</Text>
                              </View>
                             
                            </TouchableHighlight>}
                           
                             
                  
              </View>
           
           </View>}

           {/* Spectrum toggle buttons */}
           {(!rec && myContext.cameraIsConnected && crop)   &&
           <View className="absolute bottom-0 z-10 h-14" style={{ right:16, bottom:10}}>
            <View style={{ left:0, top:0}} className="  flex flex-row self-start ml-4 justify-center items-end rounded-lg px-2 py-1 bg-zinc-600/70 ">
                <TouchableHighlight underlayColor="rgb(113 113 122)"  onPress={()=>toggleSpectrum('vertical') } className="flex flex-col justify-center items-center px-1 py-2 ">
                    <View className="flex flex-col items-center">
                    <Entypo name="align-horizontal-middle" size={28}  color={displaySpectrum && displaySpectrumType == 'vertical' ? "lime":"white"}  />
                  </View>
                </TouchableHighlight>
                <TouchableHighlight underlayColor="rgb(113 113 122)"  onPress={()=>toggleSpectrum('horizontal') } className="flex flex-col justify-center items-center px-1 py-2 ">
                    <View className="flex flex-col items-center">
                    <Entypo name="align-vertical-middle"  style={{transform: [{rotateY: '180deg'}]}} size={28}  color={displaySpectrum && displaySpectrumType == 'horizontal' ? "lime":"white"}  />
                  </View>
                </TouchableHighlight>
              </View>
           </View>}
    
            {/* Right toolbar */}
            {(myContext.cameraIsConnected || myContext.demo) && <View className="absolute flex flex-col h-full items-center justify-center" style={stylesRighttoolBar}>
                <View  className=" bg-zinc-600/50 rounded-lg space-y-2 py-2 flex flex-col justify-evenly align-center items-center px-1" >
                    
                <TouchableHighlight underlayColor={crop ? "rgb(113 113 122)":"tranparent"}  onPress={()=>updatePosYCrop("down") } className="flex flex-col justify-center items-center w-12">
                        <Ionicons name="chevron-up" size={32} color={!crop || rec ? "rgb(113 113 122)":"white"}   />
                        </TouchableHighlight>
                        <TouchableHighlight underlayColor="rgb(113 113 122)" disabled={displaySpectrum}  onPress={toggleCrop} className="flex flex-col justify-center items-center w-12">
                
                        <Ionicons name="crop-outline" size={30} color={crop  ? "lime":"white"}   />
                        </TouchableHighlight>
                        <TouchableHighlight underlayColor={crop ? "rgb(113 113 122)":"tranparent"}   onPress={()=>updatePosYCrop("up") } className="flex flex-col justify-center items-center w-12 mb-4">
                        <Ionicons name="chevron-down" size={32} color={!crop || rec  ? "rgb(113 113 122)":"white"}   />
                        </TouchableHighlight>
                        
                        {/* Record button */}
                        <TouchableHighlight underlayColor={crop ? "rgb(113 113 122)":"tranparent"}   disabled={!crop || displaySpectrum || colorMode} onPress={() => {
          


                if(rec){
                    updateRec('stop');
                }else {
                    
                    if (timerId) {
                      clearInterval(timerId);
                      timerRef.current = 0;
                    }
                    setTime((0).toFixed(1) );
                    const tid = setInterval(() => {
                        timerRef.current += 1;
                        setTime((timerRef.current / 10).toFixed(1) );
                    }, 100);
                    setTimerId(tid);
                    updateRec('start');      
                } 

      
              
          }} className="flex flex-col justify-center items-center w-12">
            <Ionicons name={rec ? "stop-circle-outline":"radio-button-on-outline"} size={40} color={!crop || colorMode ? "rgb(113 113 122)":(rec ? "red":"white")}   />
                        </TouchableHighlight> 

                     
                </View>
            </View>}

 
            {/* Options panel */}
            {!rec  && !displaySpectrum && displayOptions && (myContext.cameraIsConnected || myContext.demo)   && (<View>
            <View className="absolute mb-4 w-full flex flex-row justify-center align-items " style={{ right:0, top:10}}>
          <View className="flex flex-row justify-start item-center align-center space-x-4 w-full">
           
              <View className="bg-zinc-600/70 rounded-lg py-2 flex flex-row justify-center align-center items-center px-4 w-3/4 mx-auto"  >

                  <View className="flex flex-row justify-evenly align-center items-center w-1/5"  >

                      {/* Exposure time control */}
                      <TouchableHighlight underlayColor="rgb(113 113 122)" onLongPress={()=>toggleExpMode()} onPress={()=>setSettings('exp')} className={settings == 'exp' ? "flex flex-col justify-between items-center w-10 pb-1 border-b border-white":"flex flex-col justify-between items-center w-10 pb-1 border-b border-transparent"}>

                            <View>
                           {expMode > 0  && <View style={{right:-8,top:-8}} className={settings == 'exp' ? "z-10 absolute self-start bg-red-600 rounded-full font-center flex flex-row h-4 w-4 justify-center items-center":"z-10 absolute self-start rounded-lg font-center flex flex-row h-4 w-4 justify-center items-center bg-zinc-500"} ><Text style={{fontSize:8}} className="text-white text-center ">{expMode == 1 ? 'SE':'LE'}</Text></View>}
                           <Text style={{fontSize:13}} className={settings == 'exp' ? "color-white font-bold":"color-zinc-400"}>EXP</Text>
                              <Text style={{fontSize:9}} className={settings == 'exp' ? "color-white":"color-zinc-400"}>{expMode == 0 ? (expTime).toFixed(0)+' m' : expMode == 1 ? (expTime).toFixed(1)+' m':(expTime/1000).toFixed(1)+' '}s</Text>
                </View>
                      </TouchableHighlight>
                      {/* Gain control */}
                      <TouchableHighlight underlayColor="rgb(113 113 122)" onPress={()=>setSettings('gain')} className={settings == 'gain' ? "flex flex-col justify-between items-center  w-10 pb-1 border-b border-white":"flex flex-col justify-between items-center  w-10 pb-1 border-b border-transparent"}>
                        <View>
                        <Text style={{fontSize:13}} className={settings == 'gain' ? "color-white font-bold":"color-zinc-400"}>GAIN</Text>
                              <Text style={{fontSize:9}} className={settings == 'gain' ? "color-white":"color-zinc-400"}>{gain.toFixed(1)} dB</Text>
                        </View>
                              
                      </TouchableHighlight>
               
                   </View>
                  {/* Exposure time slider */}
                  {isFocused && (settings == 'exp' ? <Slider
                    style={{flexGrow:10, height: 30}}
                    className=""
                    minimumValue={expMode == 0 ? 20: expMode == 1 ? 0.1:200}
                    maximumValue={expMode == 0? 160: expMode == 1 ? 20:30000}
                    value={expTime}
                    thumbTintColor="white"
                    minimumTrackTintColor="gray"
                    maximumTrackTintColor="gray"             
                    onSlidingComplete={(e)=>{ setExptime(e);}}    
                  />:
                   // Gain slider
                   <Slider
                    style={{flexGrow:10, height: 30}}
                    className=""
                    minimumValue={1.0}
                    value={gain}
                    maximumValue={22.0}
                    thumbTintColor="white"
                    minimumTrackTintColor="gray"
                    maximumTrackTintColor="gray"
                    onSlidingComplete={(e)=>{setGain(e); }}
                  />)}
                 
                    {/* Mono/Bin mode toggle and pixel stats display */}
                    <Pressable onPress={toggleMonoBinMode} className="flex flex-row justify-center items-center space-x-2">
                    <View className=" h-9 flex flex-col justify-center w-24">
                    <View className="flex flex-row justify-center items-center space-x-2">
                    <Text className='text-center text-white font-bold mb-1' style={{fontSize:11}}>Max ADU</Text><Text className='text-center text-white mb-1 ' style={{fontSize:9}}>(12-bit)</Text>
                      </View>
          
                        {monoBinMode == 0 && <View className="flex flex-row justify-center items-center space-x-2">
                        <Text className='bg-red-600 text-xs rounded-sm text-white px-1' style={{fontSize:10}}>{pixelStats.r}</Text>
                        <Text className='bg-green-600 text-xs rounded-sm text-white px-1' style={{fontSize:10}}>{pixelStats.g}</Text>
                        <Text className='bg-blue-500 text-xs rounded-sm text-white px-1' style={{fontSize:10}}>{pixelStats.b}</Text>
                        </View>}
                        {monoBinMode == 1 && <View className="flex flex-row justify-center items-center space-x-2">
                          <Text className='bg-red-600 text-xs font-bold  rounded-sm text-white px-1' style={{fontSize:10}}>{pixelStats.r}</Text>
                        <Text className='bg-gray-500 text-xs  rounded-sm text-white px-1' style={{fontSize:10}}>{pixelStats.g}</Text>
                        <Text className='bg-gray-500 text-xs  rounded-sm text-white px-1' style={{fontSize:10}}>{pixelStats.b}</Text>
                        </View>}
                        {monoBinMode == 2 && <View className="flex flex-row justify-center items-center space-x-2">
                          <Text className='bg-gray-600 text-xs  rounded-sm text-white px-1' style={{fontSize:10}}>{pixelStats.r}</Text>
                        <Text className='bg-green-600 text-xs font-bold  rounded-sm text-white px-1' style={{fontSize:10}}>{pixelStats.g}</Text>
                        <Text className='bg-gray-500 text-xs  rounded-sm text-white px-1' style={{fontSize:10}}>{pixelStats.b}</Text>
                        </View>}
                        {monoBinMode == 3 && <View className="flex flex-row justify-center items-center space-x-2">
                          <Text className='bg-gray-500 text-xs  rounded-sm text-white px-1' style={{fontSize:10}}>{pixelStats.r}</Text>
                        <Text className='bg-gray-500 text-xs  rounded-sm text-white px-1' style={{fontSize:10}}>{pixelStats.g}</Text>
                        <Text className='bg-blue-500 text-xs font-bold  rounded-sm text-white px-1' style={{fontSize:10}}>{pixelStats.b}</Text>
                        </View>}

                        </View>
                        <View>
                        { monoBinMode == 0 && <View className="flex flex-row justify-center items-center space-x-2">
                        <FontAwesome6 name={pixelStats.r <upperMaxLimit && pixelStats.g <upperMaxLimit && pixelStats.b <upperMaxLimit && (pixelStats.r >lowerExpLimit || pixelStats.g >lowerExpLimit || pixelStats.b >lowerExpLimit) ? "face-smile":"face-frown-open"} size={20} color="white"   />
                        </View>}
                        { monoBinMode == 1 && <View className="flex flex-row justify-center items-center space-x-2">
                        <FontAwesome6 name={pixelStats.r <upperMaxLimit && pixelStats.r >lowerExpLimit  ? "face-smile":"face-frown-open"} size={18} color="white"   />
                        </View>}
                        { monoBinMode == 2 && <View className="flex flex-row justify-center items-center space-x-2">
                        <FontAwesome6 name={pixelStats.g <upperMaxLimit && pixelStats.g >lowerExpLimit  ? "face-smile":"face-frown-open"} size={18} color="white"   />
                        </View>}
                        { monoBinMode == 3 && <View className="flex flex-row justify-center items-center space-x-2">
                        <FontAwesome6 name={pixelStats.b <upperMaxLimit && pixelStats.b >lowerExpLimit  ? "face-smile":"face-frown-open"} size={18} color="white"   />
                        </View>}
                          </View>
                    
                    </Pressable>                
            </View>
          </View>
      </View>
      {!rec && normMode == 0 && <View  className="absolute h-screen flex flex-col justify-center items-center p-4" style={{ left:0, top:0}}>
          <Text className="text-white mb-2 text-center" style={{width:40, fontSize:10}}>{maxThreshold*16*(colorMode ? 1 : 4)}</Text>
            <VerticalSlider     
              value={maxThreshold}
              onChange={(v) => {setMaxThreshold(v)}}
              height={250}
              width={20}
              step={2}
              min={0}
              max={256}
              borderRadius={5}
              minimumTrackTintColor="#e0e1e7"
              maximumTrackTintColor="#D1D1D6"
              containerStyle={{ backgroundColor: '#e0e0e0', borderRadius:10 }}
              sliderStyle={{ backgroundColor: 'rgb(82 82 91);', borderRadius: 10 }}
            />
             <Text className="text-white mt-2 text-center" style={{width:35, fontSize:10}}>0</Text>
        </View>
        }
        
        </View>)}
        </View>
        </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  
  },
  image: {
    flex:1,
    resizeMode: 'scale',
    justifyContent: 'top',
  },
  text: {
    color: 'white',
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#000000',
  }
});


