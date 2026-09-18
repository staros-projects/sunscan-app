import React, { useRef } from 'react';
import { View } from 'react-native';
import LottieView from 'lottie-react-native';

// Measured from assets/lottie/loader-*.json: the artboard is 1920x1080 but the
// three dots only occupy a 480x160 band in the middle of it - 25% of the width,
// 15% of the height. Sizing the view by the artboard therefore renders dots at a
// quarter of the size asked for, which is why they always looked small.
const CANVAS_W = 1920;
const CANVAS_H = 1080;
const DOTS_W = 480;
const DOTS_H = 160;
const DOTS_CY = 520; // dots sit slightly above the artboard's vertical centre

// Loader component that displays a loading animation
export default function Loader({ type, size = 150, dotsWidth }) {
  // Create a ref to hold the animation instance
  const animation = useRef(null);

  // Choose the appropriate Lottie animation file based on the 'type' prop
  const lottie_file = type == "white" ? require("../assets/lottie/loader-white.json"):require("../assets/lottie/loader-black.json");

  // `dotsWidth` sizes by the DOTS rather than the artboard: the animation is
  // blown up accordingly and the surrounding emptiness cropped away, so the
  // caller gets the size it actually asked for.
  if (dotsWidth) {
    const lottieW = (dotsWidth * CANVAS_W) / DOTS_W;
    const lottieH = (lottieW * CANVAS_H) / CANVAS_W;
    const boxH = Math.round((lottieH * DOTS_H * 1.25) / CANVAS_H);
    // Re-centre: the dots are above the artboard centre, so push them back down
    const shiftY = ((CANVAS_H / 2 - DOTS_CY) / CANVAS_H) * lottieH;

    return (
      <View
        style={{
          width: dotsWidth * 1.08,
          height: boxH,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LottieView
          autoPlay
          ref={animation}
          style={{ width: lottieW, height: lottieH, marginTop: shiftY * 2 }}
          source={lottie_file}
        />
      </View>
    );
  }

  return (
      <LottieView
        autoPlay
        ref={animation}
        style={{
          width: size,
          height: size,
          backgroundColor: 'transparent ',
        }}
        // Use the selected Lottie animation file as the source
        source={lottie_file}
      />
  );
}
