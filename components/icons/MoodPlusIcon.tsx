import type * as React from "react"
import Svg, { Path } from "react-native-svg"
import type { SvgProps } from "react-native-svg"

interface MoodPlusIconProps extends SvgProps {
  color?: string
  size?: number
}

const MoodPlusIcon: React.FC<MoodPlusIconProps> = ({ color = "currentColor", size = 24, ...props }) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <Path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <Path d="M20.985 12.528a9 9 0 1 0 -8.45 8.456" />
      <Path d="M16 19h6" />
      <Path d="M19 16v6" />
      <Path d="M9 10h.01" />
      <Path d="M15 10h.01" />
      <Path d="M9.5 15c.658 .64 1.56 1 2.5 1s1.842 -.36 2.5 -1" />
    </Svg>
  )
}

export default MoodPlusIcon

