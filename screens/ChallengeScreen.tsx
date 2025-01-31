import { useState, useEffect } from "react"
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Clipboard from "@react-native-clipboard/clipboard"
import auth from "@react-native-firebase/auth"
import firestore from "@react-native-firebase/firestore"
import { Ionicons } from "@expo/vector-icons"
import type { ChallengeMember } from "../types/challenge"
import type { Goal } from "../types/goal"
import GoalIcons from "../components/GoalIcons"
import JoinChallengeModal from "../components/JoinChallengeModal"
import { createChallengeDeepLink } from "../utils/deepLinking"

export default function ChallengeScreen() {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [members, setMembers] = useState<ChallengeMember[]>([])
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [daysLeft, setDaysLeft] = useState(0)

  useEffect(() => {
    calculateDaysLeft()
    fetchMembers()
  }, []) // Removed currentMonth from dependencies

  const calculateDaysLeft = () => {
    const today = new Date()
    const lastDay = new Date(today.getFullYear(), currentMonth, 0)
    const diff = lastDay.getDate() - today.getDate()
    setDaysLeft(diff)
  }

  const fetchMembers = async () => {
    try {
      const currentUser = auth().currentUser
      if (!currentUser) return

      const membersSnapshot = await firestore()
        .collection("challengeMembers")
        .where("month", "==", currentMonth)
        .where("year", "==", new Date().getFullYear())
        .get()

      const membersData: ChallengeMember[] = await Promise.all(
        membersSnapshot.docs.map(async (doc) => {
          const memberData = doc.data()
          const goalsSnapshot = await firestore().collection("goals").where("userId", "==", memberData.userId).get()

          const goals: Goal[] = goalsSnapshot.docs.map(
            (goalDoc) =>
              ({
                id: goalDoc.id,
                ...goalDoc.data(),
              }) as Goal,
          )

          const goalProgress = goals.map((goal) => (goal.progress / goal.weeklyGoal) * 100)
          const totalProgress = goalProgress.reduce((acc, progress) => acc + progress, 0) / goals.length

          return {
            id: doc.id,
            name: memberData.name,
            profileImage: memberData.profileImage,
            goals,
            totalProgress,
          }
        }),
      )

      // Ensure current user is in the list
      const currentUserDoc = await firestore().collection("users").doc(currentUser.uid).get()
      const currentUserData = currentUserDoc.data()

      if (!membersData.find((member) => member.id === currentUser.uid)) {
        const currentUserGoals = await firestore().collection("goals").where("userId", "==", currentUser.uid).get()

        const goals: Goal[] = currentUserGoals.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as Goal,
        )

        membersData.push({
          id: currentUser.uid,
          name: currentUserData?.nickname || "Unknown",
          profileImage: currentUserData?.profileImageUrl || "",
          goals,
          totalProgress:
            goals.reduce((acc, goal) => acc + (goal.progress / goal.weeklyGoal) * 100, 0) / Math.max(goals.length, 1),
        })
      }

      // Sort by progress and handle ties
      const sortedMembers = membersData.sort((a, b) => b.totalProgress - a.totalProgress)
      setMembers(sortedMembers)
    } catch (error) {
      console.error("Error fetching members:", error)
    }
  }

  const handleShareLink = async () => {
    try {
      const deepLink = await createChallengeDeepLink(currentMonth)
      Clipboard.setString(deepLink)
      Alert.alert("성공", "챌린지 초대 링크가 복사되었습니다.")
    } catch (error) {
      console.error("Error creating deep link:", error)
      Alert.alert("오류", "링크 생성 중 오류가 발생했습니다.")
    }
  }

  const handleJoinChallenge = async () => {
    try {
      const currentUser = auth().currentUser
      if (!currentUser) return

      const userDoc = await firestore().collection("users").doc(currentUser.uid).get()
      const userData = userDoc.data()

      await firestore()
        .collection("challengeMembers")
        .add({
          userId: currentUser.uid,
          name: userData?.nickname || "Unknown",
          profileImage: userData?.profileImageUrl || "",
          month: currentMonth,
          year: new Date().getFullYear(),
          joinedAt: firestore.FieldValue.serverTimestamp(),
        })

      setShowJoinModal(false)
      fetchMembers()
    } catch (error) {
      console.error("Error joining challenge:", error)
      Alert.alert("오류", "챌린지 참여 중 오류가 발생했습니다.")
    }
  }

  const currentUser = auth().currentUser

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.monthIndicator}>
            <Text
              style={[styles.monthNumber, styles.inactiveMonth]}
              onPress={() => setCurrentMonth((prev) => Math.max(1, Math.min(12, prev - 1)))}
            >
              {String(currentMonth === 1 ? 12 : currentMonth - 1).padStart(2, "0")}
            </Text>
            <View style={styles.currentMonthContainer}>
              <Text style={styles.activeMonth}>{String(currentMonth).padStart(2, "0")}</Text>
              <Image source={require("../assets/challenge.svg")} style={styles.challengeIcon} />
            </View>
            <Text
              style={[styles.monthNumber, styles.inactiveMonth]}
              onPress={() => setCurrentMonth((prev) => Math.max(1, Math.min(12, prev + 1)))}
            >
              {String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, "0")}
            </Text>
          </View>
          <Text style={styles.challengeTitle}>{currentMonth}월 챌린지</Text>
          <Text style={styles.daysLeft}>{daysLeft}일 남음</Text>
        </View>

        <View style={styles.rankingContainer}>
          {members.map((member, index) => {
            const rank =
              index > 0 && member.totalProgress === members[index - 1].totalProgress
                ? members[index - 1].rank || index
                : index + 1
            member.rank = rank

            const isCurrentUser = currentUser && member.id === currentUser.uid

            return (
              <View key={member.id} style={[styles.rankingItem, isCurrentUser && styles.currentUserItem]}>
                <View style={styles.rankInfo}>
                  <Text style={[styles.rankNumber, isCurrentUser && styles.currentUserRank]}>{rank}</Text>
                  <Image source={{ uri: member.profileImage }} style={styles.profileImage} />
                  <Text style={styles.participantName}>{member.name}</Text>
                </View>
                <View style={styles.goalsContainer}>
                  {/* <GoalIcons goals={member.goals} /> */}
                  <Text style={[styles.progressText, isCurrentUser && styles.currentUserProgress]}>
                    {Math.round(member.totalProgress)}%
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.linkButton} onPress={handleShareLink}>
        <Ionicons name="link-outline" size={24} color="#ffffff" />
        <Text style={styles.linkButtonText}>챌린지 초대 링크 복사</Text>
      </TouchableOpacity>

      <JoinChallengeModal
        isVisible={showJoinModal}
        members={members}
        onClose={() => setShowJoinModal(false)}
        onJoin={handleJoinChallenge}
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
  },
  header: {
    alignItems: "center",
    paddingVertical: 30,
  },
  monthIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  currentMonthContainer: {
    position: "relative",
    alignItems: "center",
    marginHorizontal: 40,
  },
  challengeIcon: {
    position: "absolute",
    bottom: -73,
    left: -10,
    width: 120,
    height: 146,
    resizeMode: "contain",
    tintColor: "#387aff",
    opacity: 0.6,
    zIndex: -1,
  },
  monthNumber: {
    fontSize: 48,
    fontWeight: "bold",
  },
  inactiveMonth: {
    color: "#dde7ff",
    fontSize: 36,
  },
  disabledMonth: {
    color: "#d9d9d9",
  },
  activeMonth: {
    color: "#387aff",
    fontSize: 48,
    fontWeight: "bold",
  },
  challengeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#000000",
  },
  daysLeft: {
    color: "#767676",
  },
  rankingContainer: {
    paddingVertical: 20,
  },
  rankingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
    backgroundColor: "#ffffff",
    padding: 15,
    borderRadius: 10,
  },
  currentUserItem: {
    backgroundColor: "#f5f5f5",
  },
  rankNumber: {
    fontSize: 24,
    fontWeight: "bold",
    width: 40,
    color: "#387aff",
  },
  currentUserRank: {
    color: "#387aff",
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  participantName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  goalsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    minWidth: 120,
  },
  progressText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#387aff",
    minWidth: 45,
    textAlign: "right",
  },
  currentUserProgress: {
    color: "#387aff",
  },
  linkButton: {
    backgroundColor: "#387aff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    margin: 20,
    borderRadius: 10,
  },
  linkButtonText: {
    color: "#ffffff",
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "bold",
  },
  rankInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
})

