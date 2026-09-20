// Root of the app, and a guard against it being laid out shorter than the
// screen on iOS.
//
// Seen on iPad (1180x820pt) : every so often the whole tree comes up 795pt
// tall, sidebar included, leaving a dead 25pt band at the bottom of the screen.
// Everything from here down is flex:1, so that height is what the native side
// hands to the React surface, not something a screen asks for. What makes it
// short is not known yet ; the debug readout below is there to find out, by
// telling which of the three sizes is the odd one :
//   root   : what the surface was laid out with
//   window : bounds of the key UIWindow
//   screen : bounds of the UIScreen
//
// Until then the app is stretched back to the full height when it comes up
// short. iOS does not clip a view to its parent, so the overflow is drawn (the
// zoomed camera feed already showed through that band).

import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Past this the gap is not that band (a rotation still in flight, an app
// window resized by hand...) : the layout is left alone.
const MAX_MISSING_HEIGHT = 60;

function readDimensions() {
  return { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
}

const size = ({ width, height }) => `${Math.round(width)}x${Math.round(height)}`;

export default function RootFrame({ debug, children }) {
  const [layout, setLayout] = useState(null);
  const [dims, setDims] = useState(readDimensions);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window, screen }) => setDims({ window, screen }));
    return () => subscription.remove();
  }, []);

  const onLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  // The app is full screen only (requireFullScreen), so the screen is the
  // reference even if the window itself turns out to be the short one
  const fullHeight = Math.max(dims.window.height, dims.screen.height);
  const missing = layout ? fullHeight - layout.height : 0;
  const stretch = Platform.OS === 'ios'
    && layout != null
    // Same width : both sizes describe the same orientation
    && Math.abs(dims.screen.width - layout.width) < 1
    && missing > 1
    && missing < MAX_MISSING_HEIGHT;

  useEffect(() => {
    if (stretch) {
      console.log(`RootFrame: root ${size(layout)} shorter than window ${size(dims.window)} / screen ${size(dims.screen)}, stretched`);
    }
  }, [stretch]);

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <GestureHandlerRootView style={stretch ? [styles.stretched, { width: layout.width, height: fullHeight }] : styles.fill}>
        {children}
      </GestureHandlerRootView>
      {debug && layout != null &&
        <View style={styles.readout} pointerEvents="none">
          <Text style={[styles.readoutText, missing > 1 && styles.readoutTextShort]}>
            root {size(layout)} · window {size(dims.window)} · screen {size(dims.screen)}{stretch ? ' · stretched' : ''}
          </Text>
        </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#000',
  },
  stretched: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#000',
  },
  readout: {
    position: 'absolute',
    top: 0,
    left: 72,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  readoutText: {
    color: '#a3e635',
    fontSize: 9,
  },
  readoutTextShort: {
    color: '#f87171',
  },
});
