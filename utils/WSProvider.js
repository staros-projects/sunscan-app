import ReconnectingWebSocket from "react-native-reconnecting-websocket";
import AppContext from "../components/AppContext";

import { useContext, useEffect, createContext, useRef } from 'react';

import WebSocketContext from './WSContext'

export default function  WebSocketProvider({ children })  {
    const myContext = useContext(AppContext);
    const ws = useRef(null);
    const channels = useRef({}); // maps each channel to the callback
    /* called from a component that registers a callback for a channel */
    const subscribe = (channel, callback) => {
        channels.current[channel] = callback;
    }
    /* remove callback  */
    const unsubscribe = (channel) => {
        delete channels.current[channel];
    }
    useEffect(() => {
        /* WS initialization and cleanup */
        console.log('WS try to connect to '+myContext.apiURL)
        ws.current = new ReconnectingWebSocket('ws://'+myContext.apiURL+'/ws');
        ws.current.onopen = () => { console.log('WS open'); myContext.setSunscanIsConnected(true); }
        ws.current.onclose = () => { console.log('WS close'); }
        ws.current.onmessage = (message) => {
            if (message.data) {
                const return_text = message.data.split(";#;");
                if (return_text[0] in channels.current)
                    channels.current[return_text[0]](return_text)
            }
        }
        return () => { ws.current.close() }
    }, [myContext.apiURL])

    /* WS provider dom */
    /* subscribe and unsubscribe are the only required prop for the context */
    return (<WebSocketContext.Provider value={[subscribe, unsubscribe]}>
            {children}
        </WebSocketContext.Provider>)
}

