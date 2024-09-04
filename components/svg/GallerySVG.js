import * as React from "react"
import Svg, { Path } from "react-native-svg"

function GallerySVG(props) {
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
      <Path
        d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"
        stroke="none"
      />
    </Svg>
  )
}

export default GallerySVG
