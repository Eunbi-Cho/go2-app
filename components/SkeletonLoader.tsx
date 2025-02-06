import type React from "react"
import { View, StyleSheet } from "react-native"

interface SkeletonLoaderProps {
  width: number | string
  height: number | string
  style?: object
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ width, height, style }) => {
  return <View style={[styles.skeleton, { width, height }, style]} />
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#E1E9EE",
    borderRadius: 4,
  },
})

export default SkeletonLoader

