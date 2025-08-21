import * as React from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

function SunGraph({ sunTimes }) {
  const ANIM_PATH_D = "M101,108 C276,-29 342,23 449,108";

  const curveRef = React.useRef(null);
  const animatedLen = React.useRef(new Animated.Value(0)).current;
  const animatedOpacity = React.useRef(new Animated.Value(0)).current;
  const [sunPos, setSunPos] = React.useState({ x: 0, y: 0 });

  // 🔆 halo animation value
  const haloScale = React.useRef(new Animated.Value(1)).current;

  const toMinutes = (d) => d.getHours() * 60 + d.getMinutes();
  const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

  React.useEffect(() => {
    if (!sunTimes?.sunrise || !sunTimes?.sunset) return;

    const sunrise = sunTimes.sunrise;
    const sunset = sunTimes.sunset;

    const start = toMinutes(sunrise);
    const end = toMinutes(sunset);
    const total = Math.max(end - start, 1);

    const now = new Date();
    const nowMin = toMinutes(now);
    const progressed = clamp(nowMin - start, 0, total);
    const progress = progressed / total;

    requestAnimationFrame(() => {
      const el = curveRef.current;
      if (!el) return;

      const curveLen = el.getTotalLength();
      const targetLen = progress * curveLen;

      // reset animation values
      animatedLen.setValue(0);
      animatedOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(animatedLen, {
          toValue: targetLen,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]).start();
    });
  }, [sunTimes]);

  // follow curve
  React.useEffect(() => {
    const id = animatedLen.addListener(({ value }) => {
      const el = curveRef.current;
      if (!el) return;
      const p = el.getPointAtLength(value);
      setSunPos({ x: p.x, y: p.y });
    });
    return () => animatedLen.removeListener(id);
  }, []);

  // 🔆 halo pulsating animation (loop forever)
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(haloScale, {
          toValue: 1.6,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(haloScale, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  return (
    <Svg viewBox="0 0 565 160" height={100} width={300}>
      {/* Horizon paths etc. */}
      <Path d="M5,146 C29,153 73,128 101,108 L 5 108" fill="none" stroke="#fff" />
      <Path d={`${ANIM_PATH_D} L 104,108`} fill="none" stroke="#fff" />
      <Path d="M 449 108 C 473 123 509 150 545 146" fill="none" stroke="#fff" />
      <Path d="M 449 108 L 545 108" fill="none" stroke="#fff" />
      <Line x1="5" y1="108" x2="545" y2="108" stroke="#fff" />
      <Line x1="101" y1="92" x2="101" y2="122" stroke="#fff" />
      <Line x1="449" y1="92" x2="449" y2="122" stroke="#fff" />

      {/* invisible path for measuring */}
      <Path ref={curveRef} d={ANIM_PATH_D} fill="none" stroke="transparent" />

      {/* Sun with halo */}
      {sunPos.x > 0 && (
        <>
          {/* Halo circle (larger, transparent, pulsating) */}
          <AnimatedCircle
            cx={sunPos.x}
            cy={sunPos.y}
            r={Animated.multiply(15, haloScale)} // radius scales up and down
            opacity={0.25}
            fill="rgb(253, 224, 71)" // softer yellow
          />
          {/* Core sun */}
          <AnimatedCircle
            cx={sunPos.x}
            cy={sunPos.y}
            r="12"
            opacity={animatedOpacity}
            fill="rgb(250, 204, 21)"
          />
        </>
      )}
    </Svg>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export default SunGraph;
