import type React from "react"
import { useState, useCallback } from "react"
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
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect } from "@react-navigation/native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import firestore from "@react-native-firebase/firestore"
import auth from "@react-native-firebase/auth"
import { Ionicons } from "@expo/vector-icons"
import type { Goal } from "../types/goal"
import CircularProgress from "../components/CircularProgress"
import type { RootStackParamList } from "../types/navigation"

type ProfileScreenProps = NativeStackScreenProps<RootStackParamList, "Profile">

const ProfileScreen: React.FC<ProfileScreenProps> = ({ route, navigation }) => {
  const { userProfile } = route.params
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAndroidModal, setShowAndroidModal] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [todayCertifications, setTodayCertifications] = useState<string[]>([])

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

      const goalsData = goalsSnapshot.docs.map((doc) => {
        const data = doc.data() as Goal
        return {
          ...data,
          id: doc.id,
        }
      })

      setGoals(goalsData)

      // Fetch today's certifications
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
    } catch (error) {
      console.error("Error fetching goals and certifications:", error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [])

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
    navigation.navigate("GoalCreation", { userProfile, goal })
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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#387aff" />
      </View>
    )
  }

  if (!userProfile) {
    return (
      <View style={styles.container}>
        <Text>로그인 정보가 없습니다.</Text>
        <Text>Debug info: {JSON.stringify(route.params)}</Text>
      </View>
    )
  }

  const today = new Date().getDay()

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileImageContainer}>
          <Image source={{ uri: userProfile.profileImageUrl }} style={styles.profileImage} />
        </View>
        <Text style={styles.name}>{userProfile.nickname}</Text>
        <Text style={styles.sectionTitle}>이번주 목표 현황</Text>

        {goals.map((goal) => {
          const isCompleted = goal.progress >= goal.weeklyGoal
          return (
            <View key={goal.id} style={styles.goalCard}>
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
                      day === today && todayCertifications.includes(goal.id) && { backgroundColor: goal.color },
                    ]}
                  >
                    {day === today && todayCertifications.includes(goal.id) && (
                      <Ionicons name="checkmark" size={24} color="#ffffff" />
                    )}
                  </View>
                ))}
              </View>
              {isCompleted && <View style={styles.dimOverlay} />}
              {isCompleted && (
                <View style={[styles.achievementBadge, { borderColor: goal.color }]}>
                  <Text style={[styles.achievementText, { color: goal.color }]}>이번주 목표 달성!</Text>
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate("GoalCreation", { userProfile })}>
        <Text style={styles.addButtonText}>이번달 목표 추가</Text>
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
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
    color: "#000000",
    textAlign: "center",
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
  },
  iconContainer: {
    position: "relative",
    width: 70,
    height: 70,
    marginRight: 15,
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
  },
  editButton: {
    padding: 5,
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
    // top: "50%",
    // left: "50%",
    // transform: [{ translateX: -75 }, { translateY: -15 }, { rotate: "-15deg" }],
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
    fontSize: 20,
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
})

export default ProfileScreen

