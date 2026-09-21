// Root of the app, and a readout of the sizes it is laid out with, for debug.
//
// It was written to track down a dead band at the bottom of every screen, on
// some cold starts : a SafeAreaView left in the root column, as tall as the
// insets of the moment, was taking its height from the navigator (see
// JobProgressModal). The readout is what found it, by telling apart, level by
// level :
//   yoga   : the size the layout gave a view (onLayout, measureInWindow)
//   native : the size of the native view itself, which safe-area-context reads
//            off the view (its "frame")
// A level laid out shorter than the one above it has a sibling taking room.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

const MEASURE_EVERY_MS = 2000;

const ProbeContext = createContext({ enabled: false, report: null });

function readDimensions() {
  return { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
}

const size = (rect) => rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : '?';

/**
 * Reports the native size and the insets of the SafeAreaProvider it sits in.
 */
export function FrameReporter({ name, yoga }) {
  const { enabled, report } = useContext(ProbeContext);
  const native = useSafeAreaFrame();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (enabled) {
      report(name, { native, insets, yoga });
    }
  }, [enabled, report, name, native.width, native.height, insets.top, insets.right, insets.bottom, insets.left, yoga?.width, yoga?.height]);
  return null;
}

/**
 * Fills its parent, sees and catches nothing : reports the size the parent was
 * laid out with next to the one its native view really has. Only mounted while
 * the readout is on.
 */
export function FrameProbe({ name }) {
  const { enabled } = useContext(ProbeContext);
  const [yoga, setYoga] = useState(null);
  const onLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setYoga({ width, height });
  }, []);
  if (!enabled) {
    return null;
  }
  // pointerEvents goes on a plain View : the provider's own view ignores the
  // prop on Android (its manager is not a ReactViewManager), and laid over the
  // app it would take every touch.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" collapsable={false} onLayout={onLayout}>
      <SafeAreaProvider>
        <FrameReporter name={name} yoga={yoga} />
      </SafeAreaProvider>
    </View>
  );
}

export default function RootFrame({ debug, children }) {
  const rootRef = useRef(null);
  const [layout, setLayout] = useState(null);
  const [measured, setMeasured] = useState(null);
  const [dims, setDims] = useState(readDimensions);
  const [probes, setProbes] = useState({});

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window, screen }) => setDims({ window, screen }));
    return () => subscription.remove();
  }, []);

  const onLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const report = useCallback((name, value) => {
    setProbes((prev) => ({ ...prev, [name]: value }));
  }, []);
  const probeContext = useMemo(() => ({ enabled: !!debug, report }), [debug, report]);

  // onLayout is an event, and an event can be missed : measureInWindow reads
  // the layout as it stands
  useEffect(() => {
    if (!debug) {
      setProbes((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }
    const read = () => rootRef.current?.measureInWindow((x, y, width, height) => setMeasured({ width, height }));
    read();
    const id = setInterval(read, MEASURE_EVERY_MS);
    return () => clearInterval(id);
  }, [debug]);

  // Every probe spans the whole root : one laid out or shown shorter than the
  // window is the band. A size of another width belongs to another orientation.
  const heights = [layout, ...Object.values(probes).flatMap((probe) => [probe.native, probe.yoga])]
    .filter((rect) => rect != null && Math.abs(rect.width - dims.window.width) < 1)
    .map((rect) => rect.height);
  const short = heights.some((height) => dims.window.height - height > 1);

  return (
    <ProbeContext.Provider value={probeContext}>
      <View ref={rootRef} style={styles.fill} onLayout={onLayout} collapsable={false}>
        <GestureHandlerRootView style={styles.fill}>
          {children}
        </GestureHandlerRootView>
        {debug && layout != null &&
          <View style={styles.readout} pointerEvents="none">
            <Text style={[styles.readoutText, short && styles.readoutTextShort]}>
              root {size(layout)} measured {size(measured)}
              {Object.entries(probes).map(([name, probe]) =>
                ` · ${name} yoga ${size(probe.yoga)} native ${size(probe.native)}`
                + ` insets ${['top', 'right', 'bottom', 'left'].map((edge) => Math.round(probe.insets[edge])).join('/')}`
              ).join('')}
              {' · '}window {size(dims.window)} · screen {size(dims.screen)}
            </Text>
          </View>}
      </View>
    </ProbeContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#000',
  },
  readout: {
    position: 'absolute',
    top: 0,
    left: 72,
    right: 8,
    paddingHorizontal: 4,
  },
  readoutText: {
    alignSelf: 'flex-start',
    color: '#a3e635',
    fontSize: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  readoutTextShort: {
    color: '#f87171',
  },
});
