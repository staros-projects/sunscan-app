import React, { useRef, useEffect } from 'react';
import LottieView from 'lottie-react-native';

// Loader component that displays a loading animation
export default function Loader({type}) {
  // Create a ref to hold the animation instance
  const animation = useRef(null);

  // Choose the appropriate Lottie animation file based on the 'type' prop
  const lottie_file = type == "white" ? require("../assets/lottie/loader-white.json"):require("../assets/lottie/loader-black.json");

  return (
      <LottieView
        autoPlay
        ref={animation}
        style={{
          width: 150,
          height: 150,
          backgroundColor: 'transparent ',
        }}
        // Use the selected Lottie animation file as the source
        source={lottie_file}
      />
  );
}

