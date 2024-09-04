import * as React from "react"
import Svg, { Path } from "react-native-svg"

function HomeSVG(props) {
  return (
    <Svg
      stroke="currentColor"
      fill="currentColor"
      strokeWidth={0}
      viewBox="0 0 24 24"
      color="#fff"
      height={32}
      width={32}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <Path fill="none" d="M0 0h24v24H0z" stroke="none" />
      <Path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" stroke="none" />
    </Svg>
  )
}

export default HomeSVG
