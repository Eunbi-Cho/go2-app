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
    setIsLoading(true)
    try {
      const currentUser = auth().currentUser
      if (!currentUser) {
        console.log("No authenticated user")
        setIsLoading(false)
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      console.log("Fetching certifications for date range:", today, "to", tomorrow)

      // Fetch user's challenge groups
      const userDoc = await firestore().collection("users").doc(currentUser.uid).get()
      const userData = userDoc.data()

      // 호환성을 위해 challengeGroupId 필드 처리
      let userGroups: string[] = []

      // 기존 사용자의 경우 challengeGroupId가 문자열일 수 있음
      if (userData?.challengeGroupId) {
        if (typeof userData.challengeGroupId === "string") {
          // 문자열인 경우 배열에 추가
          userGroups.push(userData.challengeGroupId)
        } else if (Array.isArray(userData.challengeGroupId)) {
          // 이미 배열인 경우 그대로 사용
          userGroups = userData.challengeGroupId
        }
      }

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

      if (userGroups.length > 0) {
        console.log("User's challenge group IDs:", userGroups)

        // 모든 그룹의 멤버 수집
        const allMembers = new Set<string>()
        allMembers.add(currentUser.uid) // 현재 사용자 추가

        // 각 그룹의 멤버 가져오기
        for (const groupId of userGroups) {
          // 그룹 멤버 가져오기 - challengeGroupId가 문자열인 경우
          const stringMembersSnapshot = await firestore()
            .collection("users")
            .where("challengeGroupId", "==", groupId)
            .get()

          stringMembersSnapshot.docs.forEach((doc) => {
            allMembers.add(doc.id)
          })

          // 그룹 멤버 가져오기 - challengeGroupId가 배열인 경우
          const arrayMembersSnapshot = await firestore()
            .collection("users")
            .where("challengeGroupId", "array-contains", groupId)
            .get()

          arrayMembersSnapshot.docs.forEach((doc) => {
            allMembers.add(doc.id)
          })
        }

        memberIds = Array.from(allMembers)
        console.log("All group members IDs:", memberIds)

        if (memberIds.length > 0) {
          // Firestore에는 "in" 쿼리에 최대 10개의 값만 허용
          // 멤버가 10명 이상이면 여러 쿼리로 나누어 실행해야 함
          if (memberIds.length <= 10) {
            certificationsQuery = certificationsQuery.where("userId", "in", memberIds)
          } else {
            // 10명씩 나누어 쿼리 실행
            const certificationBatches = []

            // 10명씩 나누어 쿼리 실행
            for (let i = 0; i < memberIds.length; i += 10) {
              const batchMemberIds = memberIds.slice(i, i + 10)
              const batchQuery = firestore()
                .collection("certifications")
                .where("userId", "in", batchMemberIds)
                .where("timestamp", ">=", today)
                .where("timestamp", "<", tomorrow)
                .orderBy("timestamp", "desc")

              certificationBatches.push(batchQuery.get())
            }

            // 모든 쿼리 결과 합치기
            const batchResults = await Promise.all(certificationBatches)
            const allCertifications = batchResults.flatMap((batch) =>
              batch.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Certification),
            )

            // 인증샷 데이터 설정
            console.log(`Found ${allCertifications.length} certifications from all batches`)

            // 사용자 정보와 목표 정보 가져오기
            await fetchUsersAndGoals(memberIds)

            setUserCertifications(allCertifications)
            setIsLoading(false)
            return
          }
        } else {
          console.log("No members found in any groups")
          certificationsQuery = certificationsQuery.where("userId", "==", currentUser.uid)
        }

        // Fetch users data
        await fetchUsersAndGoals(memberIds)
      } else {
        console.log("User is not in any challenge groups")
        certificationsQuery = certificationsQuery.where("userId", "==", currentUser.uid)
      }

      const certificationsSnapshot = await certificationsQuery.get()
      console.log("Certifications found:", certificationsSnapshot.size)

      const certificationsData = certificationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Certification[]

      // 모든 인증샷을 표시하도록 필터링 로직 수정
      setUserCertifications(certificationsData)
    } catch (error) {
      console.error("Error fetching certifications:", error)
      // 오류 발생 시 빈 배열로 설정
      setUserCertifications([])
    } finally {
      // 항상 로딩 상태 종료
      setIsLoading(false)
    }
  }, [])

  // 사용자 정보와 목표 정보 가져오기
  const fetchUsersAndGoals = async (memberIds: string[]) => {
    // 사용자 정보 가져오기
    const usersData: { [key: string]: User } = {}
    await Promise.all(
      memberIds.map(async (userId) => {
        try {
          const userDoc = await firestore().collection("users").doc(userId).get()
          if (userDoc.exists) {
            const userData = userDoc.data()
            usersData[userId] = {
              id: userId,
              ...userData,
              profileImageUrl: userData?.profileImageUrl || null,
            } as User
          }
        } catch (error) {
          console.error(`Error fetching user data for ${userId}:`, error)
        }
      }),
    )
    setUsers(usersData)

    // 목표 정보 가져오기
    try {
      // 한 번에 최대 10명의 사용자 목표만 가져올 수 있으므로 배치 처리
      const goalsData: { [userId: string]: Goal[] } = {}

      for (let i = 0; i < memberIds.length; i += 10) {
        const batchMemberIds = memberIds.slice(i, Math.min(i + 10, memberIds.length))
        const groupGoalsSnapshot = await firestore().collection("goals").where("userId", "in", batchMemberIds).get()

        groupGoalsSnapshot.docs.forEach((doc) => {
          const goal = { id: doc.id, ...doc.data() } as Goal
          if (!goalsData[goal.userId]) {
            goalsData[goal.userId] = []
          }
          goalsData[goal.userId].push(goal)
        })
      }

      setGroupGoals(goalsData)
    } catch (error) {
      console.error("Error fetching goals:", error)
    }
  }

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
    console.log(`Rendering certifications:`, certifications.length)

    if (certifications.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateText}>오늘 인증된 목표가 없습니다</Text>
        </View>
      )
    }

    return (
      <>
        {certifications.map((cert) => {
          console.log(`Rendering certification:`, cert.id, cert.userId)
          const userGoals = groupGoals[cert.userId] || []
          const certGoal =
            userGoals.find((g) => g.id === cert.goalId) ||
            ({
              id: cert.goalId,
              icon: "🎯",
              color: "#387aff",
              name: "목표",
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
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#767676",
    textAlign: "center",
  },
})

