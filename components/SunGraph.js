import * as React from "react"
import { useTranslation } from "react-i18next";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg"


function SunGraph({sunTimes}) {

  const { t, i18n } = useTranslation();

    const [sunPosition, setSunPosition] = React.useState({x:0,y:0});
    const sunPath = React.useRef(null);

    const convertDateToMinutesSinceDayStarted = (date) => {
      return (date.getHours() * 60) + date.getMinutes()
    }

    React.useEffect(() => { 
     if(!sunTimes.sunrise)
      return; 

    const sunLine = sunPath.current
    const sunrise = sunTimes.sunrise
    const sunset =sunTimes.sunset
    const eventsAt = {
      dayStart: 0,
      sunrise: convertDateToMinutesSinceDayStarted(sunrise),
      sunset: convertDateToMinutesSinceDayStarted(sunset),
      dayEnd: (23 * 60) + 59
    }

    const now = new Date()
    const minutesSinceTodayStarted = convertDateToMinutesSinceDayStarted(now)
    
    // Day section position [106 - 499]
    const minutesSinceDayStarted = Math.max(minutesSinceTodayStarted - eventsAt.sunrise, 0)
    const daySectionPosition = (Math.min(minutesSinceDayStarted, eventsAt.sunset - eventsAt.sunrise) * (499 - 106)) / (eventsAt.sunset - eventsAt.sunrise)
    setSunPosition(sunLine.getPointAtLength(daySectionPosition))
    },[sunTimes])
    
  return (
            <Svg viewBox="0 0 565 160" height={80} width="280"  xmlns="http://www.w3.org/2000/svg">
            
            <Path d="M5,146 C29,153 73,128 101,108 L 5 108" fill="none" opacity="1" stroke="#fff" shape-rendering="geometricPrecision" />
            <Path ref={sunPath} d="M101,108 C276,-29 342,23 449,108 L 104,108" fill="none" opacity="1" stroke="#fff" shape-rendering="geometricPrecision" />
            <Path d="M 449 108 C 473 123 509 150 545 146 L 545 146 " fill="none" opacity="1" stroke="#fff" shape-rendering="geometricPrecision" />
            <Path d=" M 449 108 L 545 108" fill="none" opacity="1" stroke="#fff" shape-rendering="geometricPrecision" />
            
           
            <Line x1="5" y1="108" x2="545" y2="108"  />
            <Line x1="101" y1="25" x2="101" y2="100" />
            <Line x1="449" y1="25" x2="449" y2="100" />
            <Circle cx={sunPosition.x} cy={sunPosition.y} r="10" opacity="1" stroke="none" fill="rgb(250 204 21)" shape-rendering="geometricPrecision" />
            </Svg>


  )
}

export default SunGraph


