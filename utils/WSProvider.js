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
        ws.current = new ReconnectingWebSocket('ws://' + myContext.apiURL + '/ws', [], {
            debug: false,
            reconnectInterval: 1000,        // Démarre avec un délai de 1 secondes
            maxReconnectInterval: 5000,     // N'excède pas 5 secondes entre deux tentatives
            reconnectDecay: 1.2,            // Augmente le délai de 20% après chaque tentative
            timeoutInterval: 3000,          // Attente maximale de 3 secondes pour établir une connexion
            maxReconnectAttempts: null,     // Arrête après (infini de) tentatives
        });
        ws.current.onopen = () => { console.log('WS open'); myContext.setSunscanIsConnected(true); }
        ws.current.onclose = () => { console.log('WS close'); myContext.setSunscanIsConnected(false); }
        ws.current.onerror = (error) => { console.error('WebSocket error:', error); }
        ws.current.onmessage = (message) => {
            if (message.data && message.data.includes(";#;")) {
                const return_text = message.data.split(";#;");
                if (return_text[0] in channels.current)
                    channels.current[return_text[0]](return_text)
            } else {
                console.warn("Unexpected WebSocket message format:", message.data);
            }
        }
        return () => { 
            if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
                ws.current.close();
            }
            ws.current.close(); ws.current = null;
        }
    }, [myContext.apiURL])

    /* WS provider dom */
    /* subscribe and unsubscribe are the only required prop for the context */
    return (<WebSocketContext.Provider value={[subscribe, unsubscribe]}>
            {children}
        </WebSocketContext.Provider>)
}

