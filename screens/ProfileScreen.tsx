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

      const goalsData = goalsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Goal[]

      setGoals(goalsData)
    } catch (error) {
      console.error("Error fetching goals:", error)
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
            Alert.alert("오류", "목표를 삭제하는 중 오류�� 발생했습니다.")
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

        {goals.map((goal) => (
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
              {goal.days.map((completed, index) => (
                <View key={index} style={[styles.dayCircle, completed && styles.completedDay]} />
              ))}
            </View>
          </View>
        ))}
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
    backgroundColor: "#ffffff",
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
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
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
    fontSize: 24,
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
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#D1D1D1",
  },
  completedDay: {
    backgroundColor: "#387aff",
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

