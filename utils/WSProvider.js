import ReconnectingWebSocket from "react-native-reconnecting-websocket";
import AppContext from "../components/AppContext";

import { useContext, useEffect, useCallback, useMemo, useRef } from 'react';

import WebSocketContext from './WSContext'

export default function  WebSocketProvider({ children })  {
    const myContext = useContext(AppContext);
    const ws = useRef(null);
    const channels = useRef({}); // maps each channel to its set of callbacks
    const { apiURL, setSunscanIsConnected } = myContext;
    /* called from a component that registers a callback for a channel.
       A channel holds a set rather than a single callback: a scan's progress is
       watched by its card in the list and by the picture screen at the same
       time, and neither should silently cancel the other. */
    const subscribe = useCallback((channel, callback) => {
        if (!channels.current[channel]) {
            channels.current[channel] = new Set();
        }
        channels.current[channel].add(callback);
    }, []);
    /* remove one callback, or every callback of the channel when none is given */
    const unsubscribe = useCallback((channel, callback) => {
        const callbacks = channels.current[channel];
        if (!callbacks) {
            return;
        }
        if (callback) {
            callbacks.delete(callback);
        } else {
            callbacks.clear();
        }
        if (callbacks.size === 0) {
            delete channels.current[channel];
        }
    }, []);
    useEffect(() => {
        /* WS initialization and cleanup */
        console.log('WS try to connect to '+apiURL)
        const socket = new ReconnectingWebSocket('ws://' + apiURL + '/ws', [], {
            debug: false,
            reconnectInterval: 1000,        // Démarre avec un délai de 1 secondes
            maxReconnectInterval: 5000,     // N'excède pas 5 secondes entre deux tentatives
            reconnectDecay: 1.2,            // Augmente le délai de 20% après chaque tentative
            timeoutInterval: 3000,          // Attente maximale de 3 secondes pour établir une connexion
            maxReconnectAttempts: null,     // Arrête après (infini de) tentatives
        });
        socket.onopen = () => { console.log('WS open'); setSunscanIsConnected(true); }
        socket.onclose = () => { console.log('WS close'); setSunscanIsConnected(false); }
        socket.onerror = (error) => { console.error('WebSocket error:', error); }
        socket.onmessage = (message) => {
            if (message.data && message.data.includes(";#;")) {
                const return_text = message.data.split(";#;");
                const callbacks = channels.current[return_text[0]];
                if (callbacks) {
                    // Copied first: a callback may unsubscribe itself on a
                    // terminal message, which would mutate the set mid-iteration.
                    Array.from(callbacks).forEach((callback) => callback(return_text));
                }
            } else {
                console.warn("Unexpected WebSocket message format:", message.data);
            }
        }
        ws.current = socket;
        return () => {
            // detach handlers so the teardown close doesn't flip the connected state
            socket.onopen = null;
            socket.onclose = null;
            socket.onerror = null;
            socket.onmessage = null;
            socket.close();
            if (ws.current === socket) {
                ws.current = null;
            }
        }
    }, [apiURL, setSunscanIsConnected])

    /* subscribe and unsubscribe are the only required prop for the context */
    const contextValue = useMemo(() => [subscribe, unsubscribe], [subscribe, unsubscribe]);

    /* WS provider dom */
    return (<WebSocketContext.Provider value={contextValue}>
            {children}
        </WebSocketContext.Provider>)
}
