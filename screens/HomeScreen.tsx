import { useState, useEffect, useCallback } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect } from "@react-navigation/native"
import firestore from "@react-native-firebase/firestore"
import storage from "@react-native-firebase/storage"
import auth from "@react-native-firebase/auth"
import GoalAndImageSelectionModal from "../components/GoalAndImageSelectionModal"
import CertificationCard from "../components/CertificationCard"
import type { Goal } from "../types/goal"
import type { Certification } from "../types/certification"
import type { User } from "../types/user"

export default function HomeScreen() {
  const [remainingTime, setRemainingTime] = useState<string>("")
  const [isTimeAlmostUp, setIsTimeAlmostUp] = useState<boolean>(false)
  const [showModal, setShowModal] = useState(false)
  const [goals, setGoals] = useState<Goal[]>([])
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [todayCertifiedGoals, setTodayCertifiedGoals] = useState<string[]>([])
  const [users, setUsers] = useState<{ [key: string]: User }>({})

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
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const certificationsSnapshot = await firestore()
      .collection("certifications")
      .where("timestamp", ">=", today)
      .orderBy("timestamp", "desc")
      .get()

    const certificationsData = certificationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Certification[]

    setCertifications(certificationsData)

    // Fetch users data
    const userIds = [...new Set(certificationsData.map((cert) => cert.userId))]
    const usersData: { [key: string]: User } = {}
    await Promise.all(
      userIds.map(async (userId) => {
        const userDoc = await firestore().collection("users").doc(userId).get()
        if (userDoc.exists) {
          usersData[userId] = userDoc.data() as User
        }
      }),
    )
    setUsers(usersData)

    // Update today's certified goals for the current user
    const currentUser = auth().currentUser
    if (currentUser) {
      const userCertifiedGoals = certificationsData
        .filter((cert) => cert.userId === currentUser.uid)
        .map((cert) => cert.goalId)
      setTodayCertifiedGoals(userCertifiedGoals)
    }
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

  const uploadImage = async (uri: string): Promise<string> => {
    const response = await fetch(uri)
    const blob = await response.blob()
    const filename = `certification_${Date.now()}.jpg`
    const ref = storage().ref().child(`certification_images/${filename}`)
    await ref.put(blob)
    return await ref.getDownloadURL()
  }

  const handleImageUpload = async (goalId: string, imageUri: string) => {
    const currentUser = auth().currentUser
    if (!currentUser) return

    try {
      const timestamp = firestore.Timestamp.now()
      const imageUrl = await uploadImage(imageUri)

      const selectedGoal = goals.find((goal) => goal.id === goalId)
      if (!selectedGoal) return

      const newProgress = selectedGoal.progress + 1
      const progressPercentage = (newProgress / selectedGoal.weeklyGoal) * 100

      const newCertification: Omit<Certification, "id"> = {
        userId: currentUser.uid,
        goalId: goalId,
        imageUrl: imageUrl,
        timestamp: timestamp,
        goalProgress: progressPercentage,
        goalWeeklyGoal: selectedGoal.weeklyGoal,
      }

      const docRef = await firestore().collection("certifications").add(newCertification)
      const addedCertification: Certification = { id: docRef.id, ...newCertification }

      setCertifications((prev) => [addedCertification, ...prev])
      setTodayCertifiedGoals((prev) => [...prev, goalId])

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

      await fetchGoals()
    } catch (error) {
      console.error("Error uploading image:", error)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.timeText, isTimeAlmostUp && styles.timeTextAlmostUp]}>{remainingTime}</Text>
        <Text style={styles.headerText}>오늘의 목표 달성을 인증하세요</Text>

        <View style={styles.certificationContainer}>
          {certifications.map((cert) => (
            <CertificationCard key={cert.id} certification={cert} goals={goals} user={users[cert.userId]} />
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.uploadButton} onPress={handleUploadPress}>
        <Text style={styles.uploadButtonText}>+ 인증샷 올리기</Text>
      </TouchableOpacity>

      <GoalAndImageSelectionModal
        isVisible={showModal}
        goals={goals.filter((goal) => !todayCertifiedGoals.includes(goal.id))}
        onClose={() => setShowModal(false)}
        onImageSelected={(goalId: string, imageUri: string) => {
          setShowModal(false)
          handleImageUpload(goalId, imageUri)
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 100,
  },
  timeText: {
    fontSize: 42,
    fontWeight: "bold",
    textAlign: "center",
    color: "#387aff",
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
  certificationContainer: {
    marginTop: 10,
  },
  uploadButton: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "#387aff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  uploadButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
})

