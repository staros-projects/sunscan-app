import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as SplashScreen from 'expo-splash-screen';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { PATHS, VIEW_BOX, VB_W, VB_H } from './SunscanLoader';

// Must equal `imageWidth` of the expo-splash-screen plugin in app.config.js:
// the native splash draws assets/splash-icon.png (the mark cropped to VIEW_BOX)
// at that width, centred, and this overlay takes over with the very same frame,
// so the hand-off is invisible.
export const SPLASH_MARK_WIDTH = 110;
const MARK_W = SPLASH_MARK_WIDTH;
const MARK_H = (MARK_W * VB_H) / VB_W;

// assets/splash-wordmark.png is 392x71
const WORDMARK_W = MARK_W * 1.25;
const WORDMARK_H = (WORDMARK_W * 71) / 392;
const WORDMARK_GAP = 22;
// The mark rises by half the wordmark block so the lockup ends up centred
const LIFT = (WORDMARK_H + WORDMARK_GAP) / 2;

// Horizontal centre of each part (crescent, rings, dot) in 0..1 of the mark
// width: the slit lights a part up when it crosses it.
const PART_CENTRES = [0.18, 0.59, 0.94];
const DIM_OPACITY = 0.22;

const DIM_MS = 400;
const SWEEP_MS = 1400;
const WORDMARK_DELAY_MS = DIM_MS + SWEEP_MS - 350;
const WORDMARK_MS = 800;
// How long the finished lockup (and credits) stays on screen before fading out
const HOLD_MS = 1500;
const MIN_DURATION_MS = WORDMARK_DELAY_MS + WORDMARK_MS + HOLD_MS;
const EXIT_MS = 550;

const SLIT_COLOR = '#ffc46b';

// Proper names, not translated
const CREDITS = 'Guillaume Bertrand, Christian Buil, Valérie Desnoux, Matthieu Le Lain, Olivier Garde';

// Static insets are enough here: the splash lives a couple of seconds and sits
// outside SafeAreaProvider. Keeps the signature clear of a landscape notch.
const INSETS = initialWindowMetrics?.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Launch animation played over the app while it boots: the spectroheliograph's
 * slit sweeps across the SUNSCAN mark, lighting each part as it passes, then
 * the wordmark settles in and the whole thing fades into the app.
 *
 * It starts exactly where the native splash leaves off (same mark, same size,
 * same place) and only hides the native splash once it is on screen. It stays
 * up until `ready` and the animation are both done, then unmounts itself and
 * calls `onDone`.
 */
export default function AnimatedSplash({ ready, onDone }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [introDone, setIntroDone] = useState(false);
  const exiting = useRef(false);

  const dim = useSharedValue(0);      // 0 = lit as on the native splash, 1 = dimmed
  const sweep = useSharedValue(0);    // slit position across the mark, 0..1
  const wordmark = useSharedValue(0); // wordmark reveal + lockup lift
  const exit = useSharedValue(0);

  const onLayout = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      sweep.value = 1;
      wordmark.value = 1;
      setIntroDone(true);
      return;
    }
    dim.value = withTiming(1, { duration: DIM_MS, easing: Easing.out(Easing.quad) });
    sweep.value = withDelay(
      DIM_MS,
      withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.cubic) })
    );
    wordmark.value = withDelay(
      WORDMARK_DELAY_MS,
      withTiming(1, { duration: WORDMARK_MS, easing: Easing.out(Easing.cubic) })
    );
    const timer = setTimeout(() => setIntroDone(true), MIN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    if (!ready || !introDone || exiting.current) {
      return;
    }
    exiting.current = true;
    exit.value = withTiming(
      1,
      { duration: EXIT_MS, easing: Easing.in(Easing.quad) },
      (finished) => {
        if (finished) {
          runOnJS(setVisible)(false);
        }
      }
    );
  }, [ready, introDone]);

  useEffect(() => {
    if (!visible) {
      onDone?.();
    }
  }, [visible]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));

  const lockupStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.12 * exit.value }],
  }));

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -LIFT * wordmark.value }],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmark.value,
    transform: [
      { translateY: LIFT - LIFT * wordmark.value + 10 * (1 - wordmark.value) },
      { scaleX: 1.12 - 0.12 * wordmark.value },
    ],
  }));

  // The slit fades in and out at the ends of its run
  const signatureStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * wordmark.value,
  }));

  const slitStyle = useAnimatedStyle(() => ({
    opacity: sweep.value > 0 && sweep.value < 1 ? Math.sin(Math.PI * sweep.value) : 0,
    transform: [{ translateX: sweep.value * MARK_W }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      onLayout={onLayout}
      pointerEvents={ready && introDone ? 'none' : 'auto'}
    >
      <Animated.View style={[styles.lockup, lockupStyle]}>
        <Animated.View style={[{ width: MARK_W, height: MARK_H }, markStyle]}>
          {PATHS.map((d, index) => (
            <Part
              key={index}
              d={d}
              centre={PART_CENTRES[index]}
              dim={dim}
              sweep={sweep}
            />
          ))}
          <Animated.View style={[styles.slit, slitStyle]} pointerEvents="none">
            <LinearGradient
              colors={['transparent', SLIT_COLOR, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.slitGlow}
            />
            <LinearGradient
              colors={['transparent', '#fff', SLIT_COLOR, '#fff', 'transparent']}
              style={styles.slitLine}
            />
          </Animated.View>
        </Animated.View>
        <Animated.Image
          source={require('../assets/splash-wordmark.png')}
          style={[styles.wordmark, wordmarkStyle]}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.View style={[styles.signature, signatureStyle]} pointerEvents="none">
        <Text style={styles.signatureTeam}>{t('common:splashCredits')}</Text>
        <Text style={styles.signatureNames}>{CREDITS}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function Part({ d, centre, dim, sweep }) {
  const style = useAnimatedStyle(() => {
    // 0 before the slit reaches the part, 1 once it has crossed it
    const t = Math.min(1, Math.max(0, (sweep.value - centre + 0.12) / 0.2));
    const lit = t * t * (3 - 2 * t);
    const dimmed = 1 - (1 - DIM_OPACITY) * dim.value;
    return { opacity: dimmed + (1 - dimmed) * lit };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={MARK_W} height={MARK_H} viewBox={VIEW_BOX}>
        <Path d={d} fill="#fff" fillRule="evenodd" />
      </Svg>
    </Animated.View>
  );
}

const SLIT_OVERHANG = 18;
const GLOW_W = 28;

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  lockup: {
    alignItems: 'center',
  },
  slit: {
    position: 'absolute',
    top: -SLIT_OVERHANG,
    left: -GLOW_W / 2,
    width: GLOW_W,
    height: MARK_H + 2 * SLIT_OVERHANG,
    alignItems: 'center',
  },
  slitGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  slitLine: {
    width: 2,
    height: '100%',
  },
  signature: {
    position: 'absolute',
    right: INSETS.right + 24,
    bottom: INSETS.bottom + 16,
    alignItems: 'flex-end',
  },
  signatureTeam: {
    color: '#fff',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  signatureNames: {
    color: '#fff',
    fontSize: 9,
    marginTop: 3,
    opacity: 0.7,
  },
  wordmark: {
    position: 'absolute',
    top: MARK_H + WORDMARK_GAP - LIFT,
    width: WORDMARK_W,
    height: WORDMARK_H,
  },
});
