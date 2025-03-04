"use client"

import type React from "react"
import { useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { NativeStackScreenProps, NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../types/navigation"
import Animated, { useSharedValue, withTiming, useAnimatedProps, Easing } from "react-native-reanimated"
import * as Haptics from "expo-haptics"
import Svg, { Circle } from "react-native-svg"
import { lightenColor } from "../utils/colorUtils"

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type CertificationSuccessScreenProps = NativeStackScreenProps<RootStackParamList, "CertificationSuccess"> & {
  navigation: NativeStackNavigationProp<RootStackParamList, "CertificationSuccess">
}

const CircularProgress: React.FC<{
  progress: Animated.SharedValue<number>
  size: number
  strokeWidth: number
  color: string
}> = ({ progress, size, strokeWidth, color }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference - progress.value * circumference,
  }))

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle stroke="#f8f8f8" fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
      <AnimatedCircle
        stroke={color}
        fill="none"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        animatedProps={animatedProps}
        strokeLinecap="round"
      />
    </Svg>
  )
}

export default function CertificationSuccessScreen({ route, navigation }: CertificationSuccessScreenProps) {
  const { goalName, goalColor, goalIcon, goalId, imageUri, goalProgress, goalWeeklyGoal } = route.params
  // const [isUploaded, setIsUploaded] = useState(false)

  const animatedProgress = useSharedValue(0)

  useEffect(() => {
    if (Platform.OS === "ios") {
      const triggerHapticFeedback = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      }
      triggerHapticFeedback()
    }

    const progressRatio = goalProgress / goalWeeklyGoal
    animatedProgress.value = withTiming(progressRatio, {
      duration: 2000,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    })
  }, [animatedProgress, goalProgress, goalWeeklyGoal])

  const handleComplete = async () => {
    if (Platform.OS === "ios") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
    navigation.goBack()
  }

  const backgroundColor = lightenColor(goalColor, 0.8)

  return (
    <>
      <StatusBar backgroundColor={backgroundColor} barStyle="dark-content" />
      <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.topContent}>
              <Text style={styles.title}>{goalName}</Text>
              <Text style={[styles.successText, { color: goalColor }]}>목표 달성!</Text>

              <View style={styles.progressContainer}>
                <CircularProgress progress={animatedProgress} size={200} strokeWidth={20} color={goalColor} />
                <View style={[styles.iconContainer, { backgroundColor: `${goalColor}50` }]}>
                  <Text style={styles.iconText}>{goalIcon}</Text>
                </View>
              </View>
              <Text style={styles.progressText}>
                {goalProgress} / {goalWeeklyGoal}
              </Text>
            </View>

            <TouchableOpacity style={[styles.button, { backgroundColor: goalColor }]} onPress={handleComplete}>
              <Text style={styles.buttonText}>나 자신 칭찬해!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 160,
    paddingBottom: 30,
  },
  topContent: {
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    color: "#767676",
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  successText: {
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 40,
    textAlign: "center",
    fontFamily: "MungyeongGamhongApple",
  },
  progressContainer: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconContainer: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 80,
  },
  progressText: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    color: "#767676",
  },
  button: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
})

