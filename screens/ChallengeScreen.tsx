import type { ChallengeHistory } from "../types/challenge"
import type { Goal } from "../types/goal"
import type { Certification } from "../types/certification"
import type { User } from "../types/user"
import { useState, useEffect, useCallback } from "react"
import { View, Text, StyleSheet, Image as RNImage, TouchableOpacity, ScrollView, Alert, TextInput } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Clipboard from "@react-native-clipboard/clipboard"
import auth from "@react-native-firebase/auth"
import firestore from "@react-native-firebase/firestore"
import GoalIcons from "../components/GoalIcons"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import type { RootStackNavigationProp } from "../types/navigation"
import Svg, { Path } from "react-native-svg"

interface ChallengeMember {
  id: string
  userId: string
  name: string
  profileImage: string
  totalProgress: number
  goals: Goal[]
}

export default function ChallengeScreen() {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [members, setMembers] = useState<ChallengeMember[]>([])
  const [daysLeft, setDaysLeft] = useState(0)
  const [goals, setGoals] = useState<{ [userId: string]: Goal[] }>({})
  const [certifications, setCertifications] = useState<{ [userId: string]: Certification[] }>({})
  const [challengeCode, setChallengeCode] = useState<string | null>(null)
  const [inputCode, setInputCode] = useState("")
  const [userChallengeGroup, setUserChallengeGroup] = useState<string | null>(null)
  const [groupName, setGroupName] = useState("")
  const [inputGroupName, setInputGroupName] = useState("")
  const [challengeHistory, setChallengeHistory] = useState<ChallengeHistory | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [currentMonthMembers, setCurrentMonthMembers] = useState<ChallengeMember[]>([])
  const [historicalData, setHistoricalData] = useState<{ [key: string]: ChallengeHistory }>({})
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [users, setUsers] = useState<{ [userId: string]: User }>({})

  const calculateTotalProgress = useCallback((userGoals: Goal[]) => {
    if (userGoals.length === 0) {
      console.log("No goals found, returning 0%")
      return 0
    }

    const totalProgress = userGoals.reduce((sum, goal) => {
      const progressPercentage = (goal.progress / goal.weeklyGoal) * 100
      return sum + progressPercentage
    }, 0)

    const result = Math.round(totalProgress / userGoals.length)
    console.log("Final average progress:", result)
    return result
  }, [])

  const updateMemberProgress = useCallback(() => {
    console.log("Updating member progress")
    setCurrentMonthMembers((prevMembers) => {
      return prevMembers.map((member) => {
        const memberGoals = goals[member.userId] || []
        console.log(`Calculating progress for member ${member.name}`)
        const monthlyProgress = calculateTotalProgress(memberGoals)
        return {
          ...member,
          totalProgress: monthlyProgress,
          goals: memberGoals,
        }
      })
    })
  }, [calculateTotalProgress, goals])

  const fetchChallengeHistory = useCallback(async () => {
    if (!userChallengeGroup) return

    setIsLoadingHistory(true)
    try {
      const historySnapshot = await firestore()
        .collection("challengeHistory")
        .where("groupId", "==", userChallengeGroup)
        .where("year", "==", currentYear)
        .where("month", "==", currentMonth)
        .get()

      if (!historySnapshot.empty) {
        const historyData = historySnapshot.docs[0].data() as ChallengeHistory
        setHistoricalData((prevData) => ({
          ...prevData,
          [`${currentYear}-${currentMonth}`]: historyData,
        }))
      }
    } catch (error) {
      console.error("Error fetching challenge history:", error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [userChallengeGroup, currentYear, currentMonth])

  useEffect(() => {
    console.log("Current month/year:", currentMonth, currentYear)
    if (
      currentYear < new Date().getFullYear() ||
      (currentYear === new Date().getFullYear() && currentMonth < new Date().getMonth() + 1)
    ) {
      console.log("Fetching challenge history")
      fetchChallengeHistory()
    } else {
      console.log("Updating member progress")
      updateMemberProgress()
    }
  }, [currentMonth, currentYear, updateMemberProgress, fetchChallengeHistory])

  const fetchUserGoals = useCallback((userId: string) => {
    console.log(`Fetching goals for user: ${userId}`)
    return firestore()
      .collection("goals")
      .where("userId", "==", userId)
      .onSnapshot((snapshot) => {
        const userGoals = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Goal)
        console.log(`Goals for user ${userId}:`, userGoals)
        setGoals((prevGoals) => ({ ...prevGoals, [userId]: userGoals }))
      })
  }, [])

  const fetchUserCertifications = useCallback((userId: string) => {
    return firestore()
      .collection("certifications")
      .where("userId", "==", userId)
      .onSnapshot((snapshot) => {
        const userCertifications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Certification)
        setCertifications((prevCertifications) => ({ ...prevCertifications, [userId]: userCertifications }))
      })
  }, [])

  const fetchChallengeGroup = useCallback(async () => {
    const currentUserAuth = auth().currentUser
    if (!currentUserAuth) return

    console.log("Fetching challenge group")
    const userDoc = await firestore().collection("users").doc(currentUserAuth.uid).get()
    const userData = userDoc.data()
    const groupId = userData?.challengeGroupId

    if (groupId) {
      console.log(`User belongs to challenge group: ${groupId}`)
      setUserChallengeGroup(groupId)
      const groupDoc = await firestore().collection("challengeGroups").doc(groupId).get()
      const groupData = groupDoc.data()
      setChallengeCode(groupData?.code || null)
      setGroupName(groupData?.name || "")

      const membersSnapshot = await firestore().collection("users").where("challengeGroupId", "==", groupId).get()
      const membersData = membersSnapshot.docs.map((doc) => {
        const memberData = doc.data()
        return {
          id: doc.id,
          userId: doc.id,
          name: memberData.nickname || "Unknown",
          profileImage: memberData.profileImageUrl || "",
          totalProgress: 0,
          goals: [],
        }
      })

      console.log("Challenge group members:", membersData)
      setCurrentMonthMembers(membersData)

      membersData.forEach((member) => {
        fetchUserGoals(member.userId)
        fetchUserCertifications(member.userId)
      })
    } else {
      console.log("User does not belong to any challenge group")
    }
  }, [fetchUserGoals, fetchUserCertifications])

  useEffect(() => {
    calculateDaysLeft()
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchChallengeGroup()
    }, [fetchChallengeGroup]), // Added fetchChallengeGroup to dependencies
  )

  const calculateDaysLeft = () => {
    const today = new Date()
    const lastDay = new Date(today.getFullYear(), currentMonth, 0)
    const diff = lastDay.getDate() - today.getDate()
    setDaysLeft(diff)
  }

  const generateChallengeCode = async () => {
    const currentUser = auth().currentUser
    if (!currentUser) return

    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const groupRef = await firestore().collection("challengeGroups").add({
      code,
      name: inputGroupName,
      createdBy: currentUser.uid,
      createdAt: firestore.FieldValue.serverTimestamp(),
    })

    await firestore().collection("users").doc(currentUser.uid).update({
      challengeGroupId: groupRef.id,
    })

    setChallengeCode(code)
    setGroupName(inputGroupName)
    setUserChallengeGroup(groupRef.id)
    Clipboard.setString(code)
    Alert.alert("성공", "챌린지 그룹이 생성되었습니다. 코드가 클립보드에 복사되었습니다.")
  }

  const joinChallengeGroup = async () => {
    const currentUser = auth().currentUser
    if (!currentUser) return

    const groupSnapshot = await firestore().collection("challengeGroups").where("code", "==", inputCode).get()

    if (groupSnapshot.empty) {
      Alert.alert("오류", "유효하지 않은 챌린지 그룹 코드입니다.")
      return
    }

    const groupDoc = groupSnapshot.docs[0]
    await firestore().collection("users").doc(currentUser.uid).update({
      challengeGroupId: groupDoc.id,
    })

    setUserChallengeGroup(groupDoc.id)
    setChallengeCode(inputCode)
    setGroupName(groupDoc.data().name || "")
    setInputCode("")
    Alert.alert("성공", "챌린지 그룹에 참여하였습니다.")
    fetchChallengeGroup()
  }

  const leaveChallengeGroup = async () => {
    const currentUser = auth().currentUser
    if (!currentUser) return

    Alert.alert("챌린지 그룹 나가기", "정말로 이 챌린지 그룹을 나가시겠습니까?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "나가기",
        onPress: async () => {
          try {
            await firestore().collection("users").doc(currentUser.uid).update({
              challengeGroupId: null,
            })
            setUserChallengeGroup(null)
            setChallengeCode(null)
            setGroupName("")
            setMembers([])
            setGoals({})
            setCertifications({})
            Alert.alert("성공", "챌린지 그룹에서 나갔습니다.")
          } catch (error) {
            console.error("Error leaving challenge group:", error)
            Alert.alert("오류", "챌린지 그룹을 나가는 중 오류가 발생했습니다.")
          }
        },
        style: "destructive",
      },
    ])
  }

  const saveChallengeHistory = useCallback(async () => {
    if (!userChallengeGroup) return

    const sortedMembers = [...members].sort((a, b) => b.totalProgress - a.totalProgress)
    const rankedMembers = sortedMembers.map((member, index) => ({
      userId: member.userId,
      name: member.name,
      profileImage: member.profileImage,
      totalProgress: member.totalProgress,
      rank: index + 1,
    }))

    const historyData: Omit<ChallengeHistory, "id"> = {
      groupId: userChallengeGroup,
      year: currentYear,
      month: currentMonth,
      members: rankedMembers,
      completedAt: new Date(),
    }

    try {
      await firestore().collection("challengeHistory").add(historyData)
    } catch (error) {
      console.error("Error saving challenge history:", error)
    }
  }, [userChallengeGroup, currentYear, currentMonth, members])

  useEffect(() => {
    const now = new Date()
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    if (
      now.getDate() === lastDayOfMonth.getDate() &&
      now.getMonth() === lastDayOfMonth.getMonth() &&
      now.getFullYear() === lastDayOfMonth.getFullYear()
    ) {
      saveChallengeHistory()
    }
  }, [saveChallengeHistory])

  const currentUserAuth = auth().currentUser
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!currentUserAuth) return
      const currentUserDoc = await firestore().collection("users").doc(currentUserAuth.uid).get()
      if (currentUserDoc.exists) {
        const currentUserData = currentUserDoc.data()
        const currentUserProfile = {
          id: currentUserAuth.uid,
          ...currentUserData,
          profileImageUrl: currentUserData?.profileImageUrl || "",
        } as User
        setCurrentUser(currentUserProfile)
        setUsers((prevUsers) => ({ ...prevUsers, [currentUserAuth.uid]: currentUserProfile }))
      }
    }
    fetchCurrentUser()
  }, [currentUserAuth])

  const now = new Date()
  const currentMonthNum = now.getMonth() + 1
  const currentYearNum = now.getFullYear()
  const isCurrentMonth = currentMonth === currentMonthNum && currentYear === currentYearNum
  const isPastMonth = currentYear < currentYearNum || (currentYear === currentYearNum && currentMonth < currentMonthNum)
  const isFutureMonth = (nextMonth: number) => {
    const now = new Date()
    const currentMonthNum = now.getMonth() + 1
    const currentYearNum = now.getFullYear()

    let targetYear = currentYear
    if (nextMonth === 1 && currentMonth === 12) {
      targetYear += 1
    }

    return targetYear > currentYearNum || (targetYear === currentYearNum && nextMonth > currentMonthNum)
  }

  const handleMonthChange = (newMonth: number) => {
    const now = new Date()
    const currentMonthNum = now.getMonth() + 1
    const currentYearNum = now.getFullYear()

    let targetYear = currentYear
    if (newMonth === 12 && currentMonth === 1) {
      targetYear = currentYear - 1
    } else if (newMonth === 1 && currentMonth === 12) {
      targetYear = currentYear + 1
    }

    if (targetYear > currentYearNum || (targetYear === currentYearNum && newMonth > currentMonthNum)) {
      return
    }

    setCurrentMonth(newMonth)
    setCurrentYear(targetYear)
  }

  const displayMembers = isCurrentMonth
    ? currentMonthMembers
    : historicalData[`${currentYear}-${currentMonth}`]?.members || []
  const sortedMembers = isCurrentMonth
    ? [...displayMembers]
        .sort((a, b) => b.totalProgress - a.totalProgress)
        .map((member, index) => ({ ...member, rank: index + 1 }))
    : (displayMembers as (ChallengeMember & { rank: number })[])

  const navigation = useNavigation<RootStackNavigationProp>()

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.monthIndicator}>
            <View style={styles.monthContainer}>
              <Svg width={80} height={97} viewBox="0 0 120 146" style={[styles.challengeIcon, styles.smallIcon]}>
                <Path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M10 0C4.47715 0 0 4.47715 0 10V86V89C0 89.7003 0.0719915 90.3838 0.208978 91.0435C2.77044 121.82 28.5615 146 60 146C91.4385 146 117.23 121.82 119.791 91.0435C119.928 90.3838 120 89.7003 120 89V86V10C120 4.47715 115.523 0 110 0H10Z"
                  fill="#387aff"
                  fillOpacity={0.5}
                />
              </Svg>
              <TouchableOpacity
                onPress={() => handleMonthChange(currentMonth === 1 ? 12 : currentMonth - 1)}
                style={styles.monthButton}
              >
                <Text style={[styles.monthNumber, styles.pastMonth]}>
                  {String(currentMonth === 1 ? 12 : currentMonth - 1).padStart(2, "0")}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.currentMonthContainer}>
              <Svg width={120} height={146} viewBox="0 0 120 146" style={styles.challengeIcon}>
                <Path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M10 0C4.47715 0 0 4.47715 0 10V86V89C0 89.7003 0.0719915 90.3838 0.208978 91.0435C2.77044 121.82 28.5615 146 60 146C91.4385 146 117.23 121.82 119.791 91.0435C119.928 90.3838 120 89.7003 120 89V86V10C120 4.47715 115.523 0 110 0H10Z"
                  fill="#387aff"
                />
              </Svg>
              <Text style={[styles.monthNumber, styles.activeMonth]}>{String(currentMonth).padStart(2, "0")}</Text>
            </View>
            <View style={styles.monthContainer}>
              <Svg width={80} height={97} viewBox="0 0 120 146" style={[styles.challengeIcon, styles.smallIcon]}>
                <Path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M10 0C4.47715 0 0 4.47715 0 10V86V89C0 89.7003 0.0719915 90.3838 0.208978 91.0435C2.77044 121.82 28.5615 146 60 146C91.4385 146 117.23 121.82 119.791 91.0435C119.928 90.3838 120 89.7003 120 89V86V10C120 4.47715 115.523 0 110 0H10Z"
                  fill="#BEBEBE"
                  fillOpacity={0.5}
                />
              </Svg>
              <TouchableOpacity
                onPress={() => handleMonthChange(currentMonth === 12 ? 1 : currentMonth + 1)}
                style={styles.monthButton}
                disabled={isFutureMonth(currentMonth === 12 ? 1 : currentMonth + 1)}
              >
                <Text
                  style={[
                    styles.monthNumber,
                    isFutureMonth(currentMonth === 12 ? 1 : currentMonth + 1) ? styles.futureMonth : styles.pastMonth,
                  ]}
                >
                  {String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, "0")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.challengeTitle}>{currentMonth}월 챌린지</Text>
          {isCurrentMonth && <Text style={styles.daysLeft}>{daysLeft}일 남음</Text>}
        </View>

        {!userChallengeGroup ? (
          <View style={styles.joinContainer}>
            <View style={styles.inputButtonRow}>
              <TextInput
                style={[styles.input, styles.flexInput]}
                placeholder="챌린지 그룹 이름"
                value={inputGroupName}
                onChangeText={setInputGroupName}
              />
              <TouchableOpacity style={styles.generateButton} onPress={generateChallengeCode}>
                <Text style={styles.buttonText}>생성</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.orText}>또는</Text>
            <View style={styles.inputButtonRow}>
              <TextInput
                style={[styles.input, styles.flexInput]}
                placeholder="챌린지 그룹 코드 입력"
                value={inputCode}
                onChangeText={setInputCode}
              />
              <TouchableOpacity style={styles.joinButton} onPress={joinChallengeGroup}>
                <Text style={styles.buttonText}>참여</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {displayMembers.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>
                  {isCurrentMonth ? "아직 챌린지 참여자가 없어요" : "이 달은 챌린지가 없었어요"}
                </Text>
              </View>
            ) : (
              <View style={styles.rankingContainer}>
                {sortedMembers.map((member) => {
                  const isCurrentUser = currentUser && member.userId === currentUser?.id

                  return (
                    <TouchableOpacity
                      key={member.userId}
                      style={[styles.rankingItem, isCurrentUser && styles.currentUserItem]}
                      onPress={() => {
                        if (!isCurrentUser && !isPastMonth) {
                          navigation.navigate("FriendProfile", { userId: member.userId })
                        }
                      }}
                    >
                      <View style={styles.rankInfo}>
                        <Text style={[styles.rankNumber, isCurrentUser && styles.currentUserRank]}>
                          {"rank" in member && member.rank !== undefined ? member.rank : "-"}
                        </Text>
                        <RNImage
                          source={
                            member.profileImage
                              ? { uri: member.profileImage }
                              : require("../assets/default-profile-image.png")
                          }
                          style={styles.profileImage}
                          onError={() => {
                            console.log("Error loading image for member:", member.name)
                            setCurrentMonthMembers((prevMembers) =>
                              prevMembers.map((m) => (m.userId === member.userId ? { ...m, profileImage: "" } : m)),
                            )
                          }}
                        />
                        <Text style={styles.participantName}>{member.name}</Text>
                      </View>
                      <View style={styles.goalsContainer}>
                        {!isPastMonth && <GoalIcons goals={goals[member.userId] || []} size={30} lightColor />}
                        <Text style={[styles.progressText, isCurrentUser && styles.currentUserProgress]}>
                          {member.totalProgress}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {userChallengeGroup && (isCurrentMonth || isPastMonth) && (
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => {
              if (challengeCode) {
                Clipboard.setString(challengeCode)
                Alert.alert("성공", "챌린지 그룹 코드가 클립보드에 복사되었습니다.")
              }
            }}
          >
            <Text style={styles.copyButtonText}>{groupName} 코드 복사</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.leaveButton} onPress={leaveChallengeGroup}>
            <Text style={styles.leaveButtonText}>그룹 나가기</Text>
          </TouchableOpacity>
        </View>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 100,
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
  },
  monthContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 97,
  },
  currentMonthContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    width: 120,
    height: 146,
  },
  challengeIcon: {
    position: "absolute",
    zIndex: -1,
  },
  smallIcon: {
    opacity: 0.6,
  },
  monthButton: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  monthNumber: {
    fontSize: 36,
    fontWeight: "bold",
  },
  pastMonth: {
    color: "#ABC6FB",
    fontSize: 30,
    fontFamily: "MungyeongGamhongApple",
  },
  futureMonth: {
    color: "#BEBEBE",
    fontSize: 30,
    fontFamily: "MungyeongGamhongApple",
  },
  activeMonth: {
    color: "#ffffff",
    fontSize: 40,
    fontFamily: "MungyeongGamhongApple",
  },
  challengeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#000000",
    fontFamily: "MungyeongGamhongApple",
  },
  daysLeft: {
    color: "#767676",
    fontSize: 16,
    fontWeight: "medium",
    marginTop: 6,
  },
  joinContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  generateButton: {
    backgroundColor: "#387aff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  orText: {
    fontSize: 16,
    color: "#767676",
    marginVertical: 10,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: "#dde7ff",
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  joinButton: {
    backgroundColor: "#387aff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  inputButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  flexInput: {
    flex: 1,
    marginRight: 10,
  },
  groupInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 20,
  },
  groupName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#387aff",
  },
  rankingContainer: {
    paddingVertical: 10,
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
    maxWidth: 160,
  },
  progressText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#387aff",
    minWidth: 45,
    textAlign: "right",
    marginLeft: 10,
  },
  currentUserProgress: {
    color: "#387aff",
  },
  rankInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  bottomButtonContainer: {
    flexDirection: "row",
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    gap: 10,
  },
  copyButton: {
    flex: 1,
    backgroundColor: "#387aff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  copyButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  leaveButton: {
    backgroundColor: "#f8f8f8",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    width: 120,
    borderWidth: 1,
    borderColor: "#387aff",
  },
  leaveButtonText: {
    color: "#387aff",
    fontSize: 16,
    fontWeight: "bold",
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#767676",
    textAlign: "center",
  },
})

