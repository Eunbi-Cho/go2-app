"use client"

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
  const [userChallengeGroups, setUserChallengeGroups] = useState<string[]>([])
  const [groupsData, setGroupsData] = useState<{ [groupId: string]: { name: string; code: string } }>({})
  const [activeTab, setActiveTab] = useState<string | null | undefined>(undefined)

  const calculateTotalProgress = useCallback(
    (userGoals: Goal[], userId: string, year: number, month: number) => {
      if (userGoals.length === 0) {
        console.log(`User ${userId} has no goals for ${year}-${month}, returning 0%`)
        return 0
      }

      // 해당 월의 인증샷만 필터링
      const userCerts = certifications[userId] || []
      const monthCerts = userCerts.filter((cert) => {
        const certDate = cert.timestamp.toDate()
        const certMonth = certDate.getMonth() + 1
        const certYear = certDate.getFullYear()
        const isMatch = certYear === year && certMonth === month

        if (isMatch) {
          console.log(`Found certification for user ${userId} on ${certDate} matching ${year}-${month}`)
        }

        return isMatch
      })

      console.log(`User ${userId} has ${monthCerts.length} certifications for ${year}-${month}`)

      // 각 목표별 달성률 계산
      const goalProgressMap: { [goalId: string]: { count: number; weeklyGoal: number } } = {}

      // 각 목표의 주간 목표 정보 초기화
      userGoals.forEach((goal) => {
        goalProgressMap[goal.id] = { count: 0, weeklyGoal: goal.weeklyGoal }
      })

      // 해당 월의 인증샷으로 각 목표별 달성 횟수 계산
      monthCerts.forEach((cert) => {
        if (goalProgressMap[cert.goalId]) {
          goalProgressMap[cert.goalId].count += 1
        }
      })

      // 각 목표별 달성률 계산 및 합산
      let totalProgressPercentage = 0
      let goalCount = 0

      Object.entries(goalProgressMap).forEach(([goalId, { count, weeklyGoal }]) => {
        // 주간 목표가 0이면 계산에서 제외
        if (weeklyGoal > 0) {
          // 달성률은 최대 100%로 제한
          const progressPercentage = Math.min((count / weeklyGoal) * 100, 100)
          console.log(`Goal ${goalId} progress: ${count}/${weeklyGoal} = ${progressPercentage}%`)
          totalProgressPercentage += progressPercentage
          goalCount++
        }
      })

      // 목표가 없으면 0% 반환
      if (goalCount === 0) {
        return 0
      }

      // 평균 달성률 계산 및 반올림
      const result = Math.round(totalProgressPercentage / goalCount)
      console.log(`User ${userId}'s average progress for ${year}-${month}: ${result}%`)
      return result
    },
    [certifications],
  )

  const updateMemberProgressForMonth = useCallback(
    (year: number, month: number) => {
      console.log(`Updating member progress for ${year}-${month}`)

      // 이미 계산된 진행률이 있는지 확인하여 불필요한 업데이트 방지
      const historyKey = `${year}-${month}`
      if (historicalData[historyKey]) {
        console.log(`Using cached progress data for ${year}-${month}`)
        return
      }

      // 멤버 목록이 비어있으면 업데이트하지 않음
      if (currentMonthMembers.length === 0) {
        console.log("No members to update progress for")
        return
      }

      // 이전 상태를 기반으로 새 상태 계산
      const updatedMembers = currentMonthMembers.map((member) => {
        const memberGoals = goals[member.userId] || []
        console.log(`Calculating progress for member ${member.name} with ${memberGoals.length} goals`)
        const monthlyProgress = calculateTotalProgress(memberGoals, member.userId, year, month)
        console.log(`Member ${member.name}'s calculated progress: ${monthlyProgress}%`)

        return {
          ...member,
          totalProgress: monthlyProgress,
          goals: memberGoals,
        }
      })

      // 이전 상태와 새 상태가 다른 경우에만 업데이트
      const hasChanges = updatedMembers.some(
        (updatedMember, index) => updatedMember.totalProgress !== currentMonthMembers[index]?.totalProgress,
      )

      if (hasChanges) {
        setCurrentMonthMembers(updatedMembers)
      } else {
        console.log("No changes in member progress, skipping update")
      }
    },
    [calculateTotalProgress, goals, currentMonthMembers, historicalData],
  )

  const updateMemberProgress = useCallback(() => {
    console.log("Updating member progress for current month")
    const now = new Date()
    updateMemberProgressForMonth(now.getFullYear(), now.getMonth() + 1)
  }, [updateMemberProgressForMonth])

  const saveChallengeHistory = useCallback(
    async (yearToSave: number, monthToSave: number) => {
      if (!activeTab) return

      // 이미 저장된 히스토리가 있는지 확인
      const historyKey = `${yearToSave}-${monthToSave}`
      if (historicalData[historyKey]) {
        console.log(`History for ${yearToSave}-${monthToSave} already exists in cache, skipping save`)
        return
      }

      console.log(`Saving challenge history for ${yearToSave}-${monthToSave}`)

      try {
        // 해당 월의 멤버 진행률 계산
        const membersToSave = currentMonthMembers.map((member) => {
          const memberGoals = goals[member.userId] || []
          const monthlyProgress = calculateTotalProgress(memberGoals, member.userId, yearToSave, monthToSave)
          return {
            ...member,
            totalProgress: monthlyProgress,
          }
        })

        const sortedMembers = [...membersToSave].sort((a, b) => b.totalProgress - a.totalProgress)
        const rankedMembers = sortedMembers.map((member, index) => ({
          userId: member.userId,
          name: member.name,
          profileImage: member.profileImage,
          totalProgress: member.totalProgress,
          rank: index + 1,
        }))

        // 이미 저장된 히스토리가 있는지 확인
        const existingHistorySnapshot = await firestore()
          .collection("challengeHistory")
          .where("groupId", "==", activeTab)
          .where("year", "==", yearToSave)
          .where("month", "==", monthToSave)
          .get()

        let historyId = ""

        if (!existingHistorySnapshot.empty) {
          console.log(`History for ${yearToSave}-${monthToSave} already exists in Firestore, updating...`)
          historyId = existingHistorySnapshot.docs[0].id
          await firestore().collection("challengeHistory").doc(historyId).update({
            members: rankedMembers,
            completedAt: new Date(),
          })
        } else {
          console.log(`Creating new history for ${yearToSave}-${monthToSave}`)
          const historyData: Omit<ChallengeHistory, "id"> = {
            groupId: activeTab,
            year: yearToSave,
            month: monthToSave,
            members: rankedMembers,
            completedAt: new Date(),
          }

          const docRef = await firestore().collection("challengeHistory").add(historyData)
          historyId = docRef.id
        }

        // 히스토리 데이터 캐시 업데이트
        setHistoricalData((prevData) => ({
          ...prevData,
          [`${yearToSave}-${monthToSave}`]: {
            id: historyId,
            groupId: activeTab,
            year: yearToSave,
            month: monthToSave,
            members: rankedMembers,
            completedAt: new Date(),
          },
        }))

        console.log(`Challenge history for ${yearToSave}-${monthToSave} saved successfully`)
      } catch (error) {
        console.error(`Error saving challenge history for ${yearToSave}-${monthToSave}:`, error)
      }
    },
    [activeTab, currentMonthMembers, goals, calculateTotalProgress, historicalData],
  )

  const loadMonthData = useCallback(async () => {
    if (!activeTab) return

    console.log(`Loading data for ${currentYear}-${currentMonth}`)

    // 현재 월인지 확인
    const now = new Date()
    const isCurrentMonthYear = currentMonth === now.getMonth() + 1 && currentYear === now.getFullYear()

    if (isCurrentMonthYear) {
      // 현재 월은 실시간 데이터 사용
      updateMemberProgress()
    } else {
      // 과거 월은 히스토리 데이터 로드
      setIsLoadingHistory(true)
      try {
        // 이미 히스토리 데이터가 있는지 확인
        const historyKey = `${currentYear}-${currentMonth}`
        if (historicalData[historyKey]) {
          console.log(`Using cached history data for ${currentYear}-${currentMonth}`)
          // 이미 캐시된 데이터가 있으면 추가 로드 없이 사용
          setIsLoadingHistory(false)
          return
        }

        const historySnapshot = await firestore()
          .collection("challengeHistory")
          .where("groupId", "==", activeTab)
          .where("year", "==", currentYear)
          .where("month", "==", currentMonth)
          .get()

        if (!historySnapshot.empty) {
          const historyData = historySnapshot.docs[0].data() as ChallengeHistory
          setHistoricalData((prevData) => ({
            ...prevData,
            [`${currentYear}-${currentMonth}`]: historyData,
          }))
          console.log(`Loaded history data for ${currentYear}-${currentMonth}`)
        } else {
          console.log(`No history data found for ${currentYear}-${currentMonth}, calculating from certifications`)

          // 이전 달 인증샷 데이터 가져오기
          const startDate = new Date(currentYear, currentMonth - 1, 1)
          const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59)

          console.log(`Fetching certifications from ${startDate} to ${endDate}`)

          // 그룹의 모든 멤버 ID 가져오기
          const membersSnapshot = await firestore()
            .collection("users")
            .where("challengeGroupId", "array-contains", activeTab)
            .get()

          const memberIds = membersSnapshot.docs.map((doc) => doc.id)

          if (memberIds.length > 0) {
            // 해당 기간 동안의 모든 인증샷 가져오기
            const periodCertificationsSnapshot = await firestore()
              .collection("certifications")
              .where("userId", "in", memberIds)
              .where("timestamp", ">=", startDate)
              .where("timestamp", "<=", endDate)
              .get()

            console.log(`Found ${periodCertificationsSnapshot.size} certifications for ${currentYear}-${currentMonth}`)

            // 인증샷이 있으면 히스토리 데이터 생성
            if (periodCertificationsSnapshot.size > 0) {
              // 사용자별로 인증샷 정리
              const certsByUser: { [userId: string]: Certification[] } = {}
              periodCertificationsSnapshot.docs.forEach((doc) => {
                const cert = { id: doc.id, ...doc.data() } as Certification
                if (!certsByUser[cert.userId]) {
                  certsByUser[cert.userId] = []
                }
                certsByUser[cert.userId].push(cert)
              })

              // certifications 상태 업데이트
              setCertifications((prevCertifications) => {
                const newCertifications = { ...prevCertifications }
                Object.keys(certsByUser).forEach((userId) => {
                  newCertifications[userId] = [...(newCertifications[userId] || []), ...certsByUser[userId]]
                })
                return newCertifications
              })

              // 이제 업데이트된 인증샷으로 멤버 진행률 계산
              updateMemberProgressForMonth(currentYear, currentMonth)

              // 히스토리 데이터 저장 - 별도 함수로 분리하여 호출
              if (periodCertificationsSnapshot.size > 0) {
                // 비동기 작업이지만 결과를 기다리지 않음
                // 이 부분을 setTimeout으로 감싸서 현재 렌더링 사이클과 분리
                setTimeout(() => {
                  saveChallengeHistory(currentYear, currentMonth).catch(console.error)
                }, 0)
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching challenge history:", error)
      } finally {
        setIsLoadingHistory(false)
      }
    }
  }, [
    activeTab,
    currentYear,
    currentMonth,
    updateMemberProgress,
    updateMemberProgressForMonth,
    saveChallengeHistory,
    historicalData,
  ])

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

  const fetchGroupMembers = useCallback(
    async (groupId: string) => {
      if (!groupId) return

      try {
        // 그룹 멤버 가져오기 - challengeGroupId가 문자열인 경우
        const stringMembersSnapshot = await firestore()
          .collection("users")
          .where("challengeGroupId", "==", groupId)
          .get()

        // 그룹 멤버 가져오기 - challengeGroupId가 배열인 경우
        const arrayMembersSnapshot = await firestore()
          .collection("users")
          .where("challengeGroupId", "array-contains", groupId)
          .get()

        // 중복 제거를 위한 Set
        const memberIds = new Set<string>()
        const membersData: ChallengeMember[] = []

        // 문자열 타입 멤버 처리
        stringMembersSnapshot.docs.forEach((doc) => {
          if (!memberIds.has(doc.id)) {
            memberIds.add(doc.id)
            const memberData = doc.data()
            membersData.push({
              id: doc.id,
              userId: doc.id,
              name: memberData.nickname || "Unknown",
              profileImage: memberData.profileImageUrl || "",
              totalProgress: 0,
              goals: [],
            })
          }
        })

        // 배열 타입 멤버 처리
        arrayMembersSnapshot.docs.forEach((doc) => {
          if (!memberIds.has(doc.id)) {
            memberIds.add(doc.id)
            const memberData = doc.data()
            membersData.push({
              id: doc.id,
              userId: doc.id,
              name: memberData.nickname || "Unknown",
              profileImage: memberData.profileImageUrl || "",
              totalProgress: 0,
              goals: [],
            })
          }
        })

        // 현재 사용자가 멤버 목록에 없으면 추가
        const currentUserAuth = auth().currentUser
        if (currentUserAuth && !memberIds.has(currentUserAuth.uid)) {
          const currentUserDoc = await firestore().collection("users").doc(currentUserAuth.uid).get()
          if (currentUserDoc.exists) {
            const currentUserData = currentUserDoc.data()
            membersData.push({
              id: currentUserAuth.uid,
              userId: currentUserAuth.uid,
              name: currentUserData?.nickname || "Unknown",
              profileImage: currentUserData?.profileImageUrl || "",
              totalProgress: 0,
              goals: [],
            })
          }
        }

        console.log("Challenge group members:", membersData)
        setCurrentMonthMembers(membersData)

        // 각 멤버의 목표 가져오기
        membersData.forEach((member) => {
          fetchUserGoals(member.userId)
        })

        // 모든 멤버의 인증샷 가져오기 (전체 기간)
        const memberIdsArray = Array.from(memberIds)
        if (memberIdsArray.length > 0) {
          // 인증샷 데이터 가져오기 (전체 기간)
          const certificationsSnapshot = await firestore()
            .collection("certifications")
            .where("userId", "in", memberIdsArray)
            .get()

          console.log(`Fetched ${certificationsSnapshot.size} certifications for all members`)

          // 사용자별로 인증샷 정리
          const certsByUser: { [userId: string]: Certification[] } = {}
          certificationsSnapshot.docs.forEach((doc) => {
            const cert = { id: doc.id, ...doc.data() } as Certification
            if (!certsByUser[cert.userId]) {
              certsByUser[cert.userId] = []
            }
            certsByUser[cert.userId].push(cert)
          })

          setCertifications(certsByUser)
        }
      } catch (error) {
        console.error("Error fetching group members:", error)
        setCurrentMonthMembers([])
      }
    },
    [fetchUserGoals],
  )

  const fetchChallengeGroup = useCallback(async () => {
    const currentUserAuth = auth().currentUser
    if (!currentUserAuth) return

    console.log("Fetching challenge groups")
    try {
      const userDoc = await firestore().collection("users").doc(currentUserAuth.uid).get()
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

      setUserChallengeGroups(userGroups)

      // Set active tab to the first group or null if no groups
      // 사용자가 명시적으로 새 그룹 탭을 선택한 경우를 처리하기 위해 조건을 수정
      // 초기 로딩 시에만 첫 번째 그룹을 선택합니다 (activeTab이 undefined일 때)
      if (userGroups.length > 0 && activeTab === undefined) {
        setActiveTab(userGroups[0])
      } else if (userGroups.length === 0) {
        // 그룹이 없는 경우 새 그룹 탭으로 설정
        setActiveTab(null)
      }
      // 사용자가 명시적으로 탭을 선택한 경우 (activeTab이 null 또는 string) 그대로 유지

      // Set primary group for backward compatibility
      if (userGroups.length > 0) {
        setUserChallengeGroup(userGroups[0])

        // 그룹 정보 가져오기
        const groupDoc = await firestore().collection("challengeGroups").doc(userGroups[0]).get()
        if (groupDoc.exists) {
          const groupData = groupDoc.data()
          setChallengeCode(groupData?.code || null)
          setGroupName(groupData?.name || "")
          console.log("Challenge group data:", groupData)
        } else {
          console.log("Challenge group document does not exist")
        }
      } else {
        setUserChallengeGroup(null)
        setChallengeCode(null)
        setGroupName("")
      }

      // Fetch all groups data
      const groupsInfo: { [groupId: string]: { name: string; code: string } } = {}

      await Promise.all(
        userGroups.map(async (gId: string) => {
          const groupDoc = await firestore().collection("challengeGroups").doc(gId).get()
          if (groupDoc.exists) {
            const groupData = groupDoc.data()
            groupsInfo[gId] = {
              name: groupData?.name || "그룹",
              code: groupData?.code || "",
            }
          }
        }),
      )

      setGroupsData(groupsInfo)

      // If we have an active tab, fetch members for that group
      if (activeTab && userGroups.includes(activeTab)) {
        await fetchGroupMembers(activeTab)
      } else if (userGroups.length > 0) {
        await fetchGroupMembers(userGroups[0])
      } else {
        setCurrentMonthMembers([])
      }
    } catch (error) {
      console.error("Error fetching challenge groups:", error)
      setUserChallengeGroup(null)
      setChallengeCode(null)
      setGroupName("")
      setCurrentMonthMembers([])
    }
  }, [activeTab, fetchGroupMembers])

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

    // Get current user data
    const userDoc = await firestore().collection("users").doc(currentUser.uid).get()
    const userData = userDoc.data() || {}

    // 기존 challengeGroupId 필드 처리
    let currentGroupIds: string[] = []

    if (userData.challengeGroupId) {
      if (typeof userData.challengeGroupId === "string") {
        // 문자열인 경우 배열로 변환
        currentGroupIds = [userData.challengeGroupId]
      } else if (Array.isArray(userData.challengeGroupId)) {
        // 이미 배열인 경우 그대로 사용
        currentGroupIds = userData.challengeGroupId
      }
    }

    // 새 그룹 추가
    currentGroupIds.push(groupRef.id)

    // 사용자 문서 업데이트
    await firestore().collection("users").doc(currentUser.uid).update({
      challengeGroupId: currentGroupIds,
    })

    setChallengeCode(code)
    setGroupName(inputGroupName)
    setUserChallengeGroup(groupRef.id)
    setActiveTab(groupRef.id)

    // Update local state
    setUserChallengeGroups((prev) => [...prev, groupRef.id])
    setGroupsData((prev) => ({
      ...prev,
      [groupRef.id]: { name: inputGroupName, code },
    }))

    // 현재 사용자를 멤버 목록에 즉시 추가
    if (currentUser) {
      const currentUserDoc = await firestore().collection("users").doc(currentUser.uid).get()
      if (currentUserDoc.exists) {
        const currentUserData = currentUserDoc.data()
        const newMember: ChallengeMember = {
          id: currentUser.uid,
          userId: currentUser.uid,
          name: currentUserData?.nickname || "Unknown",
          profileImage: currentUserData?.profileImageUrl || "",
          totalProgress: 0,
          goals: [],
        }
        setCurrentMonthMembers([newMember])

        // 현재 사용자의 목표 가져오기
        fetchUserGoals(currentUser.uid)
      }
    }

    Clipboard.setString(code)
    Alert.alert("성공", "챌린지 그룹이 생성되었습니다. 코드가 클립보드에 복사되었습니다.")

    // Fetch the new group's data
    fetchChallengeGroup()
  }

  const joinChallengeGroup = async () => {
    const currentUser = auth().currentUser
    if (!currentUser) return

    try {
      const groupSnapshot = await firestore().collection("challengeGroups").where("code", "==", inputCode).get()

      if (groupSnapshot.empty) {
        Alert.alert("오류", "유효하지 않은 챌린지 그룹 코드입니다.")
        return
      }

      const groupDoc = groupSnapshot.docs[0]
      const groupId = groupDoc.id

      // Get current user data
      const userDoc = await firestore().collection("users").doc(currentUser.uid).get()
      const userData = userDoc.data() || {}

      // 기존 challengeGroupId 필드 처리
      let currentGroupIds: string[] = []

      if (userData.challengeGroupId) {
        if (typeof userData.challengeGroupId === "string") {
          // 문자열인 경우 배열로 변환
          currentGroupIds = [userData.challengeGroupId]
        } else if (Array.isArray(userData.challengeGroupId)) {
          // 이미 배열인 경우 그대로 사용
          currentGroupIds = userData.challengeGroupId
        }
      }

      // Check if user is already in this group
      if (currentGroupIds.includes(groupId)) {
        Alert.alert("알림", "이미 참여 중인 챌린지 그룹입니다.")
        return
      }

      // 새 그룹 추가
      currentGroupIds.push(groupId)

      // 사용자 문서 업데이트
      await firestore().collection("users").doc(currentUser.uid).update({
        challengeGroupId: currentGroupIds,
      })

      setUserChallengeGroup(groupId)
      setChallengeCode(inputCode)
      setGroupName(groupDoc.data().name || "")
      setInputCode("")
      setActiveTab(groupId)

      // Update local state
      setUserChallengeGroups((prev) => [...prev, groupId])
      setGroupsData((prev) => ({
        ...prev,
        [groupId]: {
          name: groupDoc.data().name || "",
          code: inputCode,
        },
      }))

      // 그룹 참여 후 즉시 멤버 데이터 가져오기
      await fetchGroupMembers(groupId)

      // 데이터 새로고침 알림
      Alert.alert("성공", "챌린지 그룹에 참여하였습니다.")
    } catch (error) {
      console.error("Error joining challenge group:", error)
      Alert.alert("오류", "챌린지 그룹 참여 중 문제가 발생했습니다.")
    }
  }

  const leaveChallengeGroup = async () => {
    const currentUser = auth().currentUser
    if (!currentUser || !activeTab) return

    Alert.alert("챌린지 그룹 나가기", "정말로 이 챌린지 그룹을 나가시겠습니까?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "나가기",
        onPress: async () => {
          try {
            // Get current user data
            const userDoc = await firestore().collection("users").doc(currentUser.uid).get()
            const userData = userDoc.data() || {}

            // 기존 challengeGroupId 필드 처리
            let currentGroupIds: string[] = []

            if (userData.challengeGroupId) {
              if (typeof userData.challengeGroupId === "string") {
                // 문자열인 경우 배열로 변환
                currentGroupIds = [userData.challengeGroupId]
              } else if (Array.isArray(userData.challengeGroupId)) {
                // 이미 배열인 경우 그대로 사용
                currentGroupIds = userData.challengeGroupId
              }
            }

            // 그룹 제거
            const updatedGroups = currentGroupIds.filter((id: string) => id !== activeTab)

            // 사용자 문서 업데이트
            await firestore().collection("users").doc(currentUser.uid).update({
              challengeGroupId: updatedGroups,
            })

            // Update local state
            setUserChallengeGroups((prev) => prev.filter((id: string) => id !== activeTab))

            // Set new active tab
            const remainingGroups = userChallengeGroups.filter((id: string) => id !== activeTab)
            if (remainingGroups.length > 0) {
              setActiveTab(remainingGroups[0])
            } else {
              setActiveTab(null)
              setUserChallengeGroup(null)
              setChallengeCode(null)
              setGroupName("")
              setMembers([])
              setGoals({})
              setCertifications({})
            }

            Alert.alert("성공", "챌린지 그룹에서 나갔습니다.")

            // Refresh data
            fetchChallengeGroup()
          } catch (error) {
            console.error("Error leaving challenge group:", error)
            Alert.alert("오류", "챌린지 그룹을 나가는 중 오류가 발생했습니다.")
          }
        },
        style: "destructive",
      },
    ])
  }

  const handleTabChange = async (groupId: string | null) => {
    console.log("Tab changed to:", groupId)

    // 명시적으로 상태 업데이트
    setActiveTab(groupId)

    // 새 그룹 탭으로 변경할 때 추가 처리
    if (groupId === null) {
      console.log("Switching to new group tab")
      // 그룹 관련 데이터 초기화
      setChallengeCode(null)
      setGroupName("")
      setCurrentMonthMembers([])
      // 약간의 지연 후 다시 activeTab 상태 확인
      setTimeout(() => {
        console.log("Checking activeTab after delay:", activeTab)
        if (activeTab !== null) {
          console.log("Forcing activeTab to null")
          setActiveTab(null)
        }
      }, 100)
      return
    }

    if (groupId) {
      // Fetch group data
      const groupDoc = await firestore().collection("challengeGroups").doc(groupId).get()
      if (groupDoc.exists) {
        const groupData = groupDoc.data()
        setChallengeCode(groupData?.code || null)
        setGroupName(groupData?.name || "")
      }

      // Fetch group members
      await fetchGroupMembers(groupId)
    }
  }

  useEffect(() => {
    calculateDaysLeft()
  }, [])

  useFocusEffect(
    useCallback(() => {
      let isMounted = true
      let didFetchData = false

      const checkPreviousMonth = async () => {
        if (didFetchData) return
        didFetchData = true

        // 현재 activeTab 상태 저장
        const currentActiveTab = activeTab

        await fetchChallengeGroup()

        // 사용자가 명시적으로 새 그룹 탭을 선택했다면 activeTab을 null로 복원
        if (currentActiveTab !== undefined) {
          setActiveTab(currentActiveTab)
        }

        // 현재 달과 이전 달의 히스토리 데이터 확인
        if (activeTab && isMounted) {
          const now = new Date()
          const currentMonthNum = now.getMonth() + 1
          const currentYearNum = now.getFullYear()

          // 이전 달 계산
          let prevMonth = currentMonthNum - 1
          let prevYear = currentYearNum
          if (prevMonth === 0) {
            prevMonth = 12
            prevYear--
          }

          // 이전 달의 히스토리 데이터 확인
          const snapshot = await firestore()
            .collection("challengeHistory")
            .where("groupId", "==", activeTab)
            .where("year", "==", prevYear)
            .where("month", "==", prevMonth)
            .get()

          if (snapshot.empty && isMounted) {
            console.log(
              `No history data found for previous month ${prevYear}-${prevMonth}, checking for certifications`,
            )

            // 이전 달의 인증샷 확인
            const startDate = new Date(prevYear, prevMonth - 1, 1)
            const endDate = new Date(prevYear, prevMonth, 0, 23, 59, 59)

            const certSnapshot = await firestore()
              .collection("certifications")
              .where("timestamp", ">=", startDate)
              .where("timestamp", "<=", endDate)
              .limit(1) // 하나만 확인하면 충분
              .get()

            if (!certSnapshot.empty && isMounted) {
              console.log(`Found certifications for ${prevYear}-${prevMonth}, need to save history data`)
              // 이전 달로 설정하고 데이터 로드 (이후 저장 로직이 실행됨)
              // 직접 상태 업데이트 대신 함수 호출
              if (currentYear !== prevYear || currentMonth !== prevMonth) {
                // 상태 업데이트를 setTimeout으로 감싸서 현재 렌더링 사이클과 분리
                setTimeout(() => {
                  if (isMounted) {
                    setCurrentYear(prevYear)
                    setCurrentMonth(prevMonth)
                  }
                }, 0)
              }
            }
          }
        }
      }

      checkPreviousMonth()

      return () => {
        isMounted = false
      }
    }, [fetchChallengeGroup, activeTab, currentMonth, currentYear]),
  )

  useEffect(() => {
    console.log("Current month/year:", currentMonth, currentYear)

    // 이미 로드된 데이터가 있는지 확인
    const historyKey = `${currentYear}-${currentMonth}`
    if (!historicalData[historyKey]) {
      loadMonthData()
    } else {
      console.log(`Using cached data for ${currentYear}-${currentMonth}`)
    }
  }, [currentMonth, currentYear, loadMonthData, historicalData])

  useEffect(() => {
    if (activeTab) {
      loadMonthData()
    }
  }, [activeTab, loadMonthData])

  const calculateDaysLeft = () => {
    const today = new Date()
    const lastDay = new Date(today.getFullYear(), currentMonth, 0)
    const diff = lastDay.getDate() - today.getDate()
    setDaysLeft(diff)
  }

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

    console.log(`Month changing to ${newMonth}-${targetYear}`)
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
                  {currentMonth === 1 ? 12 : currentMonth - 1}월
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
              <View style={styles.currentMonthContent}>
                <Text style={[styles.monthNumber, styles.activeMonth]}>{currentMonth}월</Text>
                {isCurrentMonth && <Text style={styles.daysLeftInMonth}>{daysLeft}일 남음</Text>}
              </View>
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
                  {currentMonth === 12 ? 1 : currentMonth + 1}월
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
            {/* New Group Tab */}
            <TouchableOpacity
              style={[styles.tabItem, activeTab === null && styles.activeTabItem]}
              onPress={() => handleTabChange(null)}
            >
              <Text style={[styles.tabText, activeTab === null && styles.activeTabText]}>+ 새 그룹</Text>
            </TouchableOpacity>

            {/* Group Tabs */}
            {userChallengeGroups.map((groupId) => (
              <TouchableOpacity
                key={groupId}
                style={[styles.tabItem, activeTab === groupId && styles.activeTabItem]}
                onPress={() => handleTabChange(groupId)}
              >
                <Text style={[styles.tabText, activeTab === groupId && styles.activeTabText]}>
                  {groupsData[groupId]?.name || "그룹"}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content based on active tab */}
        {activeTab === null ? (
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
                        <Text style={[styles.rankNumber, isCurrentUser && styles.currentUserRank]}>{member.rank}</Text>
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

      {activeTab && (isCurrentMonth || isPastMonth) && (
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => {
              const groupCode = groupsData[activeTab]?.code
              if (groupCode) {
                Clipboard.setString(groupCode)
                Alert.alert("성공", "챌린지 그룹 코드가 클립보드에 복사되었습니다.")
              }
            }}
          >
            <Text style={styles.copyButtonText}>{groupsData[activeTab]?.name || "그룹"} 초대 코드</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.leaveButton} onPress={leaveChallengeGroup}>
            <Text style={styles.leaveButtonText}>나가기</Text>
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
  currentMonthContent: {
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 24,
    fontFamily: "MungyeongGamhongApple",
  },
  futureMonth: {
    color: "#BEBEBE",
    fontSize: 24,
    fontFamily: "MungyeongGamhongApple",
  },
  activeMonth: {
    color: "#ffffff",
    fontSize: 36,
    fontFamily: "MungyeongGamhongApple",
  },
  daysLeftInMonth: {
    color: "#ffffff",
    fontSize: 16,
    marginTop: 8,
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
  tabContainer: {
    marginBottom: 15,
    position: "relative",
  },
  tabScrollContent: {
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  tabItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 10,
  },
  activeTabItem: {
    backgroundColor: "#dde7ff",
    borderRadius: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#767676",
  },
  activeTabText: {
    color: "#387aff",
    fontWeight: "bold",
  },
})

