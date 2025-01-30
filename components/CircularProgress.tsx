import type React from "react"
import { View, StyleSheet } from "react-native"
import Svg, { Circle } from "react-native-svg"

interface CircularProgressProps {
  size: number
  strokeWidth: number
  progress: number
  color: string
}

const CircularProgress: React.FC<CircularProgressProps> = ({ size, strokeWidth, progress, color }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const progressOffset = circumference - (progress / 100) * circumference

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle stroke="#f8f8f8" fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
})

export default CircularProgress

