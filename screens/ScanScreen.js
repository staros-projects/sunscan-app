
// Import necessary React and React Native components
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import ConnectCameraPanel from '../components/ConnectCameraPanel';
import CropHint from '../components/CropHint';
import Spectrum from '../components/Spectrum';

// Import Slider component
import Slider from '@react-native-community/slider';

// Import translation hook
import { useTranslation } from 'react-i18next';
import { Zoomable } from '@likashefqet/react-native-image-zoom';
import ModalLineSelector from '../components/ModalLineSelector';
import ModalExposureInput from '../components/ModalExposureInput';
import ExposureTip from '../components/ExposureTip';
import { useOverlay } from '../components/OverlayHost';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from '../components/PressableScale';
import PulseDot from '../components/PulseDot';
import { toolbarSurface } from '../components/theme';
import ScanAssistant from '../components/ScanAssistant';
import ThresholdSlider from '../components/ThresholdSlider';
import useScanAssistant from '../utils/useScanAssistant';
import useLineIdent from '../utils/useLineIdent';
import LineIdentOverlay from '../components/LineIdentOverlay';
import LineIdentStatus from '../components/LineIdentStatus';
import FocusAssistant from '../components/FocusAssistant';
import ScanPreview from '../components/ScanPreview';
import useScanPreview from '../utils/useScanPreview';
import useAutoExposure, { exposureModeFor } from '../utils/useAutoExposure';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSharedValue } from 'react-native-reanimated';

// Box of the live image outside cropped mode, the only mode the line
// identification runs in
const FULL_FRAME_WIDTH = 402;
const FULL_FRAME_HEIGHT = 200;
const AUTO_EXPOSURE_STORAGE_KEY = 'SUNSCAN_APP::AUTO_EXPOSURE';
// Set once the EXP walkthrough has been dismissed : it is only shown once
const EXP_TIP_STORAGE_KEY = 'SUNSCAN_APP::EXP_TIP_SEEN';

// Exposures the camera accepts, in ms : the three slider ranges taken end to
// end. What is typed by hand is held inside them.
const MANUAL_EXP_MIN_MS = 0.1;
const MANUAL_EXP_MAX_MS = 30000;

// Grace period between the estimated end of the crossing and the auto stop
const AUTO_STOP_DELAY_S = 30;

// Main ScanScreen component
export default function ScanScreen({navigation}) {

    // Initialize translation hook
    const { t, i18n } = useTranslation();

    // State variables for managing the component
    const [frame, setFrame] = useState(null);
    // Frame counter, kept in a ref only : it decimates the adu / focus /
    // spectrum handlers below and is never rendered. It used to be state as
    // well, which re-rendered the whole screen on every frame for nothing.
    const fcRef = React.useRef(0);
    const [pixelStats, setPixelStats] = useState({r:0, g:0, b:0});
    const [sharpness, setSharpness] = useState(0);
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

    // Alignment assistant : predicts the scan duration and tells where to park
    // the solar disk along the slit before starting. It is fed from the
    // 'intensity' subscription below rather than subscribing itself, so the
    // profile string is only split once per frame.
    // Shown by default offline, where it is the only thing on the screen with
    // anything to say : there is no camera feed to look at.
    const [displayAssistant, setDisplayAssistant] = useState(!!myContext.demo);
    const assistantFeedRef = useRef(null);
    // Read from the frame callback below, which runs at the frame rate : going
    // through the context there would capture a stale value and re-render.
    const cameraConnectedRef = useRef(myContext.cameraIsConnected);
    cameraConnectedRef.current = myContext.cameraIsConnected;

    // The camera state is read when the screen is entered, and nowhere else :
    // it used to sit in the subscription effect below, which re-runs on every
    // spectrum or assistant toggle, so each toggle fired another request at a
    // Pi already busy streaming the feed.
    useFocusEffect(
      useCallback(() => { getCameraStatus(); }, [myContext.apiURL])
    );

    // Effect hook for managing subscriptions
    //console.log('render')
    useFocusEffect(
      useCallback(() => {
        // Debounce avec lodash (déclenche l'action après 200ms d'inactivité)
        const debouncedUpdate = debounce((callback) => {
          callback();
        }, 200); // 200ms, ce qui permet une mise à jour maximum toutes les 5 fois par seconde
    
        // Subscribe to 'camera' events
        subscribe('camera', (message) => {
          fcRef.current += 1;
          // A frame is the camera answering : a status request that failed must
          // not leave the connection panel up over a feed that is coming in.
          if (!cameraConnectedRef.current) {
            cameraConnectedRef.current = true;
            myContext.setCameraIsConnected(true);
          }
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
            setSharpness(parseFloat(message[1])/100);
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
    
        // Subscribe to 'intensity' events. The payload is the brightness profile
        // along the slit, which feeds both the continuum graph and the alignment
        // assistant, so the subscription stays alive for either of them.
        subscribe('intensity', (message) => {
          const showsGraph = displaySpectrumType === 'horizontal' && displaySpectrum;
          const feedsAssistant = assistantFeedRef.current != null;

          if (!showsGraph && !feedsAssistant) {
            unsubscribe('intensity');
            return;
          }

          const profile = message[1].split(',');
          if (feedsAssistant) {
            // Throttles itself, so it is safe to hand it every frame
            assistantFeedRef.current(profile);
          }
          if (showsGraph && fcRef.current % 2 === 0) {
            debouncedUpdate(() => setIntensityData(profile));
          }
        });
    
        // Cleanup function to unsubscribe from all events
        return () => {
          unsubscribe('camera');
          unsubscribe('adu');
          unsubscribe('focus');
          unsubscribe('spectrum');
          unsubscribe('intensity');
        };
        // displayAssistant is a dependency because the callback above drops the
        // subscription once nothing needs the profile : turning the assistant
        // back on has to re-subscribe.
      }, [isFocused, displaySpectrum, displaySpectrumType, displayAssistant])
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
        // The request failed, the backend said nothing : the camera may well be
        // streaming. Marking it disconnected here hid the live feed until the
        // screen was left and entered again.
        console.warn('camera status unreachable', error);
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
    const timerIdRef = React.useRef(null);

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
    // The camera has to restart its stream to switch between full frame and
    // cropped mode, which takes a moment : the button stays busy until the
    // backend answers so the toggle cannot be fired again in the meantime.
    const [isTogglingCrop, setIsTogglingCrop] = useState(false);
    const [maxThreshold, setMaxThreshold] = useState(256);

    // Automatic exposure, remembered from one session to the next. Frozen
    // while recording : the exposure must not move in the middle of a scan
    // (see recFreezeRef below).
    const [autoExp, setAutoExp] = useState(false);
    useEffect(() => {
      AsyncStorage.getItem(AUTO_EXPOSURE_STORAGE_KEY)
        .then((stored) => { if (stored != null) setAutoExp(stored === 'true'); })
        .catch(() => {});
    }, []);
    const toggleAutoExp = () => {
      const next = !autoExp;
      setAutoExp(next);
      AsyncStorage.setItem(AUTO_EXPOSURE_STORAGE_KEY, String(next)).catch(() => {});
    };
    // Shown when record is pressed outside cropped mode, to point at the crop button
    const [cropHintVisible, setCropHintVisible] = useState(false);

    // Exposure typed in rather than slid to. In cropped mode nothing sets the
    // exposure automatically and the slider is far too coarse to land on a
    // given value : this is how an exposure found once is set again exactly.
    const [expInputVisible, setExpInputVisible] = useState(false);
    const applyManualExposure = (exposureMs) => {
      setExpInputVisible(false);
      const clamped = Math.min(MANUAL_EXP_MAX_MS, Math.max(MANUAL_EXP_MIN_MS, exposureMs));
      // The slider follows : its range has to hold the new exposure, or the
      // thumb would sit against a bound showing something else than the camera.
      setExpMode(exposureModeFor(clamped));
      setExptime(clamped);
    };

    // Walkthrough of the EXP tile, whose two gestures nothing on it shows.
    // null while the stored flag is read, so it cannot flash up on a device
    // where it has already been dismissed.
    const [expTipSeen, setExpTipSeen] = useState(null);
    const [expTipTarget, setExpTipTarget] = useState(null);
    const expTileRef = useRef(null);
    useEffect(() => {
      AsyncStorage.getItem(EXP_TIP_STORAGE_KEY)
        .then((stored) => setExpTipSeen(stored === 'true'))
        .catch(() => setExpTipSeen(false));
    }, []);
    // In debug mode it comes back on every opening of the settings panel, to
    // try it out without clearing the app data : this only keeps it from
    // coming straight back while the panel stays open.
    const [expTipShownThisPanel, setExpTipShownThisPanel] = useState(false);
    const closeExpTip = useCallback(() => {
      setExpTipTarget(null);
      setExpTipSeen(true);
      setExpTipShownThisPanel(true);
      AsyncStorage.setItem(EXP_TIP_STORAGE_KEY, 'true').catch(() => {});
    }, []);

    // Also enabled while recording, even with the panel hidden : the scan
    // duration it estimates sizes the disk preview and drives the auto stop.
    const assistant = useScanAssistant({ enabled: displayAssistant || rec, recording: rec, locate: displayAssistant });
    const scanDurationS = assistant.geometry?.scanDurationS;
    const preview = useScanPreview({ recording: rec, scanDurationS });

    // Set while a start or stop call is on its way, so the record button shows
    // that the press was taken into account and cannot be fired twice.
    const [isRecPending, setIsRecPending] = useState(false);

    // Set as soon as record is pressed, before the backend has answered and
    // `rec` follows : from then on nothing may touch the exposure.
    const recFreezeRef = useRef(false);
    // Full frame colour only : in mono and in cropped mode, where scans are
    // prepared, the exposure stays in the observer's hands.
    const autoExpAvailable = colorMode && !crop;
    const autoExpOn = autoExp && autoExpAvailable;
    const autoExpActive = autoExpOn && !rec && !isRecPending && isFocused && !!myContext.cameraIsConnected;
    useAutoExposure({
      enabled: autoExpActive,
      exposureMs: expTime,
      pixelStats,
      onChange: (exposureMs) => {
        if (recFreezeRef.current) return;
        setExpMode(exposureModeFor(exposureMs));
        setExptime(exposureMs);
      },
    });


    // Publish the feed through a ref so the websocket callback can reach it
    // without the subscription having to be torn down on every re-render.
    useEffect(() => {
      assistantFeedRef.current = displayAssistant ? assistant.ingestProfile : null;
      return () => { assistantFeedRef.current = null; };
    }, [displayAssistant, assistant.ingestProfile]);

    // The profile only exists in cropped mono mode, which is also the only mode
    // that can record : outside it the assistant has nothing to measure. Offline
    // mode never gets a camera status back, so it is let through on its own and
    // runs off the simulated instant instead.
    const assistantAvailable = (crop && !colorMode) || myContext.demo;
    // While recording, the progress gauge shows even with the panel closed as
    // soon as the position gives an ephemeris : no location prompt mid scan.
    const assistantVisible = (displayAssistant || (rec && assistant.geometry != null))
      && assistantAvailable && !displaySpectrum
      && (myContext.cameraIsConnected || myContext.demo);

    // Spectral line identification. It needs about a hundred angstroms of
    // spectrum to tell where it is, so it only exists outside cropped mode. In
    // colour the backend builds the profile from the raw Bayer frame, at the
    // same scale as in mono : the overlay is laid out the same in both.
    const [displayIdent, setDisplayIdent] = useState(false);
    const identAvailable = !crop;
    const identActive = displayIdent && identAvailable && isFocused && !rec
      && !!myContext.cameraIsConnected;
    const ident = useLineIdent({ enabled: identActive, source: colorMode ? 'color' : 'mono', frame });

    // The labels live inside the Zoomable and follow it on their own. What
    // they cannot know is how far the zoom went and which part of the frame is
    // left on screen : read once the gesture is over, and once more after the
    // library has finished easing the image back inside its bounds.
    const zoomRef = useRef(null);
    const zoomScale = useSharedValue(1);
    const zoomTimerRef = useRef(null);
    const [zoomView, setZoomView] = useState({ zoom: 1, visibleLeft: -FULL_FRAME_WIDTH, visibleRight: 2 * FULL_FRAME_WIDTH });

    const readZoomView = useCallback(() => {
      const info = zoomRef.current?.getInfo?.();
      if (!info) {
        return;
      }
      const { scale, translateX } = info.transformations;
      const half = info.container.width / 2;
      // Content abscissas showing at the edges of the screen, brought into
      // the frame of the image, which sits centred in the container
      const left = half - (half + translateX) / scale;
      const right = half + (half - translateX) / scale;
      const offset = (info.container.width - FULL_FRAME_WIDTH) / 2;
      setZoomView({
        zoom: Math.max(1, scale),
        visibleLeft: left - offset,
        visibleRight: right - offset,
      });
    }, []);

    const refreshZoomView = useCallback(() => {
      readZoomView();
      clearTimeout(zoomTimerRef.current);
      zoomTimerRef.current = setTimeout(readZoomView, 400);
    }, [readZoomView]);

    useEffect(() => () => clearTimeout(zoomTimerRef.current), []);

    // Last controls request sent, so that a recording does not start while
    // an exposure change is still on its way to the camera
    const controlsRequestRef = useRef(null);

    // Function to update camera controls
    async function updateControls() {
      setIsLoading(true);
      controlsRequestRef.current = fetch('http://'+myContext.apiURL+"/camera/controls/",{
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
      if (isTogglingCrop) {
        return;
      }

      if (displayFocusAssistant && crop) {
        fetch('http://'+myContext.apiURL+"/camera/toggle-focus-assistant/").then(response => response.json())
        .then(json => {
          setDisplayFocusAssistant(json.focus_assistant);
        })
        .catch(error => {
          console.error(error);
        });
      }

      setIsTogglingCrop(true);
      fetch('http://'+myContext.apiURL+"/camera/toggle-crop/").then(response => response.json())
      .then(json => {
        setCrop(previous => !previous);
        setIsTogglingCrop(false);
        setCropHintVisible(false);
      })
      .catch(error => {
        console.error(error);
        setIsTogglingCrop(false);
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
      if (type === 'start' && parseFloat(myContext.freeStorage) / 10e8 < 1.2) {
        console.log("low storage, free : ", parseFloat(myContext.freeStorage))
        Alert.alert(t('common:warning'), t('common:lowStorageWarning'));
        return;
      }

      setIsLoading(true);
      setIsRecPending(true);
      if (type === 'start') {
        // Freeze the exposure, and let an automatic change already sent
        // reach the camera before the first frame of the scan
        recFreezeRef.current = true;
        await controlsRequestRef.current?.catch(() => {});
      }
      fetch('http://'+myContext.apiURL+"/camera/record/"+type+"/").then(response => response.json())
      .then(json => {
        setRec(type === 'start')
        recFreezeRef.current = type === 'start';
        setIsLoading(false);
        setIsRecPending(false);

        if (type === 'stop') {
          clearInterval(timerIdRef.current);
          timerIdRef.current = null;
        }

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
        // A failed start leaves the camera idle, a failed stop recording
        recFreezeRef.current = type === 'stop';
        setIsLoading(false);
        setIsRecPending(false);
      });
    }

    function startScan() {
      clearInterval(timerIdRef.current);
      timerRef.current = 0;
      setTime((0).toFixed(1));
      timerIdRef.current = setInterval(() => {
        timerRef.current += 1;
        setTime((timerRef.current / 10).toFixed(1));
      }, 100);
      updateRec('start');
    }

    useEffect(() => () => clearInterval(timerIdRef.current), []);

    // Auto stop : once the ephemeris duration of the crossing has elapsed, the
    // scan is stopped on its own if nobody did it within AUTO_STOP_DELAY_S.
    // Nothing tells for sure that the disk has left, hence the margin.
    const elapsedS = parseFloat(time) || 0;
    const scanLooksDone = rec && Number.isFinite(scanDurationS) && elapsedS >= scanDurationS;
    const [autoStopCancelled, setAutoStopCancelled] = useState(false);
    const [autoStopIn, setAutoStopIn] = useState(null);
    const updateRecRef = useRef(updateRec);
    updateRecRef.current = updateRec;

    useEffect(() => {
      if (!rec) setAutoStopCancelled(false);
    }, [rec]);

    useEffect(() => {
      // A stop already on its way must not be fired a second time
      if (!myContext.autoStop || !scanLooksDone || autoStopCancelled || isRecPending) {
        setAutoStopIn(null);
        return undefined;
      }
      const deadline = Date.now() + AUTO_STOP_DELAY_S * 1000;
      setAutoStopIn(AUTO_STOP_DELAY_S);
      const id = setInterval(() => {
        const left = Math.ceil((deadline - Date.now()) / 1000);
        if (left <= 0) {
          clearInterval(id);
          setAutoStopIn(null);
          updateRecRef.current('stop');
        } else {
          setAutoStopIn(left);
        }
      }, 1000);
      return () => clearInterval(id);
    }, [myContext.autoStop, scanLooksDone, autoStopCancelled, isRecPending]);

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
      // Start from a blank measure : a score left from the last session
      // would otherwise show up as the first sample
      setSharpness(0);
      fetch('http://'+myContext.apiURL+"/camera/toggle-focus-assistant/").then(response => response.json())
      .then(json => {
        setDisplayFocusAssistant(json.focus_assistant);
        setIsLoading(false);
      })
      .catch(error => {
        console.error(error);
         setDisplayFocusAssistant(false);
         setIsLoading(false);
      });
  };

  
const insets = useSafeAreaInsets();

  // Styles for right toolbar (platform-specific)
  const stylesRighttoolBar = StyleSheet.create({
    marginRight: insets.right,
    right: 5,
  });

  useEffect(() => {
  updateControls();
}, [expTime, gain, maxThreshold]);

  // The EXP walkthrough comes up the first time the settings panel opens in
  // cropped mode, where typing the exposure in is offered. Measured once the
  // panel has been laid out : the window has to land on the tile.
  const optionsPanelShown = !rec && !displaySpectrum && displayOptions
    && !!(myContext.cameraIsConnected || myContext.demo);
  useEffect(() => {
    if (!optionsPanelShown) {
      setExpTipShownThisPanel(false);
    }
  }, [optionsPanelShown]);
  const expTipDue = myContext.debug ? !expTipShownThisPanel : expTipSeen === false;
  useEffect(() => {
    if (!expTipDue || !crop || !optionsPanelShown || !isFocused) {
      return;
    }
    const id = setTimeout(() => {
      expTileRef.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          setExpTipTarget({ x, y, width, height });
        }
      });
    }, 400);
    return () => clearTimeout(id);
  }, [expTipDue, crop, optionsPanelShown, isFocused]);
  const expTipVisible = expTipTarget != null && crop && optionsPanelShown && isFocused;
  useOverlay(React.useMemo(
    () => expTipVisible ? <ExposureTip target={expTipTarget} onClose={closeExpTip} /> : null,
    [expTipVisible, expTipTarget, closeExpTip]
  ));


    return (
    
     <SafeAreaView className="bg-zinc-800" style={{flex:1}}>
      {/* Modal to select spectral line */}
      {modalLineSelectorVisible && <ModalLineSelector visible={modalLineSelectorVisible} onSelect={setTagOnScan} onSkip={() => setModalLineSelectorVisible(false)} />}
      {/* Exposure typed in rather than slid to, cropped mode */}
      {expInputVisible && <ModalExposureInput
        visible={expInputVisible}
        value={expTime}
        min={MANUAL_EXP_MIN_MS}
        max={MANUAL_EXP_MAX_MS}
        onCancel={() => setExpInputVisible(false)}
        onSubmit={applyManualExposure}
      />}

      <View className="flex flex-col " style={{flex:1}}>
  
            {/* Main container for displaying the camera feed or spectrum */}
            <View className="absolute z-1 flex flex-col justify-center" style={{ right:0, left:0, top:0, width:"100%", height:"100%"}}>
            {!displaySpectrum && (!modalLineSelectorVisible && frame && myContext.cameraIsConnected ? 
            
                                    <Zoomable
                                    ref={zoomRef}
                                    scale={zoomScale}
                                    onInteractionEnd={refreshZoomView}
                                    onDoubleTap={refreshZoomView}
                                    onResetAnimationEnd={refreshZoomView}
                                    isSingleTapEnabled
                                    isDoubleTapEnabled
                                        >
                        {/* Grid overlay for alignment */}
                        {displayGrid && !rec && <View className="absolute w-full h-full z-30 "><View className="mx-auto z-40 h-full" style={{width:1, backgroundColor:"lime"}}></View></View>} 
                        {displayGrid && !rec && <View className="absolute w-full h-full z-30 flex flex-row items-center "><View className="z-40 w-full" style={{height:1, backgroundColor:"lime"}}></View></View>}
                {/* Camera feed image */}
                <View className="h-full w-full  flex flex-row justify-center items-center">
                  <View style={{width:crop?470:FULL_FRAME_WIDTH, height:crop ? 30:FULL_FRAME_HEIGHT}}>
                <Image
                style={{width:crop?470:FULL_FRAME_WIDTH, height:crop ? 30:FULL_FRAME_HEIGHT}}
                source={{ uri: frame }} 
                contentFit='contain'
                className="border border-white mx-auto"
                />
                {/* Names of the spectral lines, pinned on the frame */}
                {identActive && ident.status === 'locked' && ident.solution &&
                  <LineIdentOverlay
                    features={ident.features}
                    sampleCount={ident.solution.count}
                    width={FULL_FRAME_WIDTH}
                    height={FULL_FRAME_HEIGHT}
                    zoomScale={zoomScale}
                    zoom={zoomView.zoom}
                    visibleLeft={zoomView.visibleLeft}
                    visibleRight={zoomView.visibleRight}
                    sunLeft={ident.sunLeft}
                  />}
                  </View>
                </View>
                </Zoomable>
                                    : myContext.cameraIsConnected
                                      ? <View className="mx-auto"><Loader type="white" /></View>
                                      /* no feed to wait for : offer the connection instead of spinning forever */
                                      : <ConnectCameraPanel />)}

                {/* Spectrum display */}
                {displaySpectrum && displaySpectrumType === "vertical"  && <Spectrum rawData={spectrumData} fwhm={fwhm} title={t('common:verticalProfileTitle')} subtitle={t('common:verticalProfile')} />}
                {displaySpectrum && displaySpectrumType === "horizontal"  && <Spectrum rawData={intensityData} title={t('common:horizontalProfileTitle')} subtitle={t('common:horizontalProfile')} />}
               
            </View>

            {/* Tooltip popup */}
            {popinVisible && <TooltipPopin className="z-10" onClose={togglePopin}/>}
      
            {/* Recording timer display */}
            <View className="absolute bottom-0 w-full h-14 " style={{ left:0, top:10}}>
                {rec && myContext.cameraIsConnected &&
                  <View style={[toolbarSurface, {alignSelf:'center', flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:6, gap:10}]}>
                    <PulseDot color="#ef4444" pulsing size={10} />
                    <Text className="text-white font-bold" style={{fontSize:22}}>{time} s</Text>
                  </View>}
                </View>

            {/* Disk being built, bottom left, and the auto stop countdown */}
            {rec && myContext.cameraIsConnected &&
              <View pointerEvents="box-none" className="absolute z-10" style={{ left: 10 + insets.left, bottom: 10 }}>
                {autoStopIn != null &&
                  <PressableScale onPress={() => setAutoStopCancelled(true)} style={[toolbarSurface, {paddingHorizontal:8, paddingVertical:5, marginBottom:6}]}>
                    <Text className="text-amber-400" style={{fontSize:10, fontWeight:'700'}}>{t('common:autoStopIn', { seconds: autoStopIn })}</Text>
                    <Text className="text-slate-400" style={{fontSize:9}}>{t('common:autoStopCancel')}</Text>
                  </PressableScale>}
                <ScanPreview uri={preview.uri} />
              </View>}

            {/* Alignment assistant : sits under the timer while recording, under
                the options panel when that is open, and takes the top slot on
                its own otherwise */}
            {assistantVisible &&
              <View pointerEvents="box-none" className="absolute w-full z-10" style={{ left:0, top: rec ? 56 : displayOptions ? 70 : 10}}>
                <ScanAssistant
                  geometry={assistant.geometry}
                  hasLocation={assistant.hasLocation}
                  locationStatus={assistant.locationStatus}
                  onRetryLocation={assistant.retryLocation}
                  targetArcmin={assistant.targetArcmin}
                  endArcmin={assistant.endArcmin}
                  measuredArcmin={assistant.measuredArcmin}
                  armed={assistant.armed}
                  recording={rec}
                  elapsedS={elapsedS}
                  simulatedDate={assistant.simulatedDate}
                  window={assistant.observingWindow}
                />
              </View>}
            {/* Line identification banner : slides under the options panel when that is open */}
            {identActive && !displaySpectrum &&
              <View pointerEvents="none" className="absolute w-full z-10" style={{ left:0, top: displayOptions ? 70 : 10}}>
                <LineIdentStatus status={ident.status} solution={ident.solution} features={ident.features} />
              </View>}
                {/* Snapshot filename display */}
                <View className="absolute bottom-0 w-full h-14 " style={{ left:0, top:10}}>
                {snapShotFilename && myContext.cameraIsConnected && <Text className="mx-auto text-white text-xs">./{snapShotFilename}</Text>}
                </View>

      
          {/* focus assistant */}
          {displayFocusAssistant && crop && !displaySpectrum && myContext.cameraIsConnected &&
            <View className="absolute w-full z-5" style={{ left:0, bottom:75}}>
              <FocusAssistant value={sharpness} />
            </View>}

           {/* Bottom toolbar */}
           {!rec && !displaySpectrum && (myContext.cameraIsConnected || myContext.demo)  &&
           <View className="absolute bottom-0 w-full h-14 z-10 " style={{ right:0, bottom:10}}>

       
            <View style={[{ left:0, top:0}, toolbarSurface]} className=" flex flex-row mx-auto justify-center items-center px-2 py-1 ">
                          {/* Snapshot button */}
                          <PressableScale onPress={()=>takeSnapShot() } className="flex flex-col justify-center items-center p-1 mr-3 ">
                              <View className="flex flex-col items-center space-y-1">
                              <Ionicons name="camera" size={18} color={isTakingSnapshot?"red":"white"}  />
                              <Text style={{fontSize:10,color:isTakingSnapshot?"red":"#fff"}}>{t('common:snapShot')}</Text>
                            </View>
                          </PressableScale>
                          {/* Color mode toggle */}
                          <PressableScale onPress={()=>toggleColorMode() } className="flex flex-col justify-center items-center p-1 mr-3">
                            <View className="flex flex-col items-center space-y-1">
                              <Ionicons name="color-palette-outline" size={18} color={colorMode ? "#10b981":"white"}   />
                              <Text style={{fontSize:10,color:colorMode ? "#10b981":"#fff"}}>{t('common:color')}</Text>
                            </View>
                          </PressableScale>
                         
                            {/* Normalize toggle */}
                            <PressableScale onPress={()=>toggleNormMode()} className="flex flex-col justify-center items-center p-1 mr-3 ">
                              <View className="flex flex-col items-center space-y-1">

                              <Ionicons name="flash" size={18} color={normMode > 0 ? "#10b981":"white"}  />
                            
                             
                              <Text style={{fontSize:10,color:normMode > 0 ? "#10b981":"#fff"}}>{t('common:auto')}</Text>
                              
                              </View>
                             
                            </PressableScale>

                            {/* Options toggle */}
                            <PressableScale onPress={toggleOptions} className="flex flex-col justify-center items-center p-1 mr-3">
                              <View className="flex flex-col items-center space-y-1">

                              <Ionicons name="options" size={18} color={displayOptions? "#10b981":"white"}  />
                              <Text style={{fontSize:10,color:displayOptions ? "#10b981":"#fff"}}>{t('common:adjust')}</Text>
                              </View>
                             
                            </PressableScale>
                            {/* Grid toggle */}
                            <PressableScale onPress={toggleGrid} className="flex flex-col justify-center items-center p-1 mr-3">
                              <View className="flex flex-col items-center space-y-1">

                              <Ionicons name="scan" size={18} color={displayGrid? "#10b981":"white"}  />
                              <Text style={{fontSize:10,color:displayGrid ? "#10b981":"#fff"}}>{t('common:grid')}</Text>
                              </View>
                             
                            </PressableScale>
                             {/* Focus toggle */}
                             { crop &&
                            <PressableScale onPress={toggleFocus} className="flex flex-col justify-center items-center p-1 mr-3">
                              <View className="flex flex-col items-center space-y-1">
                              <Ionicons name="prism" size={18} color={displayFocusAssistant ? "#10b981":"white"}  />
                              <Text style={{fontSize:10,color:displayFocusAssistant  ? "#10b981":"#fff"}}>{t('common:focus')}</Text>
                              </View>

                            </PressableScale>}
                             {/* Line identification toggle : full frame only */}
                             { !crop && myContext.cameraIsConnected &&
                            <PressableScale onPress={()=>setDisplayIdent(!displayIdent)} className="flex flex-col justify-center items-center p-1 mr-3">
                              <View className="flex flex-col items-center space-y-1">
                              <Ionicons name="pricetags-outline" size={18} color={displayIdent ? "#10b981":"white"}  />
                              <Text style={{fontSize:10,color:displayIdent ? "#10b981":"#fff"}}>{t('common:ident')}</Text>
                              </View>

                            </PressableScale>}
                             {/* Alignment assistant toggle */}
                             { assistantAvailable &&
                            <PressableScale onPress={()=>setDisplayAssistant(!displayAssistant)} className="flex flex-col justify-center items-center p-1 mr-3">
                              <View className="flex flex-col items-center space-y-1">
                              <Ionicons name="locate" size={18} color={displayAssistant ? "#10b981":"white"}  />
                              <Text style={{fontSize:10,color:displayAssistant ? "#10b981":"#fff"}}>{t('common:assistant')}</Text>
                              </View>

                            </PressableScale>}
                           
                             
                  
              </View>
           
           </View>}

           {/* Spectrum toggle buttons */}
           {(!rec && myContext.cameraIsConnected && crop)   &&
           <View className="absolute bottom-0 z-10 h-14" style={{ right:5, bottom:10, marginRight:insets.right}}>
            <View style={[{ left:0, top:0}, toolbarSurface]} className="  flex flex-row self-start ml-4 justify-center items-end px-2 py-1 ">
                <PressableScale onPress={()=>toggleSpectrum('vertical') } className="flex flex-col justify-center items-center px-1 py-2 ">
                    <View className="flex flex-col items-center">
                    <Entypo name="align-horizontal-middle" size={28}  color={displaySpectrum && displaySpectrumType == 'vertical' ? "#10b981":"white"}  />
                  </View>
                </PressableScale>
                <PressableScale onPress={()=>toggleSpectrum('horizontal') } className="flex flex-col justify-center items-center px-1 py-2 ">
                    <View className="flex flex-col items-center">
                    <Entypo name="align-vertical-middle"  style={{transform: [{rotateY: '180deg'}]}} size={28}  color={displaySpectrum && displaySpectrumType == 'horizontal' ? "#10b981":"white"}  />
                  </View>
                </PressableScale>
              </View>
           </View>}
    
            {/* Right toolbar */}
            {(myContext.cameraIsConnected || myContext.demo) && <View className="absolute flex flex-col h-full items-center justify-center" style={stylesRighttoolBar}>
                <View>
                {/* Crop hint : its arrow lines up with the crop button */}
                <View pointerEvents="box-none" style={{position:'absolute', right:'100%', top:33, marginRight:4}}>
                  <CropHint visible={cropHintVisible} onClose={() => setCropHintVisible(false)} />
                </View>
                <View style={[toolbarSurface, {gap:6, paddingVertical:8, paddingHorizontal:4, alignItems:'center'}]} >
                    
                <PressableScale onPress={()=>updatePosYCrop("down") } className="flex flex-col justify-center items-center w-12">
                        <Ionicons name="chevron-up" size={32} color={!crop || rec ? "rgb(113 113 122)":"white"}   />
                        </PressableScale>
                        <PressableScale disabled={displaySpectrum || isTogglingCrop}  onPress={toggleCrop} className="flex flex-col justify-center items-center w-12"
                          style={cropHintVisible ? {borderRadius:12, borderWidth:1.5, borderColor:"#10b981"} : null}>
                
                        {isTogglingCrop
                          ? <View style={{height:30, justifyContent:'center'}}><ActivityIndicator size="small" color={crop ? "#10b981":"white"} /></View>
                          : <Ionicons name="crop-outline" size={30} color={crop  ? "#10b981":"white"}   />}
                        </PressableScale>
                        <PressableScale onPress={()=>updatePosYCrop("up") } className="flex flex-col justify-center items-center w-12 mb-4">
                        <Ionicons name="chevron-down" size={32} color={!crop || rec  ? "rgb(113 113 122)":"white"}   />
                        </PressableScale>
                        
                        {/* Record button */}
                        <PressableScale disabled={displaySpectrum || colorMode || isRecPending} onPress={() => {
                // Acquisition only runs in cropped mode : explain it instead of a dead button
                if(!crop && !rec){
                    setCropHintVisible(true);
                    return;
                }

                if(rec){
                    updateRec('stop');
                }else {
                    startScan();
                } 

      
              
          }} className="flex flex-col justify-center items-center w-12">
            {isRecPending
              ? <View style={{height:40, justifyContent:'center'}}><ActivityIndicator size="large" color={rec ? "red":"white"} /></View>
              : <Ionicons name={rec ? "stop-circle-outline":"radio-button-on-outline"} size={40} color={!crop || colorMode ? "rgb(113 113 122)":(rec ? "red":"white")}   />}
                        </PressableScale> 

                     
                </View>
                </View>
            </View>}

 
            {/* Options panel */}
            {!rec  && !displaySpectrum && displayOptions && (myContext.cameraIsConnected || myContext.demo)   && (<View>
            <View className="absolute mb-4 w-full flex flex-row justify-center align-items " style={{ right:0, top:10}}>
          <View className="flex flex-row justify-start item-center align-center space-x-4 w-full">
           
              <View style={toolbarSurface} className="py-2 flex flex-row justify-center align-center items-center px-4 w-3/4 mx-auto"  >

                  <View className="flex flex-row justify-evenly align-center items-center w-1/4"  >

                      {/* Exposure time control. In cropped mode, a tap on the
                          tile already selected types the exposure in : the first
                          tap still only brings the slider back from the gain. */}
                      <PressableScale onLongPress={()=>toggleExpMode()} onPress={()=>{ if (crop && settings == 'exp') { setExpInputVisible(true); } else { setSettings('exp'); } }} className={settings == 'exp' ? "flex flex-col justify-between items-center w-10 pb-1 border-b border-white":"flex flex-col justify-between items-center w-10 pb-1 border-b border-transparent"}>

                            <View ref={expTileRef} collapsable={false}>
                           {autoExpOn && <View style={{right:-8,top:-8}} className="z-10 absolute self-start bg-emerald-500 rounded-full flex flex-row h-4 w-4 justify-center items-center"><Text style={{fontSize:8}} className="text-white text-center">A</Text></View>}
                           {!autoExpOn && expMode > 0  && <View style={{right:-8,top:-8}} className={settings == 'exp' ? "z-10 absolute self-start bg-red-600 rounded-full font-center flex flex-row h-4 w-4 justify-center items-center":"z-10 absolute self-start rounded-lg font-center flex flex-row h-4 w-4 justify-center items-center bg-zinc-500"} ><Text style={{fontSize:8}} className="text-white text-center ">{expMode == 1 ? 'SE':'LE'}</Text></View>}
                           <Text style={{fontSize:13}} className={settings == 'exp' ? "color-white font-bold":"color-zinc-400"}>EXP</Text>
                              <Text style={{fontSize:9}} className={settings == 'exp' ? "color-white":"color-zinc-400"}>{expMode == 0 ? (expTime).toFixed(0)+' m' : expMode == 1 ? (expTime).toFixed(1)+' m':(expTime/1000).toFixed(1)+' '}s</Text>
                </View>
                      </PressableScale>
                      {/* Gain control */}
                      <PressableScale onPress={()=>setSettings('gain')} className={settings == 'gain' ? "flex flex-col justify-between items-center  w-10 pb-1 border-b border-white":"flex flex-col justify-between items-center  w-10 pb-1 border-b border-transparent"}>
                        <View>
                        <Text style={{fontSize:13}} className={settings == 'gain' ? "color-white font-bold":"color-zinc-400"}>GAIN</Text>
                              <Text style={{fontSize:9}} className={settings == 'gain' ? "color-white":"color-zinc-400"}>{gain.toFixed(1)} dB</Text>
                        </View>
                              
                      </PressableScale>
                      {/* Automatic exposure toggle, full frame colour only */}
                      {autoExpAvailable && <PressableScale onPress={toggleAutoExp} className="flex flex-col justify-between items-center w-10 pb-1 border-b border-transparent">
                        <View className="flex flex-col items-center">
                        <Text style={{fontSize:13}} className={autoExp ? "color-emerald-500 font-bold":"color-zinc-400"}>AUTO</Text>
                        <Text style={{fontSize:9}} className={autoExp ? "color-emerald-500":"color-zinc-400"}>EXP</Text>
                        </View>
                      </PressableScale>}
               
                   </View>
                  {/* Exposure time slider */}
                  {isFocused && (settings == 'exp' ? <Slider
                    style={{flexGrow:10, height: 30}}
                    className=""
                    // Widened to hold a typed exposure that falls between two
                    // ranges (160 - 200 ms) : the thumb then shows the exposure
                    // in force instead of sitting pinned against a bound.
                    minimumValue={Math.min(expTime, expMode == 0 ? 20: expMode == 1 ? 0.1:200)}
                    maximumValue={Math.max(expTime, expMode == 0? 160: expMode == 1 ? 20:30000)}
                    value={expTime}
                    disabled={autoExpOn}
                    thumbTintColor={autoExpOn ? "#10b981" : "white"}
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
            <ThresholdSlider
              value={maxThreshold}
              onChange={setMaxThreshold}
              max={256}
              scale={16 * (colorMode ? 1 : 4)}
            />
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


