import React, { useRef, useEffect } from 'react';
import LottieView from 'lottie-react-native';

export default function Loader({type}) {
  const animation = useRef(null);
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
        source={lottie_file}
      />
  );
}

