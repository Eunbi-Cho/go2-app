import type React from "react"
import { useState, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import firestore from "@react-native-firebase/firestore"
import { Ionicons } from "@expo/vector-icons"
import type { Goal } from "../types/goal"
import CircularProgress from "../components/CircularProgress"
import type { RootStackParamList } from "../types/navigation"
import { startOfWeek } from "date-fns"

type FriendProfileScreenProps = NativeStackScreenProps<RootStackParamList, "FriendProfile">

const FriendProfileScreen: React.FC<FriendProfileScreenProps> = ({ route }) => {
  const { userId } = route.params
  const [friendProfile, setFriendProfile] = useState<{ nickname: string; profileImageUrl: string } | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [weekCertifications, setWeekCertifications] = useState<{ [goalId: string]: { [day: number]: boolean } }>({})
  const navigation = useNavigation()

  const fetchFriendProfile = useCallback(async () => {
    try {
      const userDoc = await firestore().collection("users").doc(userId).get()
      if (userDoc.exists) {
        const userData = userDoc.data()
        setFriendProfile({
          nickname: userData?.nickname || "Unknown",
          profileImageUrl: userData?.profileImageUrl || "",
        })
      }
    } catch (error) {
      console.error("Error fetching friend profile:", error)
    }
  }, [userId])

  const fetchGoals = useCallback(async () => {
    try {
      const goalsSnapshot = await firestore()
        .collection("goals")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get()

      const currentDate = new Date()
      const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 })

      const goalsData = goalsSnapshot.docs.map((doc) => {
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
        }

        return updatedData
      })

      setGoals(sortGoalsByAchievementRate(goalsData))

      const fetchWeekCertifications = async (friendUserId: string) => {
        const currentDate = new Date()
        const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
        const certifications = await firestore()
          .collection("certifications")
          .where("userId", "==", friendUserId)
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

      await fetchWeekCertifications(userId)
    } catch (error) {
      console.error("Error fetching goals and certifications:", error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [userId])

  const sortGoalsByAchievementRate = (goalsToSort: Goal[]) => {
    return [...goalsToSort].sort((a, b) => {
      const rateA = (a.progress / a.weeklyGoal) * 100
      const rateB = (b.progress / b.weeklyGoal) * 100
      return rateA - rateB
    })
  }

  useFocusEffect(
    useCallback(() => {
      fetchFriendProfile()
      fetchGoals()
    }, [fetchFriendProfile, fetchGoals]),
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchFriendProfile()
    fetchGoals()
  }, [fetchFriendProfile, fetchGoals])

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#387aff" />
      </View>
    )
  }

  const today = new Date().getDay()

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#000000" />
      </TouchableOpacity>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileImageContainer}>
          <Image source={{ uri: friendProfile?.profileImageUrl }} style={styles.profileImage} />
        </View>
        <Text style={styles.name}>{friendProfile?.nickname}</Text>
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
    fontSize: 20,
    marginBottom: 30,
    color: "#000000",
    textAlign: "center",
    fontFamily: "MungyeongGamhongApple",
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
  backButton: {
    position: "absolute",
    top: 80,
    left: 20,
    zIndex: 10,
  },
})

export default FriendProfileScreen

