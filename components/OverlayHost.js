// Layer above the whole app, navigation included, in the same native window.
//
// A Modal would cover the app too, but on Android it is a window of its own,
// whose origin is not the app's as soon as a camera cutout or a system bar
// sits on a side : anything drawn in it from measureInWindow coordinates lands
// off target by the width of that inset. Drawn here, the overlay and the view
// it points at share one frame of reference, on every phone and tablet.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const OverlayContext = createContext(() => {});

export function OverlayProvider({ children }) {
  const [overlay, setOverlay] = useState(null);
  return (
    <OverlayContext.Provider value={setOverlay}>
      {children}
      {overlay != null && (
        // Raised above everything: on Android, views are drawn in elevation
        // order, and React Native flattens the layout-only views in between,
        // so a screen element with an elevation (the picture screen's row has
        // 102, the full screen viewers 100) ends up next to this layer and
        // drawn over it. Transparent, so the elevation casts no shadow.
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]} pointerEvents="box-none">
          {overlay}
        </View>
      )}
    </OverlayContext.Provider>
  );
}

/**
 * Shows `element` above the whole app for as long as the caller is mounted,
 * null to take it down. Memoise the element : a new one on every render
 * re-renders the layer with it.
 */
export function useOverlay(element) {
  const setOverlay = useContext(OverlayContext);
  useEffect(() => {
    setOverlay(element);
    return () => setOverlay(null);
  }, [element, setOverlay]);
}
