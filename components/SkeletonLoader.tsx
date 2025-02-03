import React from 'react'
import { View, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

interface SkeletonLoaderProps {
  width: number | string
  height: number | string
  style?: object
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ width, height, style }) => {
  return (
    <View style={[styles.container, { width, height }, style]}>
      <LinearGradient
        colors={['#f0f0f0', '#e0e0e0', '#f0f0f0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
})

export default SkeletonLoader
