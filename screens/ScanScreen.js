
// Import necessary React and React Native components
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import { SafeAreaView } from 'react-native';

// Import icons from Expo vector icons
import Ionicons from '@expo/vector-icons/Ionicons'
import Entypo from '@expo/vector-icons/Entypo';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

// Import NativeWind for styling
import { NativeWindStyleSheet } from "nativewind";

// Import Image component from Expo
import { Image } from 'expo-image';

// Configure NativeWind to output styles for native platforms
NativeWindStyleSheet.setOutput({
  default: "native",
});

// Import ImageZoom for image zooming functionality
import ImageZoom from 'react-native-image-pan-zoom';

// Import custom components
import Loader from '../components/Loader';
import WebSocketContext  from '../utils/WSContext';
import AppContext from '../components/AppContext';
import TooltipPopin from '../components/TooltipPopin';
import Spectrum from '../components/Spectrum';

// Import Slider component
import Slider from '@react-native-community/slider';

// Import translation hook
import { useTranslation } from 'react-i18next';

// Main ScanScreen component
export default function ScanScreen({navigation}) {

    // Initialize translation hook
    const { t, i18n } = useTranslation();

    // State variables for managing the component
    const [frame, setFrame] = useState(null);
    const [fc, setFC] = useState(0);
    const fcRef = React.useRef(fc);
    const [pixelStats, setPixelStats] = useState({r:0, g:0, b:0});
    const webSocket = useRef(null);
    const [displaySpectrum, setDisplaySpectrum] = useState(false);
    const [displaySpectrumType, setDisplaySpectrumType] = useState("vertical");
    const [spectrumData, setSpectrumData] = useState([]);
    const [intensityData, setIntensityData] = useState([]);

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
    const [subscribe, unsubscribe] = useContext(WebSocketContext)

    // Effect hook for managing subscriptions and fetching camera status
    useEffect(() => {
        getCameraStatus();
        
        // Subscribe to 'camera' events
        subscribe('camera', (message) => {
            fcRef.current += 1
            setFC(fcRef.current)
            if(fcRef.current%10==0)
              setPixelStats({min:parseInt(message[1]), max:parseInt(message[2])});

            if (!displaySpectrum) {
              setFrame(message[3]);
            }
        
        })

        // Subscribe to 'adu' events
        subscribe('adu', (message) => {  
          if(fcRef.current%5==0)
            setPixelStats({r:parseInt(message[1]), g:parseInt(message[2]), b:parseInt(message[3])});
      })

      // Subscribe to 'spectrum' events
      subscribe('spectrum', (message) => {
        if (displaySpectrumType == "vertical" && displaySpectrum) {
          console.log("spectrum")
          if(fcRef.current%2==0)
            setSpectrumData(message[1].split(','));
        }
        else {
          unsubscribe('spectrum');
        }
    })

      // Subscribe to 'intensity' events
      subscribe('intensity', (message) => {
        
        if (displaySpectrumType == "horizontal" && displaySpectrum) {
            console.log("intensity")
          if(fcRef.current%2==0)
            setIntensityData(message[1].split(','));
        }
        else {
          unsubscribe('intensity');
        }
    })


       

        // Cleanup function to unsubscribe from all events
        return () => {
          unsubscribe('camera');
          unsubscribe('adu');
          unsubscribe('spectrum');
          unsubscribe('intensity');
        }

    }, [subscribe, unsubscribe, displaySpectrum, displaySpectrumType]);
      
    
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
            setNormalize(json.normalize);
            setColorMode(!json.monobin);
            setBinMode(json.bin);
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
    const [normalize, setNormalize] = React.useState(false);


    const [expTime, setExptime] = React.useState(130);
    const [gain, setGain] = React.useState(3.0);
    const [isLoading, setIsLoading] = useState(false);
    const [displayGrid, setDisplayGrid] = useState(false);
    const [displayOptions, setDisplayOptions] = useState(false);
    const [snapShotFilename, setSnapShotFilename] = useState("");
    const [settings, setSettings] = useState("exp");
    const [monoBinMode, setMonoBinMode] = useState(false);

    // Function to update camera controls
    async function updateControls() {
      setIsLoading(true);
      fetch('http://'+myContext.apiURL+"/camera/controls/",{
        method: "POST", 
        headers: {
          'Content-Type': 'application/json'
      },
        body: JSON.stringify({gain:gain, exp:expTime}),
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
      fetch('http://'+myContext.apiURL+"/camera/take-snapshot/").then(response => response.json())
      .then(json => {
        setSnapShotFilename(json.filename)
        setTimeout(()=>{setSnapShotFilename('')},2000);
        setIsLoading(false);
      })
      .catch(error => {
        setSnapShotFilename(error)
        setIsLoading(false);
      });
    }

    // Function to toggle crop mode
    async function toggleCrop() {
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

    // Function to toggle normalization
    async function toggleNorm() {
      setIsLoading(true);
      fetch('http://'+myContext.apiURL+"/camera/toggle-normalize/").then(response => response.json())
      .then(json => {
        setNormalize(!normalize)
        setIsLoading(false);
      })
      .catch(error => {
        console.error(error);
        setIsLoading(false);
      });
    }


    // Function to update recording status
    async function updateRec(type) {
      
      setIsLoading(true);
      fetch('http://'+myContext.apiURL+"/camera/record/"+type+"/").then(response => response.json())
      .then(json => {
        setRec(!rec)
        setIsLoading(false);
      })
      .catch(error => {
        console.error(error);
        setIsLoading(false);
      });
    }

    // Function to update Y-axis crop position
    async function updatePosYCrop(type) {
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

  

  // Function to toggle options display
  const toggleOptions = () => {
      setDisplayOptions(!displayOptions);
  };

  // Function to toggle grid display
  const toggleGrid = () => {
      setDisplayGrid(!displayGrid);
  };

  // Styles for right toolbar (platform-specific)
  const stylesRighttoolBar = StyleSheet.create({
    right: Platform.OS === 'ios' ? 0 : 16,
  });

    return (
    
     <SafeAreaView className="bg-zinc-800" style={{flex:1}}>
      <View className="flex flex-col " style={{flex:1}}>
  
            
  
            {/* Main container for displaying the camera feed or spectrum */}
            <View className="absolute z-1 flex flex-col justify-center" style={{ right:0, left:0, top:0, width:"100%", height:"100%"}}>
            {!displaySpectrum && (frame && myContext.cameraIsConnected ? 
            <ImageZoom cropWidth={Dimensions.get('window').width-18}
                       cropHeight={Dimensions.get('window').height}
                       imageWidth={500}
                       imageHeight={crop ? 29:200}>
                        {/* Grid overlay for alignment */}
                        {displayGrid && !rec && <View className="absolute w-full h-full z-30 "><View className="mx-auto z-40 h-full" style={{width:1, backgroundColor:"lime"}}></View></View>} 
                        {displayGrid && !rec && <View className="absolute w-full h-full z-30 flex flex-row items-center "><View className="z-40 w-full" style={{height:1, backgroundColor:"lime"}}></View></View>}
                {/* Camera feed image */}
                <Image
                style={styles.image}
                source={{ uri: frame }} 
                contentFit='contain'
                className="border border-white"
                />
                </ImageZoom>:<View className="mx-auto"><Loader type="white" /></View>)}

                {/* Spectrum display */}
                {displaySpectrum && displaySpectrumType === "vertical"  && <Spectrum data={spectrumData} title="Spectre" subtitle="Profil vertical / Mise au point caméra" />}
                {displaySpectrum && displaySpectrumType === "horizontal"  && <Spectrum data={intensityData} title="Continuum" subtitle="Profil horizontal / Mise au point lunette" />}
               
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

                

           {/* Bottom toolbar */}
           {!rec && !displaySpectrum && (myContext.cameraIsConnected || myContext.demo)  &&
           <View className="absolute bottom-0 w-full h-14 z-10 " style={{ right:0, bottom:10}}>

     
            <View style={{ left:0, top:0}} className=" flex flex-row mx-auto justify-center items-center rounded-lg px-2 py-1 bg-zinc-600/70 ">
                          {/* Snapshot button */}
                          {myContext.debug && <TouchableHighlight underlayColor="rgb(113 113 122)"  onPress={()=>takeSnapShot() } className="flex flex-col justify-center items-center p-1 mr-3 ">
                              <View className="flex flex-col items-center space-y-1">
                              <Ionicons name="camera" size={18} color="white"  />
                              <Text style={{fontSize:10,color:"#fff"}}>{t('common:snapShot')}</Text>
                            </View>
                          </TouchableHighlight>}
                          {/* Color mode toggle */}
                          <TouchableHighlight underlayColor="rgb(113 113 122)"   onPress={()=>toggleColorMode() } className="flex flex-col justify-center items-center p-1 mr-3">
                            <View className="flex flex-col items-center space-y-1">
                              <Ionicons name="color-palette-outline" size={18} color={colorMode ? "lime":"white"}   />
                              <Text style={{fontSize:10,color:colorMode ? "#32CD32":"#fff"}}>{t('common:color')}</Text>
                            </View>
                          </TouchableHighlight>
                         
                            {/* Normalize toggle */}
                            <TouchableHighlight underlayColor="rgb(113 113 122)" onPress={toggleNorm} className="flex flex-col justify-center items-center p-1 mr-3 ">
                              <View className="flex flex-col items-center space-y-1">

                              <Ionicons name="flash" size={18} color={normalize? "lime":"white"}  />
                              <Text style={{fontSize:10,color:normalize ? "#32CD32":"#fff"}}>{t('common:norm')}</Text>
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
                           
                             
                  
              </View>
           
           </View>}

           {/* Spectrum toggle buttons */}
           {(!rec && myContext.cameraIsConnected && crop)   &&
           <View className="absolute bottom-0 z-10 h-14" style={{ left:0, bottom:10}}>
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
            {(myContext.cameraIsConnected || myContext.demo) && !colorMode && <View className="absolute flex flex-col h-full items-center justify-center" style={stylesRighttoolBar}>
                <View  className=" bg-zinc-600/50 rounded-lg space-y-2 py-2 flex flex-col justify-evenly align-center items-center px-1" >
                    
                <TouchableHighlight underlayColor={crop ? "rgb(113 113 122)":"tranparent"}  onPress={()=>updatePosYCrop("down") } className="flex flex-col justify-center items-center w-12">
                        <Ionicons name="chevron-up" size={32} color={!crop ? "rgb(113 113 122)":"white"}   />
                        </TouchableHighlight>
                        <TouchableHighlight underlayColor="rgb(113 113 122)" disabled={displaySpectrum}  onPress={toggleCrop} className="flex flex-col justify-center items-center w-12">
                
                        <Ionicons name="crop-outline" size={30} color={crop ? "lime":"white"}   />
                        </TouchableHighlight>
                        <TouchableHighlight underlayColor={crop ? "rgb(113 113 122)":"tranparent"}   onPress={()=>updatePosYCrop("up") } className="flex flex-col justify-center items-center w-12 mb-4">
                        <Ionicons name="chevron-down" size={32} color={!crop ? "rgb(113 113 122)":"white"}   />
                        </TouchableHighlight>
                        
                        {/* Record button */}
                        <TouchableHighlight underlayColor={crop ? "rgb(113 113 122)":"tranparent"}   disabled={!crop || displaySpectrum} onPress={() => {
          


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
            <Ionicons name={rec ? "stop-circle-outline":"radio-button-on-outline"} size={40} color={!crop ? "rgb(113 113 122)":(rec ? "red":"white")}   />
                        </TouchableHighlight> 

                     
                </View>
            </View>}

 
            {/* Options panel */}
            {!rec && !colorMode && !displaySpectrum && displayOptions && (myContext.cameraIsConnected || myContext.demo)   && (
            <View className="absolute mb-4 w-full flex flex-row justify-center align-items " style={{ right:0, top:10}}>
                <View className="flex flex-row justify-start item-center align-center space-x-4 w-full">
                 
                    <View className="bg-zinc-600/70 rounded-lg py-2 flex flex-row justify-center align-center items-center px-4 w-3/4 mx-auto"  >

                        <View className="flex flex-row justify-evenly align-center items-center w-1/5"  >

                            {/* Exposure time control */}
                            <TouchableHighlight underlayColor="rgb(113 113 122)" onLongPress={()=>toggleExpMode()} onPress={()=>setSettings('exp')} className={settings == 'exp' ? "flex flex-col justify-between items-center w-10 pb-1 border-b border-white":"flex flex-col justify-between items-center w-10 pb-1 border-b border-transparent"}>

                                  <>
                                 {expMode > 0  && <View style={{right:-8,top:-8}} className={settings == 'exp' ? "z-10 absolute self-start bg-red-600 rounded-full font-center flex flex-row h-4 w-4 justify-center items-center":"z-10 absolute self-start rounded-lg font-center flex flex-row h-4 w-4 justify-center items-center bg-zinc-500"} ><Text style={{fontSize:8}} className="text-white text-center ">{expMode == 1 ? 'SE':'LE'}</Text></View>}
                                 <Text style={{fontSize:13}} className={settings == 'exp' ? "color-white font-bold":"color-zinc-400"}>EXP</Text>
                                    <Text style={{fontSize:9}} className={settings == 'exp' ? "color-white":"color-zinc-400"}>{expMode == 0 ? (expTime).toFixed(0)+' m' : expMode == 1 ? (expTime).toFixed(1)+' m':(expTime/1000).toFixed(1)+' '}s</Text>
                      </>
                            </TouchableHighlight>
                            {/* Gain control */}
                            <TouchableHighlight underlayColor="rgb(113 113 122)" onPress={()=>setSettings('gain')} className={settings == 'gain' ? "flex flex-col justify-between items-center  w-10 pb-1 border-b border-white":"flex flex-col justify-between items-center  w-10 pb-1 border-b border-transparent"}>
                              <>
                              <Text style={{fontSize:13}} className={settings == 'gain' ? "color-white font-bold":"color-zinc-400"}>GAIN</Text>
                                    <Text style={{fontSize:9}} className={settings == 'gain' ? "color-white":"color-zinc-400"}>{gain.toFixed(1)} dB</Text>
                              </>
                                    
                            </TouchableHighlight>
                         </View>
                        {/* Exposure time slider */}
                        {isFocused&& (settings == 'exp' ? <Slider
                          style={{flexGrow:10, height: 30}}
                          className=""
                          minimumValue={expMode == 0 ? 20: expMode == 1 ? 0.1:200}
                          maximumValue={expMode == 0? 160: expMode == 1 ? 20:30000}
                          value={expTime}
                          thumbTintColor="white"
                          minimumTrackTintColor="gray"
                          maximumTrackTintColor="gray"
                         
                          onSlidingComplete={(e)=>{updateControls()}}
                          onValueChange={(e)=>setExptime(e)}
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
                          onSlidingComplete={(e)=>{updateControls()}}
                          onValueChange={(e)=>setGain(e)}
                        />)}
                       
                          {/* Mono/Bin mode toggle and pixel stats display */}
                          <Pressable onPress={toggleMonoBinMode} className="flex flex-row justify-center items-center space-x-2">
                          <View className=" h-9 flex flex-col justify-center w-24">
                          <View className="flex flex-row justify-center items-center space-x-2">
                          <Text className='text-center text-white font-bold mb-1' style={{fontSize:11}}>Max ADU</Text><Text className='text-center text-white mb-1 ' style={{fontSize:9}}>(12-bit)</Text>
                            </View>
                
                              {monoBinMode == 0 && <View className="flex flex-row justify-center items-center space-x-2">
                              <Text className='bg-red-600 text-xs rounded text-white px-1' style={{fontSize:10}}>{pixelStats.r}</Text>
                              <Text className='bg-green-600 text-xs rounded text-white px-1' style={{fontSize:10}}>{pixelStats.g}</Text>
                              <Text className='bg-blue-500 text-xs rounded text-white px-1' style={{fontSize:10}}>{pixelStats.b}</Text>
                              </View>}
                              {monoBinMode == 1 && <View className="flex flex-row justify-center items-center space-x-2">
                                <Text className='bg-red-500 text-xs font-bold  rounded text-white px-1' style={{fontSize:10}}>{pixelStats.r}</Text>
                              <Text className='bg-gray-500 text-xs  rounded text-white px-1' style={{fontSize:10}}>{pixelStats.g}</Text>
                              <Text className='bg-gray-500 text-xs  rounded text-white px-1' style={{fontSize:10}}>{pixelStats.b}</Text>
                              </View>}
                              {monoBinMode == 2 && <View className="flex flex-row justify-center items-center space-x-2">
                                <Text className='bg-gray-600 text-xs  rounded text-white px-1' style={{fontSize:10}}>{pixelStats.r}</Text>
                              <Text className='bg-green-600 text-xs font-bold  rounded text-white px-1' style={{fontSize:10}}>{pixelStats.g}</Text>
                              <Text className='bg-gray-500 text-xs  rounded text-white px-1' style={{fontSize:10}}>{pixelStats.b}</Text>
                              </View>}
                              {monoBinMode == 3 && <View className="flex flex-row justify-center items-center space-x-2">
                                <Text className='bg-gray-500 text-xs  rounded text-white px-1' style={{fontSize:10}}>{pixelStats.r}</Text>
                              <Text className='bg-gray-500 text-xs  rounded text-white px-1' style={{fontSize:10}}>{pixelStats.g}</Text>
                              <Text className='bg-blue-500 text-xs font-bold  rounded text-white px-1' style={{fontSize:10}}>{pixelStats.b}</Text>
                              </View>}

                              </View>
                              <View>
                              { monoBinMode == 0 && <View className="flex flex-row justify-center items-center space-x-2">
                              <FontAwesome6 name={pixelStats.r <4095 && pixelStats.g <4095 && pixelStats.b <4095 && (pixelStats.r >3000 || pixelStats.g >3000 || pixelStats.b >3000) ? "face-smile":"face-frown-open"} size={20} color="white"   />
                              </View>}
                              { monoBinMode == 1 && <View className="flex flex-row justify-center items-center space-x-2">
                              <FontAwesome6 name={pixelStats.r <4095 && pixelStats.r >3000  ? "face-smile":"face-frown-open"} size={18} color="white"   />
                              </View>}
                              { monoBinMode == 2 && <View className="flex flex-row justify-center items-center space-x-2">
                              <FontAwesome6 name={pixelStats.g <4095 && pixelStats.g >3000  ? "face-smile":"face-frown-open"} size={18} color="white"   />
                              </View>}
                              { monoBinMode == 3 && <View className="flex flex-row justify-center items-center space-x-2">
                              <FontAwesome6 name={pixelStats.b <4095 && pixelStats.b >3000  ? "face-smile":"face-frown-open"} size={18} color="white"   />
                              </View>}
                                </View>
                          
                          </Pressable>                
                  </View>
                </View>
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


