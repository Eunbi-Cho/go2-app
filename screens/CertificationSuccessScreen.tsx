"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../types/navigation"
import Animated, { useSharedValue, withTiming, useAnimatedProps, Easing } from "react-native-reanimated"
import * as Haptics from "expo-haptics"
import Svg, { Circle } from "react-native-svg"
import { lightenColor } from "../utils/colorUtils"
import firestore from "@react-native-firebase/firestore"

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type CertificationSuccessScreenProps = NativeStackScreenProps<RootStackParamList, "CertificationSuccess">

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
  const [isUploading, setIsUploading] = useState(true)

  const animatedProgress = useSharedValue(0)

  useEffect(() => {
    const progressRatio = goalProgress / goalWeeklyGoal
    animatedProgress.value = withTiming(progressRatio, {
      duration: 2000,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    })

    if (Platform.OS === "ios") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }

    const checkUploadStatus = async () => {
      try {
        const certificationRef = firestore()
          .collection("certifications")
          .where("goalId", "==", goalId)
          .orderBy("timestamp", "desc")
          .limit(1)
        const unsubscribe = certificationRef.onSnapshot(
          (snapshot) => {
            if (snapshot && !snapshot.empty) {
              const latestCertification = snapshot.docs[0].data()
              if (latestCertification.imageUrl) {
                setIsUploading(false)
                unsubscribe()
              }
            }
          },
          (error) => {
            console.error("Error checking upload status:", error)
            setIsUploading(false)
          },
        )

        return unsubscribe
      } catch (error) {
        console.error("Error setting up upload status check:", error)
        setIsUploading(false)
        return () => {}
      }
    }

    const unsubscribePromise = checkUploadStatus()
    return () => {
      unsubscribePromise.then((unsubscribe) => {
        if (typeof unsubscribe === "function") {
          unsubscribe()
        }
      })
    }
  }, [animatedProgress, goalProgress, goalWeeklyGoal, goalId])

  const handleComplete = () => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" }],
    })
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
                {isUploading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={goalColor} />
                  </View>
                )}
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
})

