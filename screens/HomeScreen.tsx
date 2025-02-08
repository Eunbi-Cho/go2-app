"use client"

import { useState, useEffect, useCallback } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import firestore from "@react-native-firebase/firestore"
import storage from "@react-native-firebase/storage"
import auth from "@react-native-firebase/auth"
import GoalAndImageSelectionModal from "../components/GoalAndImageSelectionModal"
import CertificationCard from "../components/CertificationCard"
import type { Goal } from "../types/goal"
import type { Certification } from "../types/certification"
import type { User } from "../types/user"
import type { RootStackNavigationProp } from "../types/navigation"
import * as FileSystem from "expo-file-system"

export default function HomeScreen({ navigation }: { navigation: RootStackNavigationProp }) {
  const navigationProp = useNavigation<RootStackNavigationProp>()
  const [remainingTime, setRemainingTime] = useState<string>("")
  const [isTimeAlmostUp, setIsTimeAlmostUp] = useState<boolean>(false)
  const [showModal, setShowModal] = useState(false)
  const [goals, setGoals] = useState<Goal[]>([])
  const [userCertifications, setUserCertifications] = useState<Certification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadingCertification, setUploadingCertification] = useState<Certification | null>(null)
  const [users, setUsers] = useState<{ [key: string]: User }>({})
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userChallengeGroup, setUserChallengeGroup] = useState<string | null>(null)
  const [groupGoals, setGroupGoals] = useState<{ [userId: string]: Goal[] }>({})

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      const timeRemaining = endOfDay.getTime() - now.getTime()
      const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60))
      const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
      const secondsRemaining = Math.floor((timeRemaining % (1000 * 60)) / 1000)

      setRemainingTime(
        `${hoursRemaining.toString().padStart(2, "0")}:${minutesRemaining.toString().padStart(2, "0")}:${secondsRemaining
          .toString()
          .padStart(2, "0")}`,
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
    return goalsData
  }, [])

  const fetchCertifications = useCallback(async (userGoals: Goal[] = []) => {
    const currentUser = auth().currentUser
    if (!currentUser) {
      console.log("No authenticated user")
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    console.log("Fetching certifications for date range:", today, "to", tomorrow)

    // Fetch user's challenge group
    const userDoc = await firestore().collection("users").doc(currentUser.uid).get()
    const userData = userDoc.data()
    const groupId = userData?.challengeGroupId
    setUserChallengeGroup(groupId)

    // 현재 사용자 정보 로드
    const currentUserDoc = await firestore().collection("users").doc(currentUser.uid).get()
    if (currentUserDoc.exists) {
      const currentUserData = { id: currentUser.uid, ...currentUserDoc.data() } as User
      setCurrentUser(currentUserData)
      setUsers((prevUsers) => ({ ...prevUsers, [currentUser.uid]: currentUserData }))
    }

    let certificationsQuery = firestore()
      .collection("certifications")
      .where("timestamp", ">=", today)
      .where("timestamp", "<", tomorrow)
      .orderBy("timestamp", "desc")

    let memberIds: string[] = [currentUser.uid]

    if (groupId) {
      console.log("User's challenge group ID:", groupId)
      // Fetch group members
      const membersSnapshot = await firestore().collection("users").where("challengeGroupId", "==", groupId).get()
      memberIds = membersSnapshot.docs.map((doc) => doc.id)
      console.log("Group member IDs:", memberIds)

      certificationsQuery = certificationsQuery.where("userId", "in", memberIds)

      // Fetch users data
      const usersData: { [key: string]: User } = {}
      await Promise.all(
        memberIds.map(async (userId) => {
          const userDoc = await firestore().collection("users").doc(userId).get()
          if (userDoc.exists) {
            const userData = userDoc.data()
            usersData[userId] = {
              id: userId,
              ...userData,
              profileImageUrl: userData?.profileImageUrl || null,
            } as User
          }
        }),
      )
      setUsers(usersData)
      console.log("Updated users data:", usersData)
    } else {
      console.log("User is not in a challenge group")
      certificationsQuery = certificationsQuery.where("userId", "==", currentUser.uid)
    }

    const certificationsSnapshot = await certificationsQuery.get()

    const certificationsData = certificationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Certification[]

    // Fetch group members' goals
    const groupGoals: { [userId: string]: Goal[] } = {}
    const groupGoalsSnapshot = await firestore().collection("goals").where("userId", "in", memberIds).get()
    groupGoalsSnapshot.docs.forEach((doc) => {
      const goal = { id: doc.id, ...doc.data() } as Goal
      if (!groupGoals[goal.userId]) {
        groupGoals[goal.userId] = []
      }
      groupGoals[goal.userId].push(goal)
    })
    setGroupGoals(groupGoals)

    // 현재 사용자의 인증샷 중 삭제된 목표의 인증샷을 필터링합니다.
    const filteredCertifications = certificationsData.filter((cert) => {
      if (cert.userId === currentUser.uid) {
        // 현재 사용자의 인증샷인 경우, 해당 목표가 존재하는지 확인
        return userGoals.some((goal) => goal.id === cert.goalId)
      }
      // 다른 사용자의 인증샷은 해당 사용자의 현재 목표와 일치하는지 확인
      return groupGoals[cert.userId]?.some((goal) => goal.id === cert.goalId)
    })

    setUserCertifications(filteredCertifications)
    setIsLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        const userGoals = await fetchGoals()
        await fetchCertifications(userGoals)
      }
      fetchData()
    }, [fetchGoals, fetchCertifications]),
  )

  const handleUploadPress = () => {
    setShowModal(true)
  }

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      const filename = `certification_${Date.now()}.jpg`
      const tempUri = FileSystem.documentDirectory + filename

      // Copy the image to a temporary location
      await FileSystem.copyAsync({
        from: uri,
        to: tempUri,
      })

      const ref = storage().ref().child(`certification_images/${filename}`)

      // Upload the temporary file
      await ref.putFile(tempUri)

      // Delete the temporary file
      await FileSystem.deleteAsync(tempUri, { idempotent: true })

      return await ref.getDownloadURL()
    } catch (error) {
      console.error("Error in uploadImage:", error)
      throw new Error("이미지 업로드 중 오류가 발생했습니다.")
    }
  }

  const handleImageUpload = async (goalId: string, imageUri: string) => {
    const currentUser = auth().currentUser
    if (!currentUser) return

    setIsUploading(true)
    try {
      const selectedGoal: Goal | undefined = goals.find((goal) => goal.id === goalId)
      if (!selectedGoal) {
        throw new Error("Selected goal not found")
      }

      const timestamp = firestore.Timestamp.now()
      const newProgress = selectedGoal.progress + 1
      const progressPercentage = (newProgress / selectedGoal.weeklyGoal) * 100

      // Navigate to CertificationSuccessScreen immediately
      navigation.push("CertificationSuccess", {
        goalName: selectedGoal.name,
        goalColor: selectedGoal.color,
        goalIcon: selectedGoal.icon || undefined,
        imageUri: imageUri,
        goalId: goalId,
        goalProgress: newProgress,
        goalWeeklyGoal: selectedGoal.weeklyGoal,
      })

      // Continue upload process in the background
      const imageUrl = await uploadImage(imageUri)

      // Update goal progress and days
      const goalRef = firestore().collection("goals").doc(goalId)
      await firestore().runTransaction(async (transaction) => {
        const goalDoc = await transaction.get(goalRef)
        if (!goalDoc.exists) {
          throw new Error("Goal document not found")
        }

        const goalData = goalDoc.data() as Goal
        const currentDate = new Date()
        const currentWeekStart = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay() + 1))
        currentWeekStart.setHours(0, 0, 0, 0)

        let newProgress = goalData.progress
        let newDays = [...goalData.days]

        // Reset progress if it's a new week
        if (!goalData.lastResetDate || new Date(goalData.lastResetDate) < currentWeekStart) {
          newProgress = 1
          newDays = Array(7).fill(false)
        } else {
          newProgress = Math.min(goalData.progress + 1, goalData.weeklyGoal)
        }

        const dayOfWeek = currentDate.getDay()
        newDays[dayOfWeek === 0 ? 6 : dayOfWeek - 1] = true

        transaction.update(goalRef, {
          progress: newProgress,
          days: newDays,
          lastResetDate: currentDate,
        })
      })

      // Save certification data after image upload
      const newCertification: Omit<Certification, "id"> = {
        userId: currentUser.uid,
        goalId: goalId,
        imageUrl: imageUrl,
        timestamp: timestamp,
        goalProgress: progressPercentage,
        goalWeeklyGoal: selectedGoal.weeklyGoal,
      }

      await firestore().collection("certifications").add(newCertification)

      // Refresh goals and certifications
      await fetchGoals()
      const updatedGoals = await fetchGoals()
      if (updatedGoals) {
        await fetchCertifications(updatedGoals)
      }
    } catch (error) {
      console.error("Error uploading image:", error)
      Alert.alert("업로드 실패", "이미지 업로드 중 오류가 발생했습니다. 다시 시도해 주세요.")
    } finally {
      setIsUploading(false)
    }
  }

  const renderCertifications = (certifications: Certification[]) => {
    console.log(`Rendering certifications:`, certifications)
    return (
      <>
        {certifications.map((cert) => {
          console.log(`Rendering certification:`, cert)
          const userGoals = groupGoals[cert.userId] || []
          const certGoal =
            userGoals.find((g) => g.id === cert.goalId) ||
            ({
              id: cert.goalId,
              icon: "🎯",
              color: "#387aff",
              name: "Group Goal",
              progress: 0,
              weeklyGoal: 1,
            } as Goal)
          return (
            <CertificationCard
              key={cert.id}
              certification={cert}
              goal={certGoal}
              user={users[cert.userId]}
              isLoading={cert.id === uploadingCertification?.id}
              currentUser={currentUser}
            />
          )
        })}
      </>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.timeText, isTimeAlmostUp && styles.timeTextAlmostUp]}>{remainingTime}</Text>
        <Text style={styles.headerText}>오늘의 목표 달성을 인증하세요</Text>

        <View style={styles.certificationContainer}>
          {isLoading ? <ActivityIndicator size="large" color="#387aff" /> : renderCertifications(userCertifications)}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.uploadButton, isUploading && styles.disabledButton]}
        onPress={handleUploadPress}
        disabled={isUploading}
      >
        <Text style={styles.uploadButtonText}>{isUploading ? "인증샷 업로드 중..." : "인증샷 올리기"}</Text>
      </TouchableOpacity>

      <GoalAndImageSelectionModal
        isVisible={showModal}
        goals={goals.filter((goal) => !userCertifications.map((cert) => cert.goalId).includes(goal.id))}
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
    fontFamily: "MungyeongGamhongApple",
  },
  timeTextAlmostUp: {
    color: "#ff3873",
  },
  headerText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
    color: "#6A6A6A",
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
  disabledButton: {
    backgroundColor: "#a5a5a5",
  },
  uploadButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
})

