"use client"

import type React from "react"
import { useState, useCallback, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  ActionSheetIOS,
  Modal,
  TextInput,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { RouteProp } from "@react-navigation/native"
import type { MainTabsNavigationProp, MainTabsParamList } from "../types/navigation"
import { useFocusEffect } from "@react-navigation/native"
import firestore from "@react-native-firebase/firestore"
import auth from "@react-native-firebase/auth"
import storage from "@react-native-firebase/storage"
import * as KakaoUser from "@react-native-kakao/user"
import { Ionicons } from "@expo/vector-icons"
import type { Goal } from "../types/goal"
import CircularProgress from "../components/CircularProgress"
import type { UserProfile } from "../types/navigation"
import { startOfWeek } from "date-fns"
import { launchImageLibrary } from "react-native-image-picker"
import SkeletonLoader from "../components/SkeletonLoader"

type ProfileScreenProps = {
  navigation: MainTabsNavigationProp
  route: RouteProp<MainTabsParamList, "Profile">
  userProfile: UserProfile
  handleLogout: () => void
  updateUserProfile: (newProfile: UserProfile) => void
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({
  navigation,
  route,
  userProfile,
  handleLogout,
  updateUserProfile,
}) => {
  const [goals, setGoals] = useState<Goal[]>([])
  const MAX_GOALS = 4
  // const [isLoading, setIsLoading] = useState(true) //Removed
  const [refreshing, setRefreshing] = useState(false)
  const [showAndroidModal, setShowAndroidModal] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [todayCertifications, setTodayCertifications] = useState<string[]>([])
  const [weekCertifications, setWeekCertifications] = useState<{ [goalId: string]: { [day: number]: boolean } }>({})
  const [localUserProfile, setLocalUserProfile] = useState<UserProfile>(userProfile)
  const [isEditingName, setIsEditingName] = useState(false)
  const [newNickname, setNewNickname] = useState(localUserProfile.nickname)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [isNameLoading, setIsNameLoading] = useState(false)

  useEffect(() => {
    const fetchUserProfile = async () => {
      const currentUser = auth().currentUser
      if (currentUser) {
        const userDoc = await firestore().collection("users").doc(currentUser.uid).get()
        if (userDoc.exists) {
          const userData = userDoc.data()
          setLocalUserProfile({
            nickname: userData?.nickname || "사용자",
            profileImageUrl: userData?.profileImageUrl || require("../assets/default-profile-image.png"),
          })
        }
      }
    }
    fetchUserProfile()
  }, [])

  const handleLogoutPress = () => {
    Alert.alert("로그아웃", "정말 로그아웃 하시겠습니까?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          try {
            const user = auth().currentUser
            if (user) {
              try {
                const isKakaoLoggedIn = await KakaoUser.getAccessToken()
                if (isKakaoLoggedIn) {
                  await KakaoUser.logout()
                }
              } catch (error) {
                console.log("Kakao logout skipped")
              }
              await auth().signOut()
            }
            handleLogout()
          } catch (error) {
            console.error("로그아웃 중 오류 발생:", error)
            Alert.alert("오류", "로그아웃 중 문제가 발생했습니다. 다시 시도해 주세요.")
          }
        },
      },
    ])
  }

  const fetchGoals = useCallback(async () => {
    try {
      const currentUser = auth().currentUser
      if (!currentUser) {
        console.log("No authenticated user")
        return
      }

      const goalsSnapshot = await firestore()
        .collection("goals")
        .where("userId", "==", currentUser.uid)
        .orderBy("createdAt", "desc")
        .get()

      const currentDate = new Date()
      const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 })

      const goalsData = await Promise.all(
        goalsSnapshot.docs.map(async (doc) => {
          const data = doc.data() as Goal
          const goalId = doc.id
          let updatedData = { ...data, id: goalId }

          if (!data.lastResetDate || new Date(data.lastResetDate) < currentWeekStart) {
            updatedData = {
              ...updatedData,
              progress: 0,
              days: Array(7).fill(false),
              lastResetDate: currentDate,
            }

            await firestore().collection("goals").doc(goalId).update(updatedData)
          }

          return updatedData
        }),
      )

      setGoals(sortGoalsByAchievementRate(goalsData))

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const certificationsSnapshot = await firestore()
        .collection("certifications")
        .where("userId", "==", currentUser.uid)
        .where("timestamp", ">=", today)
        .where("timestamp", "<", tomorrow)
        .orderBy("timestamp", "asc")
        .get()

      const todayCertificationIds = certificationsSnapshot.docs.map((doc) => doc.data().goalId)
      setTodayCertifications(todayCertificationIds)

      const fetchWeekCertifications = async (userId: string) => {
        const currentDate = new Date()
        const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
        const certifications = await firestore()
          .collection("certifications")
          .where("userId", "==", userId)
          .where("timestamp", ">=", currentWeekStart)
          .where("timestamp", "<=", currentDate)
          .get()

        const weekCerts: { [goalId: string]: { [day: number]: boolean } } = {}
        certifications.docs.forEach((doc) => {
          const certData = doc.data()
          const certDate = certData.timestamp.toDate()
          const dayIndex = (certDate.getDay() + 6) % 7 // 월요일을 0으로 시작하는 인덱스
          const goalId = certData.goalId

          if (!weekCerts[goalId]) {
            weekCerts[goalId] = {}
          }
          weekCerts[goalId][dayIndex] = true
        })

        setWeekCertifications(weekCerts)
      }

      await fetchWeekCertifications(currentUser.uid)
    } catch (error) {
      console.error("Error fetching goals and certifications:", error)
    } finally {
      //setIsLoading(false) //Removed
      setRefreshing(false)
    }
  }, [])

  const sortGoalsByAchievementRate = (goalsToSort: Goal[]) => {
    return [...goalsToSort].sort((a, b) => {
      const rateA = (a.progress / a.weeklyGoal) * 100
      const rateB = (b.progress / b.weeklyGoal) * 100
      return rateA - rateB
    })
  }

  useFocusEffect(
    useCallback(() => {
      fetchGoals()
    }, [fetchGoals]),
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchGoals()
  }, [fetchGoals])

  const handleEditGoal = (goal: Goal) => {
    navigation.navigate("GoalCreation", { userProfile: localUserProfile, goal, isInitialGoal: false })
  }

  const handleDeleteGoal = (goal: Goal) => {
    Alert.alert("목표 삭제", "정말로 이 목표를 삭제하시겠습니까?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "삭제",
        onPress: async () => {
          try {
            await firestore().collection("goals").doc(goal.id).delete()
            fetchGoals()
          } catch (error) {
            console.error("Error deleting goal:", error)
            Alert.alert("오류", "목표를 삭제하는 중 오류가 발생했습니다.")
          }
        },
        style: "destructive",
      },
    ])
  }

  const showActionSheet = (goal: Goal) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["수정", "삭제", "취소"],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleEditGoal(goal)
          } else if (buttonIndex === 1) {
            handleDeleteGoal(goal)
          }
        },
      )
    } else {
      setSelectedGoal(goal)
      setShowAndroidModal(true)
    }
  }

  const handleChangeProfileImage = async () => {
    const result = await launchImageLibrary({
      mediaType: "photo",
      quality: 1,
    })

    if (result.assets && result.assets.length > 0) {
      const selectedImage = result.assets[0]
      const currentUser = auth().currentUser

      if (currentUser && selectedImage.uri) {
        try {
          setIsImageLoading(true)
          const reference = storage().ref(`profile_images/${currentUser.uid}.jpg`)
          await reference.putFile(selectedImage.uri)
          const downloadURL = await reference.getDownloadURL()

          await firestore().collection("users").doc(currentUser.uid).update({
            profileImageUrl: downloadURL,
          })

          setLocalUserProfile((prev) => ({ ...prev, profileImageUrl: downloadURL }))
          // Alert.alert("성공", "프로필 이미지가 업데이트되었습니다.") // 이 줄을 제거합니다.
        } catch (error) {
          console.error("Error updating profile image:", error)
          // Alert.alert("오류", "프로필 이미지 업데이트 중 오류가 발생했습니다.") // 이 줄을 제거합니다.
        } finally {
          setIsImageLoading(false)
        }
      }
    }
  }

  const handleSaveNickname = async () => {
    const currentUser = auth().currentUser
    if (currentUser) {
      try {
        setIsNameLoading(true)
        await firestore().collection("users").doc(currentUser.uid).update({
          nickname: newNickname,
        })
        setLocalUserProfile((prev) => ({ ...prev, nickname: newNickname }))
        setIsEditingName(false)
        updateUserProfile({ ...localUserProfile, nickname: newNickname })
        navigation.setParams({ userProfile: { ...userProfile, nickname: newNickname } })
        // Alert.alert("성공", "닉네임이 업데이트되었습니다.") // 이 줄을 제거합니다.
      } catch (error) {
        console.error("Error updating nickname:", error)
        // Alert.alert("오류", "닉네임 업데이트 중 오류가 발생했습니다.") // 이 줄을 제거합니다.
      } finally {
        setIsNameLoading(false)
      }
    }
  }

  if (!localUserProfile) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#387aff" />
        <Text style={styles.loadingText}>프로필 정보를 불러오는 중...</Text>
      </View>
    )
  }

  //Removed isLoading condition
  // if (isLoading) {
  //   return (
  //     <View style={styles.container}>
  //       <ActivityIndicator size="large" color="#387aff" />
  //     </View>
  //   )
  // }

  const today = new Date().getDay()

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutPress}>
        <Ionicons name="log-out-outline" size={24} color="#767676" />
      </TouchableOpacity>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileImageContainer}>
          {isImageLoading ? (
            <SkeletonLoader width={100} height={100} style={styles.profileImage} />
          ) : (
            <Image
              source={
                typeof localUserProfile.profileImageUrl === "string"
                  ? { uri: localUserProfile.profileImageUrl }
                  : localUserProfile.profileImageUrl
              }
              style={styles.profileImage}
              onLoad={() => setIsImageLoading(false)}
            />
          )}
          <TouchableOpacity style={styles.changeImageButton} onPress={handleChangeProfileImage}>
            <Ionicons name="add-circle" size={24} color="#387aff" />
          </TouchableOpacity>
        </View>
        <View style={styles.nameContainer}>
          {isEditingName ? (
            <>
              <TextInput
                style={styles.nameInput}
                value={newNickname}
                onChangeText={setNewNickname}
                autoFocus
                editable={!isNameLoading}
              />
              <TouchableOpacity onPress={handleSaveNickname} disabled={isNameLoading}>
                {isNameLoading ? (
                  <ActivityIndicator size="small" color="#387aff" />
                ) : (
                  <Ionicons name="checkmark-circle" size={24} color="#387aff" />
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.name}>{localUserProfile.nickname}</Text>
              <TouchableOpacity onPress={() => setIsEditingName(true)}>
                <Ionicons name="pencil" size={18} color="#387aff" />
              </TouchableOpacity>
            </>
          )}
        </View>
        <Text style={styles.sectionTitle}>이번주 목표 현황</Text>

        {goals.map((goal) => {
          const isCompleted = goal.progress >= goal.weeklyGoal
          return (
            <View key={goal.id} style={styles.goalCard}>
              {isCompleted && <View style={styles.dimOverlay} />}
              <View style={styles.goalHeader}>
                <View style={styles.iconContainer}>
                  <CircularProgress
                    size={70}
                    strokeWidth={5}
                    progress={(goal.progress / goal.weeklyGoal) * 100}
                    color={goal.color}
                  />
                  <View style={[styles.subColorContainer, { backgroundColor: `${goal.color}50` }]}>
                    <Text style={styles.icon}>{goal.icon}</Text>
                  </View>
                </View>
                <View style={styles.goalInfo}>
                  <Text style={styles.goalTitle}>{goal.name}</Text>
                  <Text style={[styles.goalProgress, { color: goal.color }]}>
                    주 {goal.progress}/{goal.weeklyGoal}회
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    showActionSheet(goal)
                  }}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color="#a5a5a5" />
                </TouchableOpacity>
              </View>
              <View style={styles.daysContainer}>
                {[1, 2, 3, 4, 5, 6, 0].map((day, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dayCircle,
                      day === 6 || day === 0 ? styles.weekendCircle : null,
                      day === today ? styles.todayCircle : null,
                      weekCertifications[goal.id]?.[index] && { backgroundColor: goal.color },
                    ]}
                  >
                    {weekCertifications[goal.id]?.[index] && <Ionicons name="checkmark" size={24} color="#ffffff" />}
                  </View>
                ))}
              </View>
              {isCompleted && (
                <View style={[styles.achievementBadge, { borderColor: goal.color }]}>
                  <Text style={[styles.achievementText, { color: goal.color }]}>이번주 목표 달성!</Text>
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.addButton, goals.length >= MAX_GOALS && styles.disabledButton]}
        onPress={() =>
          navigation.navigate("GoalCreation", { userProfile: localUserProfile, isInitialGoal: false, goal: undefined })
        }
        disabled={goals.length >= MAX_GOALS}
      >
        <Text style={styles.addButtonText}>
          {goals.length >= MAX_GOALS
            ? "목표는 최대 4개까지 추가 가능해요"
            : `이번달 목표 추가 (${goals.length}/${MAX_GOALS})`}
        </Text>
      </TouchableOpacity>
      {Platform.OS === "android" && (
        <Modal
          visible={showAndroidModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAndroidModal(false)}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAndroidModal(false)}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setShowAndroidModal(false)
                  if (selectedGoal) handleEditGoal(selectedGoal)
                }}
              >
                <Text style={styles.modalOptionText}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalOption, styles.deleteOption]}
                onPress={() => {
                  setShowAndroidModal(false)
                  if (selectedGoal) handleDeleteGoal(selectedGoal)
                }}
              >
                <Text style={[styles.modalOptionText, styles.deleteOptionText]}>삭제</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOption} onPress={() => setShowAndroidModal(false)}>
                <Text style={styles.modalOptionText}>취소</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: 30,
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileImageContainer: {
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  changeImageButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 2,
  },
  name: {
    fontSize: 20,
    marginRight: 10,
    color: "#000000",
    fontFamily: "MungyeongGamhongApple",
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  nameInput: {
    fontSize: 20,
    color: "#000000",
    textAlign: "center",
    fontFamily: "MungyeongGamhongApple",
    borderBottomWidth: 1,
    borderBottomColor: "#387aff",
    paddingBottom: 5,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#838383",
    marginBottom: 15,
    marginLeft: 4,
    alignSelf: "flex-start",
    width: "100%",
  },
  goalCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    overflow: "hidden",
    position: "relative",
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 2,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    position: "relative",
  },
  iconContainer: {
    position: "relative",
    width: 70,
    height: 70,
    marginRight: 15,
    zIndex: 1,
  },
  subColorContainer: {
    position: "absolute",
    top: 5,
    left: 5,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    fontSize: 30,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#000000",
  },
  goalProgress: {
    fontSize: 14,
    zIndex: 1,
  },
  editButton: {
    padding: 5,
    zIndex: 3,
    position: "relative",
  },
  daysContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayCircle: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#d9d9d9",
    marginHorizontal: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  weekendCircle: {
    backgroundColor: "#FBDFDF",
  },
  todayCircle: {
    borderWidth: 2,
    borderColor: "#767676",
  },
  achievementBadge: {
    position: "absolute",
    backgroundColor: "#ffffff",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  achievementText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  addButton: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "#387aff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalOption: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f8f8f8",
  },
  modalOptionText: {
    fontSize: 18,
    color: "#387aff",
    textAlign: "center",
  },
  deleteOption: {
    borderBottomWidth: 0,
  },
  deleteOptionText: {
    color: "#f4583f",
  },
  logoutButton: {
    position: "absolute",
    top: 80,
    right: 20,
    zIndex: 10,
  },
  disabledButton: {
    backgroundColor: "#a7a7a7",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#767676",
  },
})

export default ProfileScreen

