import * as React from "react";
import { Animated, Easing } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

// --- Geometry -------------------------------------------------------------
// The curve is computed instead of being a hand-tuned bezier, so the arc is
// symmetric, the horizon crossings land exactly on the sunrise / sunset ticks
// and the sun position can be derived analytically (no getTotalLength hacks).
const W = 380;
const H = 94;
const HORIZON_Y = 70;   // y of the horizon line
const AMP = 52;         // apex height above the horizon
const X0 = 56;          // sunrise crossing
const SPAN = 268;       // sunrise -> sunset
const TAIL = 0.085;     // how far the curve keeps going below the horizon

// t = 0 at sunrise, 1 at sunset; negative / >1 is below the horizon.
const pointAt = (t) => ({
  x: X0 + t * SPAN,
  y: HORIZON_Y - AMP * Math.sin(Math.PI * t),
});

const samplePath = (from, to, steps) => {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const p = pointAt(from + ((to - from) * i) / steps);
    d += `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }
  return d;
};

const pathLength = (from, to, steps) => {
  let len = 0;
  let prev = pointAt(from);
  for (let i = 1; i <= steps; i++) {
    const p = pointAt(from + ((to - from) * i) / steps);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
};

const FULL_D = samplePath(-TAIL, 1 + TAIL, 96);
const DAY_D = samplePath(0, 1, 72);
const DAY_LEN = pathLength(0, 1, 720);
const AREA_D = `${DAY_D}L${X0 + SPAN},${HORIZON_Y}L${X0},${HORIZON_Y}Z`;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const toMinutes = (d) => d.getHours() * 60 + d.getMinutes();
const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

function SunGraph({ sunTimes, now }) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const fadeIn = React.useRef(new Animated.Value(0)).current;
  const halo = React.useRef(new Animated.Value(1)).current;

  const [sunT, setSunT] = React.useState(0);
  const [isDay, setIsDay] = React.useState(true);

  // Target position on the curve, recomputed whenever the ephemeris changes.
  const target = React.useMemo(() => {
    if (!sunTimes?.sunrise || !sunTimes?.sunset) return { t: 0, day: false };
    const start = toMinutes(sunTimes.sunrise);
    const end = toMinutes(sunTimes.sunset);
    const current = toMinutes(now ?? new Date());
    const total = Math.max(end - start, 1);
    const day = current >= start && current <= end;
    // Below the horizon the sun rests on the tail, on the side it belongs to.
    const t = day
      ? clamp((current - start) / total, 0, 1)
      : current < start
      ? -TAIL * 0.5
      : 1 + TAIL * 0.5;
    return { t, day };
  }, [sunTimes, now]);

  React.useEffect(() => {
    setIsDay(target.day);
    progress.setValue(0);
    fadeIn.setValue(0);
    Animated.parallel([
      Animated.timing(progress, {
        toValue: target.t,
        // Paced by the distance covered : a sun still close to sunrise takes
        // less time than one that has to climb the whole arc.
        duration: 1200 + 2600 * Math.min(Math.abs(target.t), 1),
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 600,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start();
  }, [target]);

  React.useEffect(() => {
    const id = progress.addListener(({ value }) => setSunT(value));
    return () => progress.removeListener(id);
  }, []);

  // Slow breathing halo
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1.35,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(halo, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const sun = pointAt(sunT);
  // Travelled part of the arc, revealed by pulling the dash offset back.
  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [DAY_LEN, 0],
    extrapolate: "clamp",
  });

  // A dimmer, tighter halo below the horizon, so it never spills out of the frame
  const haloR = isDay ? 17 : 12;
  const sunCore = isDay ? "url(#sunCore)" : "#94a3b8";
  const sunGlow = isDay ? "url(#sunGlow)" : "url(#moonGlow)";

  return (
    <Svg viewBox={`0 0 ${W} ${H}`} height={H} width={W}>
      <Defs>
        {/* Warm along the day: orange at the horizons, bright gold at noon */}
        <LinearGradient id="arc" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#fb923c" />
          <Stop offset="0.5" stopColor="#fbbf24" />
          <Stop offset="1" stopColor="#fb923c" />
        </LinearGradient>
        {/* Daylight area, fading out as it reaches the ground */}
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fbbf24" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </LinearGradient>
        {/* Horizon fades at both ends instead of stopping abruptly */}
        {/* userSpaceOnUse : a horizontal line has a zero-height bounding box,
            which makes an objectBoundingBox gradient render nothing. */}
        <LinearGradient id="horizon" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2="0">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <Stop offset="0.25" stopColor="#ffffff" stopOpacity="0.38" />
          <Stop offset="0.75" stopColor="#ffffff" stopOpacity="0.38" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </LinearGradient>
        <RadialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#fde68a" stopOpacity="0.55" />
          <Stop offset="0.55" stopColor="#f59e0b" stopOpacity="0.22" />
          <Stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#cbd5e1" stopOpacity="0.3" />
          <Stop offset="1" stopColor="#94a3b8" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="sunCore" cx="0.5" cy="0.4" r="0.6">
          <Stop offset="0" stopColor="#fffbeb" />
          <Stop offset="1" stopColor="#fbbf24" />
        </RadialGradient>
      </Defs>

      {/* Daylight area under the arc */}
      <Path d={AREA_D} fill="url(#sky)" opacity={isDay ? 1 : 0.35} />

      {/* Horizon */}
      <Line x1="0" y1={HORIZON_Y} x2={W} y2={HORIZON_Y} stroke="url(#horizon)" strokeWidth="1" />

      {/* Whole course of the day, recessive */}
      <Path
        d={FULL_D}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.16"
        strokeWidth="1.25"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />

      {/* Sunrise / sunset ticks */}
      {[0, 1].map((t) => {
        const p = pointAt(t);
        return (
          <G key={t}>
            <Line
              x1={p.x}
              y1={HORIZON_Y - 5}
              x2={p.x}
              y2={HORIZON_Y + 5}
              stroke="#ffffff"
              strokeOpacity="0.45"
              strokeWidth="1"
            />
            <Circle cx={p.x} cy={HORIZON_Y} r="2" fill="#fbbf24" fillOpacity="0.75" />
          </G>
        );
      })}

      {/* Elapsed part of the day : glow pass, then the crisp stroke */}
      <AnimatedPath
        d={DAY_D}
        fill="none"
        stroke="url(#arc)"
        strokeWidth="7"
        strokeOpacity={isDay ? 0.18 : 0.08}
        strokeLinecap="round"
        strokeDasharray={`${DAY_LEN}`}
        strokeDashoffset={dashOffset}
      />
      <AnimatedPath
        d={DAY_D}
        fill="none"
        stroke="url(#arc)"
        strokeWidth="2.5"
        strokeOpacity={isDay ? 1 : 0.35}
        strokeLinecap="round"
        strokeDasharray={`${DAY_LEN}`}
        strokeDashoffset={dashOffset}
      />

      {/* Sun */}
      <AnimatedG opacity={fadeIn}>
        <AnimatedCircle
          cx={sun.x}
          cy={sun.y}
          r={Animated.multiply(haloR, halo)}
          fill={sunGlow}
        />
        <Circle cx={sun.x} cy={sun.y} r="6.5" fill={sunCore} />
        <Circle
          cx={sun.x}
          cy={sun.y}
          r="6.5"
          fill="none"
          stroke="#fffbeb"
          strokeOpacity={isDay ? 0.7 : 0.25}
          strokeWidth="1"
        />
      </AnimatedG>
    </Svg>
  );
}

export const GRAPH_WIDTH = W;
export default SunGraph;
