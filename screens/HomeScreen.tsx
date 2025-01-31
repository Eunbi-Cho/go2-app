import { useState, useEffect, useCallback } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect } from "@react-navigation/native"
import firestore from "@react-native-firebase/firestore"
import auth from "@react-native-firebase/auth"
import GoalAndImageSelectionModal from "../components/GoalAndImageSelectionModal"
import CertificationCard from "../components/CertificationCard"
import type { Goal } from "../types/goal"
import type { Certification } from "../types/certification"

export default function HomeScreen() {
  const [remainingTime, setRemainingTime] = useState<string>("")
  const [isTimeAlmostUp, setIsTimeAlmostUp] = useState<boolean>(false)
  const [showModal, setShowModal] = useState(false)
  const [goals, setGoals] = useState<Goal[]>([])
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [todayCertifiedGoals, setTodayCertifiedGoals] = useState<string[]>([])

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      const timeRemaining = endOfDay.getTime() - now.getTime()
      const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60))
      const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
      const secondsRemaining = Math.floor((timeRemaining % (1000 * 60)) / 1000)

      setRemainingTime(
        `${hoursRemaining.toString().padStart(2, "0")}:${minutesRemaining.toString().padStart(2, "0")}:${secondsRemaining.toString().padStart(2, "0")}`,
      )
      setIsTimeAlmostUp(hoursRemaining < 2)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchGoals = useCallback(async () => {
    const currentUser = auth().currentUser
    if (!currentUser) return

    const goalsSnapshot = await firestore().collection("goals").where("userId", "==", currentUser.uid).get()

    const goalsData = goalsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Goal)
    setGoals(goalsData)
  }, [])

  const fetchCertifications = useCallback(async () => {
    const currentUser = auth().currentUser
    if (!currentUser) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const certificationsSnapshot = await firestore()
      .collection("certifications")
      .where("userId", "==", currentUser.uid)
      .where("timestamp", ">=", today)
      .orderBy("timestamp", "desc")
      .get()

    const certificationsData = await Promise.all(
      certificationsSnapshot.docs.map(async (doc) => {
        const certData = doc.data() as Omit<Certification, "id">
        const goalDoc = await firestore().collection("goals").doc(certData.goalId).get()
        const goalData = goalDoc.data() as Goal
        return {
          id: doc.id,
          ...certData,
          goalProgress: goalData.progress,
          goalWeeklyGoal: goalData.weeklyGoal,
        } as Certification
      }),
    )
    setCertifications(certificationsData)

    // Update today's certified goals
    const certifiedGoalIds = certificationsData.map((cert) => cert.goalId)
    setTodayCertifiedGoals(certifiedGoalIds)
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchGoals()
      fetchCertifications()
    }, [fetchGoals, fetchCertifications]),
  )

  const handleUploadPress = () => {
    setShowModal(true)
  }

  const handleImageUpload = async (goalId: string, imageUri: string) => {
    const currentUser = auth().currentUser
    if (!currentUser) return

    const timestamp = firestore.Timestamp.now()

    const selectedGoal = goals.find((goal) => goal.id === goalId)
    if (!selectedGoal) return

    const newCertification: Omit<Certification, "id"> = {
      userId: currentUser.uid,
      goalId: goalId,
      imageUrl: imageUri,
      timestamp: timestamp,
      goalProgress: selectedGoal.progress + 1,
      goalWeeklyGoal: selectedGoal.weeklyGoal,
    }

    const docRef = await firestore().collection("certifications").add(newCertification)
    const addedCertification: Certification = { ...newCertification, id: docRef.id }

    setCertifications((prev) => [addedCertification, ...prev])
    setTodayCertifiedGoals((prev) => [...prev, goalId])
    setShowModal(false)

    // Update goal progress and days
    const goalRef = firestore().collection("goals").doc(goalId)
    await firestore().runTransaction(async (transaction) => {
      const goalDoc = await transaction.get(goalRef)
      if (!goalDoc.exists) return

      const goalData = goalDoc.data() as Goal
      const newProgress = Math.min(goalData.progress + 1, goalData.weeklyGoal)
      const dayOfWeek = timestamp.toDate().getDay()
      const newDays = [...goalData.days]
      newDays[dayOfWeek === 0 ? 6 : dayOfWeek - 1] = true // Adjust for Sunday being 0
      transaction.update(goalRef, { progress: newProgress, days: newDays })
    })

    fetchGoals()
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={[styles.timeText, isTimeAlmostUp && styles.timeTextAlmostUp]}>{remainingTime}</Text>
      <Text style={styles.headerText}>오늘의 목표 달성을 인증하세요</Text>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.gridContainer}>
          {certifications.map((cert) => (
            <CertificationCard key={cert.id} certification={cert} goals={goals} />
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.uploadButton} onPress={handleUploadPress}>
        <Text style={styles.uploadButtonText}>+ 인증샷 올리기</Text>
      </TouchableOpacity>

      <GoalAndImageSelectionModal
        visible={showModal}
        goals={goals.filter((goal) => !todayCertifiedGoals.includes(goal.id))}
        onClose={() => setShowModal(false)}
        onImageSelected={handleImageUpload}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
  },
  timeText: {
    fontSize: 42,
    fontWeight: "bold",
    textAlign: "center",
    color: "#387aff",
    marginTop: 20,
    marginBottom: 10,
  },
  timeTextAlmostUp: {
    color: "#ff3873",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 20,
    color: "#000000",
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    paddingVertical: 10,
  },
  uploadButton: {
    backgroundColor: "#387aff",
    padding: 15,
    marginVertical: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  uploadButtonText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
  },
})

