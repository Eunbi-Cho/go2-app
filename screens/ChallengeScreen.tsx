"use client"

import type { ChallengeHistory } from "../types/challenge"
import type { Goal } from "../types/goal"
import type { Certification } from "../types/certification"
import type { User } from "../types/user"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
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

// Firestore Timestamp 타입 정의
interface FirestoreTimestamp {
  toDate: () => Date
  seconds: number
  nanoseconds: number
}

// 타입 가드 함수
function isFirestoreTimestamp(obj: any): obj is FirestoreTimestamp {
  return obj && typeof obj.toDate === "function"
}

export default function ChallengeScreen() {
  // 컴포넌트 상단에 추가
  const isCalculatingProgress = useRef(false)
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
  const [progressCalculated, setProgressCalculated] = useState<{ [key: string]: boolean }>({})
  const lastCalculationTime = useRef<{ [key: string]: number }>({})
  const calculationInProgress = useRef<{ [key: string]: boolean }>({})
  const [stableProgressData, setStableProgressData] = useState<{
    [key: string]: { members: any[]; timestamp: number }
  }>({})

  const calculateTotalProgress = useCallback(
    (userGoals: Goal[], userId: string, year: number, month: number) => {
      if (userGoals.length === 0) {
        console.log(`User ${userId} has no goals for ${year}-${month}, returning 0%`)
        return 0
      }

      // 해당 월의 인증샷만 필터링
      const userCerts = certifications[userId] || []
      const monthCerts = userCerts.filter((cert) => {
        if (!cert.timestamp) return false

        const certDate = isFirestoreTimestamp(cert.timestamp) ? cert.timestamp.toDate() : new Date(cert.timestamp)

        const certMonth = certDate.getMonth() + 1
        const certYear = certDate.getFullYear()
        return certYear === year && certMonth === month
      })

      console.log(`User ${userId} has ${monthCerts.length} certifications for ${year}-${month}`)

      // 해당 월의 주차 계산 (월요일 시작 기준)
      const getWeeksInMonth = (year: number, month: number) => {
        // 월의 첫날과 마지막날
        const firstDay = new Date(year, month - 1, 1)
        const lastDay = new Date(year, month, 0)

        const weeks = []
        // 첫 주의 시작일 (월요일 기준)
        const currentWeekStart = new Date(firstDay)
        // 첫날이 월요일이 아니면 이전 월요일로 조정
        const dayOfWeek = currentWeekStart.getDay() // 0: 일요일, 1: 월요일, ...
        if (dayOfWeek !== 1) {
          // 월요일이 아니면
          currentWeekStart.setDate(currentWeekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        }

        // 주차 계산
        while (currentWeekStart <= lastDay) {
          const weekEnd = new Date(currentWeekStart)
          weekEnd.setDate(weekEnd.getDate() + 6) // 일요일까지

          // 해당 월에 속하는 날짜만 고려
          const effectiveStart = new Date(Math.max(firstDay.getTime(), currentWeekStart.getTime()))
          const effectiveEnd = new Date(Math.min(lastDay.getTime(), weekEnd.getTime()))

          // 해당 월에 속하는 날짜가 있는 주차만 추가
          if (effectiveStart <= effectiveEnd) {
            weeks.push({
              start: effectiveStart,
              end: effectiveEnd,
            })
          }

          // 다음 주 월요일로 이동
          currentWeekStart.setDate(currentWeekStart.getDate() + 7)
        }

        return weeks
      }

      const weeks = getWeeksInMonth(year, month)
      console.log(`Found ${weeks.length} weeks in ${year}-${month}`)

      // 현재 날짜를 기준으로 미래 주차 필터링
      const today = new Date()
      const filteredWeeks = weeks.filter((week) => week.start <= today)
      console.log(`Using ${filteredWeeks.length} weeks up to current date for ${year}-${month}`)

      // 각 주차별 달성률 계산
      const weeklyProgressRates: number[] = []

      // 이후 코드에서 weeks 대신 filteredWeeks를 사용하도록 변경
      filteredWeeks.forEach((week, weekIndex) => {
        // 이 주차의 인증샷 필터링
        const weekCerts = monthCerts.filter((cert) => {
          if (!cert.timestamp) return false

          const certDate = isFirestoreTimestamp(cert.timestamp) ? cert.timestamp.toDate() : new Date(cert.timestamp)

          return certDate >= week.start && certDate <= week.end
        })

        console.log(
          `Week ${weekIndex + 1}: ${week.start.toDateString()} to ${week.end.toDateString()} has ${weekCerts.length} certifications`,
        )

        // 각 목표별 이 주차의 달성 횟수 계산
        const goalProgressMap: { [goalId: string]: { count: number; weeklyGoal: number } } = {}

        // 각 목표의 주간 목표 정보 초기화
        userGoals.forEach((goal) => {
          goalProgressMap[goal.id] = { count: 0, weeklyGoal: goal.weeklyGoal }
        })

        // 이 주차의 인증샷으로 각 목표별 달성 횟수 계산
        weekCerts.forEach((cert) => {
          if (goalProgressMap[cert.goalId]) {
            goalProgressMap[cert.goalId].count += 1
          }
        })

        // 이 주차의 각 목표별 달성률 계산 및 합산
        let weekTotalProgressPercentage = 0
        let weekGoalCount = 0

        Object.entries(goalProgressMap).forEach(([goalId, { count, weeklyGoal }]) => {
          // 주간 목표가 0이면 계산에서 제외
          if (weeklyGoal > 0) {
            // 달성률은 최대 100%로 제한
            const progressPercentage = Math.min((count / weeklyGoal) * 100, 100)
            console.log(
              `Week ${weekIndex + 1}, Goal ${goalId} progress: ${count}/${weeklyGoal} = ${progressPercentage}%`,
            )
            weekTotalProgressPercentage += progressPercentage
            weekGoalCount++
          }
        })

        // 이 주차의 평균 달성률 계산
        if (weekGoalCount > 0) {
          const weekAvgProgress = weekTotalProgressPercentage / weekGoalCount
          weeklyProgressRates.push(weekAvgProgress)
          console.log(`Week ${weekIndex + 1} average progress: ${weekAvgProgress}%`)
        }
      })

      // 모든 주차의 평균 달성률 계산
      if (weeklyProgressRates.length === 0) {
        return 0
      }

      const monthlyAvgProgress = weeklyProgressRates.reduce((sum, rate) => sum + rate, 0) / weeklyProgressRates.length
      const result = Math.round(monthlyAvgProgress)
      console.log(
        `User ${userId}'s monthly average progress for ${year}-${month}: ${result}% (from ${weeklyProgressRates.length} weeks)`,
      )
      return result
    },
    [certifications],
  )

  const updateMemberProgressForMonth = useCallback(
    (year: number, month: number) => {
      console.log(`Updating member progress for ${year}-${month}`)

      // 이미 계산된 진행률이 있는지 확인하여 불필요한 업데이트 방지
      if (!activeTab) return

      const historyKey = `${activeTab}-${year}-${month}`
      if (historicalData[historyKey]) {
        console.log(`Using cached progress data for ${historyKey}`)
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
    [activeTab, calculateTotalProgress, goals, currentMonthMembers, historicalData],
  )

  const updateMemberProgress = useCallback(() => {
    console.log("Updating member progress for current month")

    if (!activeTab) return

    const now = new Date()
    const historyKey = `${activeTab}-${now.getFullYear()}-${now.getMonth() + 1}`

    // 이미 계산 중인지 확인
    if (calculationInProgress.current[historyKey]) {
      console.log("Progress calculation already in progress, skipping")
      return
    }

    // 최근에 계산했는지 확인 (1분 이내)
    const lastCalcTime = lastCalculationTime.current[historyKey] || 0
    const oneMinuteAgo = Date.now() - 60 * 1000

    if (lastCalcTime > oneMinuteAgo) {
      console.log(`Data was calculated recently (${new Date(lastCalcTime).toLocaleTimeString()}), skipping`)
      return
    }

    calculationInProgress.current[historyKey] = true

    try {
      // 멤버 목록이 비어있으면 업데이트하지 않음
      if (currentMonthMembers.length === 0) {
        console.log("No members to update progress for")
        return
      }

      // 이전 상태를 기반으로 새 상태 계산
      const updatedMembers = currentMonthMembers.map((member) => {
        const memberGoals = goals[member.userId] || []
        console.log(`Calculating progress for member ${member.name} with ${memberGoals.length} goals`)
        const monthlyProgress = calculateTotalProgress(
          memberGoals,
          member.userId,
          now.getFullYear(),
          now.getMonth() + 1,
        )
        console.log(`Member ${member.name}'s calculated progress: ${monthlyProgress}%`)

        return {
          ...member,
          totalProgress: monthlyProgress,
          goals: memberGoals,
        }
      })

      // 정렬된 멤버 데이터 생성
      const sortedMembers = [...updatedMembers].sort((a, b) => b.totalProgress - a.totalProgress)
      const rankedMembers = sortedMembers.map((member, index) => ({
        userId: member.userId,
        name: member.name,
        profileImage: member.profileImage,
        totalProgress: member.totalProgress,
        rank: index + 1,
      }))

      // 안정적인 상태로 한 번에 업데이트
      setStableProgressData((prev) => ({
        ...prev,
        [historyKey]: {
          members: rankedMembers,
          timestamp: Date.now(),
        },
      }))

      // 현재 월 데이터 캐싱
      if (activeTab) {
        // activeTab이 null이나 undefined가 아닌 경우에만 실행
        setHistoricalData((prevData) => ({
          ...prevData,
          [historyKey]: {
            id: historyKey,
            groupId: activeTab,
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            members: rankedMembers,
            completedAt: new Date(),
          },
        }))
      }

      // 계산 완료 표시
      setProgressCalculated((prev) => ({
        ...prev,
        [historyKey]: true,
      }))

      // 계산 시간 기록
      lastCalculationTime.current[historyKey] = Date.now()
    } finally {
      // 계산 완료 후 플래그 초기화
      setTimeout(() => {
        calculationInProgress.current[historyKey] = false
      }, 500)
    }
  }, [activeTab, calculateTotalProgress, goals, currentMonthMembers])

  const saveChallengeHistory = useCallback(
    async (yearToSave: number, monthToSave: number) => {
      if (!activeTab) return

      // 이미 저장된 히스토리가 있는지 확인
      const historyKey = `${activeTab}-${yearToSave}-${monthToSave}`
      if (historicalData[historyKey]) {
        console.log(`History for ${historyKey} already exists in cache, skipping save`)
        return
      }

      console.log(`Saving challenge history for ${historyKey}`)

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
          console.log(`History for ${historyKey} already exists in Firestore, updating...`)
          historyId = existingHistorySnapshot.docs[0].id
          await firestore().collection("challengeHistory").doc(historyId).update({
            members: rankedMembers,
            completedAt: new Date(),
          })
        } else {
          console.log(`Creating new history for ${historyKey}`)
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
        if (activeTab) {
          setHistoricalData((prevData) => ({
            ...prevData,
            [historyKey]: {
              id: historyId,
              groupId: activeTab,
              year: yearToSave,
              month: monthToSave,
              members: rankedMembers,
              completedAt: new Date(),
            },
          }))
        }

        console.log(`Challenge history for ${historyKey} saved successfully`)
      } catch (error) {
        console.error(`Error saving challenge history for ${historyKey}:`, error)
      }
    },
    [activeTab, currentMonthMembers, goals, calculateTotalProgress, historicalData],
  )

  const loadMonthData = useCallback(async () => {
    if (!activeTab) return
    const historyKey = `${activeTab}-${currentYear}-${currentMonth}`

    // 이미 안정적인 데이터가 있는지 확인
    if (stableProgressData[historyKey] && stableProgressData[historyKey].timestamp > Date.now() - 5 * 60 * 1000) {
      console.log(`Using stable progress data for ${historyKey}`)
      return
    }

    console.log(`Loading data for ${currentYear}-${currentMonth} for group ${activeTab}`)

    // 히스토리 키 생성 - 그룹 ID를 포함하여 그룹별로 캐시
    // const historyKey = `${activeTab}-${currentYear}-${currentMonth}`

    // 계산이 이미 진행 중인지 확인
    if (calculationInProgress.current[historyKey]) {
      console.log(`Calculation already in progress for ${historyKey}, skipping`)
      return
    }

    // 현재 월인지 확인
    const now = new Date()
    const isCurrentMonthYear = currentMonth === now.getMonth() + 1 && currentYear === now.getFullYear()

    // 이미 캐시된 데이터가 있는지 확인
    if (historicalData[historyKey]) {
      console.log(`Using cached history data for ${historyKey}`)

      // 과거 월 데이터는 무조건 캐시 사용
      if (!isCurrentMonthYear) {
        return
      }

      // 현재 월이라도 최근 1분 내에 계산된 데이터가 있으면 사용
      const lastCalcTime = lastCalculationTime.current[historyKey] || 0
      const oneMinuteAgo = Date.now() - 60 * 1000

      if (lastCalcTime > oneMinuteAgo) {
        console.log(`Data was calculated recently (${new Date(lastCalcTime).toLocaleTimeString()}), skipping`)
        return
      }
    }

    // 계산 시작을 표시
    calculationInProgress.current[historyKey] = true

    try {
      // 현재 월인지 확인
      const now = new Date()
      const isCurrentMonthYear = currentMonth === now.getMonth() + 1 && currentYear === now.getFullYear()

      // 히스토리 키 생성 - 그룹 ID를 포함하여 그룹별로 캐시
      // const historyKey = `${activeTab}-${currentYear}-${currentMonth}`

      // 이미 캐시된 데이터가 있는지 확인
      if (historicalData[historyKey]) {
        console.log(`Using cached history data for ${historyKey}`)

        // 과거 월 데이터인 경우 캐시된 데이터 사용
        if (!isCurrentMonthYear) {
          return
        }

        // 현재 월이라도 최근에 계산된 데이터가 있으면 사용
        const cachedTime = historicalData[historyKey].completedAt
        let cachedDate: Date

        if (isFirestoreTimestamp(cachedTime)) {
          cachedDate = cachedTime.toDate()
        } else if (cachedTime instanceof Date) {
          cachedDate = cachedTime
        } else {
          cachedDate = new Date(0)
        }

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

        if (cachedDate > fiveMinutesAgo) {
          console.log("Using recent cached data for current month")
          return
        }
      }

      if (isCurrentMonthYear) {
        // 현재 월은 실시간 데이터 사용
        if (isCalculatingProgress.current) {
          console.log("Progress calculation already in progress, skipping")
          return
        }

        isCalculatingProgress.current = true

        try {
          // 현재 멤버 목록이 비어있으면 업데이트하지 않음
          if (currentMonthMembers.length === 0) {
            console.log("No members to update progress for")
            return
          }

          // 이전 상태를 기반으로 새 상태 계산
          const updatedMembers = currentMonthMembers.map((member) => {
            const memberGoals = goals[member.userId] || []
            console.log(`Calculating progress for member ${member.name} with ${memberGoals.length} goals`)
            const monthlyProgress = calculateTotalProgress(memberGoals, member.userId, currentYear, currentMonth)
            console.log(`Member ${member.name}'s calculated progress: ${monthlyProgress}%`)

            return {
              ...member,
              totalProgress: monthlyProgress,
              goals: memberGoals,
            }
          })

          // 상태 업데이트
          setCurrentMonthMembers(updatedMembers)

          // 현재 월 데이터 캐싱
          const sortedMembers = [...updatedMembers].sort((a, b) => b.totalProgress - a.totalProgress)
          const rankedMembers = sortedMembers.map((member, index) => ({
            userId: member.userId,
            name: member.name,
            profileImage: member.profileImage,
            totalProgress: member.totalProgress,
            rank: index + 1,
          }))

          // 히스토리 데이터 캐시 업데이트
          if (activeTab) {
            setHistoricalData((prevData) => ({
              ...prevData,
              [historyKey]: {
                id: historyKey,
                groupId: activeTab,
                year: currentYear,
                month: currentMonth,
                members: rankedMembers,
                completedAt: new Date(),
              },
            }))
          }

          // 계산 완료 표시
          setProgressCalculated((prev) => ({
            ...prev,
            [historyKey]: true,
          }))
        } finally {
          // 계산 완료 후 플래그 초기화
          setTimeout(() => {
            isCalculatingProgress.current = false
          }, 500)
        }
      } else {
        // 과거 월은 히스토리 데이터 로드
        setIsLoadingHistory(true)
        try {
          const historySnapshot = await firestore()
            .collection("challengeHistory")
            .where("groupId", "==", activeTab)
            .where("year", "==", currentYear)
            .where("month", "==", currentMonth)
            .get()

          if (!historySnapshot.empty) {
            const historyDoc = historySnapshot.docs[0]
            const historyData = {
              id: historyDoc.id,
              ...historyDoc.data(),
            } as ChallengeHistory

            setHistoricalData((prevData) => ({
              ...prevData,
              [historyKey]: historyData,
            }))
            console.log(`Loaded history data for ${historyKey}`)
          } else {
            console.log(`No history data found for ${historyKey}, calculating from certifications`)

            // 이전 달 인증샷 데이터 가져오기
            const startDate = new Date(currentYear, currentMonth - 1, 1)
            const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59)

            console.log(`Fetching certifications from ${startDate} to ${endDate}`)

            // 그룹의 모든 멤버 ID 가져오기
            const membersSnapshot = await firestore()
              .collection("users")
              .where("challengeGroupId", "array-contains", activeTab)
              .get()

            const stringMembersSnapshot = await firestore()
              .collection("users")
              .where("challengeGroupId", "==", activeTab)
              .get()

            // 중복 제거를 위한 Set
            const memberIds = new Set<string>()

            membersSnapshot.docs.forEach((doc) => memberIds.add(doc.id))
            stringMembersSnapshot.docs.forEach((doc) => memberIds.add(doc.id))

            const memberIdsArray = Array.from(memberIds)

            if (memberIdsArray.length > 0) {
              // 해당 기간 동안의 모든 인증샷 가져오기
              const certsByUser: { [userId: string]: Certification[] } = {}

              // 멤버가 10명 이상이면 배치 처리
              for (let i = 0; i < memberIdsArray.length; i += 10) {
                const batchMemberIds = memberIdsArray.slice(i, Math.min(i + 10, memberIdsArray.length))
                const periodCertificationsSnapshot = await firestore()
                  .collection("certifications")
                  .where("userId", "in", batchMemberIds)
                  .where("timestamp", ">=", startDate)
                  .where("timestamp", "<=", endDate)
                  .get()

                periodCertificationsSnapshot.docs.forEach((doc) => {
                  const cert = { id: doc.id, ...doc.data() } as Certification
                  if (!certsByUser[cert.userId]) {
                    certsByUser[cert.userId] = []
                  }
                  certsByUser[cert.userId].push(cert)
                })
              }

              // certifications 상태 업데이트
              setCertifications((prevCertifications) => {
                const newCertifications = { ...prevCertifications }
                Object.keys(certsByUser).forEach((userId) => {
                  newCertifications[userId] = [...(newCertifications[userId] || []), ...certsByUser[userId]]
                })
                return newCertifications
              })

              // 멤버 데이터 가져오기
              const membersData: ChallengeMember[] = []

              for (const userId of memberIdsArray) {
                const userDoc = await firestore().collection("users").doc(userId).get()
                if (userDoc.exists) {
                  const userData = userDoc.data()
                  membersData.push({
                    id: userId,
                    userId: userId,
                    name: userData?.nickname || "Unknown",
                    profileImage: userData?.profileImageUrl || "",
                    totalProgress: 0,
                    goals: [],
                  })
                }
              }

              // 각 멤버의 목표 가져오기
              const goalsData: { [userId: string]: Goal[] } = {}

              for (let i = 0; i < memberIdsArray.length; i += 10) {
                const batchMemberIds = memberIdsArray.slice(i, Math.min(i + 10, memberIdsArray.length))
                const goalsSnapshot = await firestore().collection("goals").where("userId", "in", batchMemberIds).get()

                goalsSnapshot.docs.forEach((doc) => {
                  const goal = { id: doc.id, ...doc.data() } as Goal
                  if (!goalsData[goal.userId]) {
                    goalsData[goal.userId] = []
                  }
                  goalsData[goal.userId].push(goal)
                })
              }

              // 목표 데이터 설정
              setGoals((prevGoals) => ({ ...prevGoals, ...goalsData }))

              // 각 멤버의 달성률 계산
              const membersWithProgress = membersData.map((member) => {
                const memberGoals = goalsData[member.userId] || []
                const monthlyProgress = calculateTotalProgress(memberGoals, member.userId, currentYear, currentMonth)
                return {
                  ...member,
                  totalProgress: monthlyProgress,
                  goals: memberGoals,
                }
              })

              // 멤버 정렬 및 랭킹 부여
              const sortedMembers = [...membersWithProgress].sort((a, b) => b.totalProgress - a.totalProgress)
              const rankedMembers = sortedMembers.map((member, index) => ({
                userId: member.userId,
                name: member.name,
                profileImage: member.profileImage,
                totalProgress: member.totalProgress,
                rank: index + 1,
              }))

              // 히스토리 데이터 캐시 업데이트
              if (activeTab) {
                setHistoricalData((prevData) => ({
                  ...prevData,
                  [historyKey]: {
                    id: "calculated",
                    groupId: activeTab,
                    year: currentYear,
                    month: currentMonth,
                    members: rankedMembers,
                    completedAt: new Date(),
                  },
                }))
              }

              // 계산 완료 표시
              setProgressCalculated((prev) => ({
                ...prev,
                [historyKey]: true,
              }))

              // 히스토리 데이터 저장
              try {
                const historyData: Omit<ChallengeHistory, "id"> = {
                  groupId: activeTab,
                  year: currentYear,
                  month: currentMonth,
                  members: rankedMembers,
                  completedAt: new Date(),
                }

                const docRef = await firestore().collection("challengeHistory").add(historyData)

                // 저장된 히스토리 ID로 캐시 업데이트
                setHistoricalData((prevData) => ({
                  ...prevData,
                  [historyKey]: {
                    ...prevData[historyKey],
                    id: docRef.id,
                  },
                }))
              } catch (error) {
                console.error("Error saving challenge history:", error)
              }
            } else {
              // 멤버가 없는 경우 빈 히스토리 데이터 생성
              if (activeTab) {
                setHistoricalData((prevData) => ({
                  ...prevData,
                  [historyKey]: {
                    id: "empty",
                    groupId: activeTab,
                    year: currentYear,
                    month: currentMonth,
                    members: [],
                    completedAt: new Date(),
                  },
                }))
              }
            }
          }
        } catch (error) {
          console.error("Error fetching challenge history:", error)
        } finally {
          setIsLoadingHistory(false)
        }
      }

      // 현재 월 데이터 캐싱 후에 시간 기록
      lastCalculationTime.current[historyKey] = Date.now()
    } finally {
      // 계산 완료 후 플래그 초기화
      setTimeout(() => {
        calculationInProgress.current[historyKey] = false
      }, 500)
    }
  }, [
    activeTab,
    currentYear,
    currentMonth,
    calculateTotalProgress,
    goals,
    currentMonthMembers,
    historicalData,
    stableProgressData,
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
        console.log("Fetching members for group:", groupId)

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
            memberIds.add(currentUserAuth.uid)
          }
        }

        console.log("Challenge group members:", membersData.length)
        setCurrentMonthMembers(membersData)

        // 각 멤버의 목표 가져오기
        const memberIdsArray = Array.from(memberIds)
        const goalsData: { [userId: string]: Goal[] } = {}

        // 멤버가 10명 이상이면 배치 처리
        for (let i = 0; i < memberIdsArray.length; i += 10) {
          const batchMemberIds = memberIdsArray.slice(i, Math.min(i + 10, memberIdsArray.length))
          const goalsSnapshot = await firestore().collection("goals").where("userId", "in", batchMemberIds).get()

          goalsSnapshot.docs.forEach((doc) => {
            const goal = { id: doc.id, ...doc.data() } as Goal
            if (!goalsData[goal.userId]) {
              goalsData[goal.userId] = []
            }
            goalsData[goal.userId].push(goal)
          })
        }

        // 목표 데이터 설정
        setGoals(goalsData)

        // 모든 멤버의 인증샷 가져오기 (전체 기간)
        if (memberIdsArray.length > 0) {
          // 인증샷 데이터 가져오기 (전체 기간)
          const certsByUser: { [userId: string]: Certification[] } = {}

          // 멤버가 10명 이상이면 배치 처리
          for (let i = 0; i < memberIdsArray.length; i += 10) {
            const batchMemberIds = memberIdsArray.slice(i, Math.min(i + 10, memberIdsArray.length))
            const certificationsSnapshot = await firestore()
              .collection("certifications")
              .where("userId", "in", batchMemberIds)
              .get()

            certificationsSnapshot.docs.forEach((doc) => {
              const cert = { id: doc.id, ...doc.data() } as Certification
              if (!certsByUser[cert.userId]) {
                certsByUser[cert.userId] = []
              }
              certsByUser[cert.userId].push(cert)
            })
          }

          setCertifications(certsByUser)

          // 멤버 진행률 즉시 계산
          const now = new Date()
          const historyKey = `${activeTab}-${now.getFullYear()}-${now.getMonth() + 1}`

          // 이미 안정적인 데이터가 있는지 확인
          if (stableProgressData[historyKey] && stableProgressData[historyKey].timestamp > Date.now() - 5 * 60 * 1000) {
            console.log(`Using existing stable data for ${historyKey}`)
            return
          }

          const updatedMembers = membersData.map((member) => {
            const memberGoals = goalsData[member.userId] || []
            const monthlyProgress = calculateTotalProgress(
              memberGoals,
              member.userId,
              now.getFullYear(),
              now.getMonth() + 1,
            )
            return {
              ...member,
              totalProgress: monthlyProgress,
              goals: memberGoals,
            }
          })

          // 상태 업데이트
          setCurrentMonthMembers(updatedMembers)

          // 정렬된 멤버 데이터 생성
          const sortedMembers = [...updatedMembers].sort((a, b) => b.totalProgress - a.totalProgress)
          const rankedMembers = sortedMembers.map((member, index) => ({
            userId: member.userId,
            name: member.name,
            profileImage: member.profileImage,
            totalProgress: member.totalProgress,
            rank: index + 1,
          }))

          // 안정적인 상태로 한 번에 업데이트
          setStableProgressData((prev) => ({
            ...prev,
            [historyKey]: {
              members: rankedMembers,
              timestamp: Date.now(),
            },
          }))

          // 히스토리 데이터 캐시 업데이트
          if (activeTab) {
            setHistoricalData((prevData) => ({
              ...prevData,
              [historyKey]: {
                id: historyKey,
                groupId: activeTab,
                year: now.getFullYear(),
                month: now.getMonth() + 1,
                members: rankedMembers,
                completedAt: new Date(),
              },
            }))
          }

          // 계산 완료 표시
          setProgressCalculated((prev) => ({
            ...prev,
            [historyKey]: true,
          }))
        }
      } catch (error) {
        console.error("Error fetching group members:", error)
        setCurrentMonthMembers([])
      }
    },
    [calculateTotalProgress, activeTab, stableProgressData],
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

    try {
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

      // 상태 업데이트
      setChallengeCode(code)
      setGroupName(inputGroupName)
      setUserChallengeGroup(groupRef.id)
      setActiveTab(groupRef.id)
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

          // 멤버 목록 업데이트
          setCurrentMonthMembers([newMember])

          // 현재 사용자의 목표 가져오기
          const goalsSnapshot = await firestore().collection("goals").where("userId", "==", currentUser.uid).get()

          const userGoals = goalsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Goal)
          setGoals((prevGoals) => ({ ...prevGoals, [currentUser.uid]: userGoals }))
        }
      }

      Clipboard.setString(code)
      Alert.alert("성공", "챌린지 그룹이 생성되었습니다. 코드가 클립보드에 복사되었습니다.")

      // 데이터 새로고침
      setTimeout(() => {
        fetchGroupMembers(groupRef.id)
      }, 500)
    } catch (error) {
      console.error("Error creating challenge group:", error)
      Alert.alert("오류", "챌린지 그룹 생성 중 문제가 발생했습니다.")
    }
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

      // 상태 업데이트
      setUserChallengeGroup(groupId)
      setChallengeCode(inputCode)
      setGroupName(groupDoc.data().name || "")
      setInputCode("")
      setActiveTab(groupId)
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

      // 추가 데이터 로드 - 현재 월 데이터 로드
      setTimeout(() => {
        loadMonthData()
      }, 500)
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
      return
    }

    if (groupId) {
      try {
        // Fetch group data
        const groupDoc = await firestore().collection("challengeGroups").doc(groupId).get()
        if (groupDoc.exists) {
          const groupData = groupDoc.data()
          setChallengeCode(groupData?.code || null)
          setGroupName(groupData?.name || "")
        }

        // Fetch group members
        await fetchGroupMembers(groupId)

        // 현재 월 데이터 로드 - 월 변경 없이 선택된 그룹의 데이터만 로드
        await loadMonthData()
      } catch (error) {
        console.error("Error loading group data:", error)
      }
    }
  }

  useEffect(() => {
    calculateDaysLeft()
  }, [])

  useFocusEffect(
    useCallback(() => {
      let isMounted = true

      const refreshData = async () => {
        if (!isMounted) return

        console.log("Screen focused, refreshing data")

        // 현재 activeTab 상태 저장
        const currentActiveTab = activeTab

        // 현재 월/년 저장
        const currentMonthValue = currentMonth
        const currentYearValue = currentYear

        // 그룹 데이터 새로고침
        await fetchChallengeGroup()

        // 사용자가 명시적으로 새 그룹 탭을 선택했다면 activeTab을 복원
        if (currentActiveTab !== undefined && isMounted) {
          setActiveTab(currentActiveTab)

          // 현재 탭이 그룹 탭이면 멤버 데이터 새로고침
          if (currentActiveTab !== null) {
            await fetchGroupMembers(currentActiveTab)

            // 이전에 선택한 월/년 복원
            setCurrentMonth(currentMonthValue)
            setCurrentYear(currentYearValue)

            // 현재 월 데이터 로드
            await loadMonthData()
          }
        }
      }

      refreshData()

      return () => {
        isMounted = false
      }
    }, [fetchChallengeGroup, fetchGroupMembers, loadMonthData]),
  )

  useEffect(() => {
    console.log("Current month/year:", currentMonth, currentYear)

    // activeTab이 없으면 데이터를 로드하지 않음
    if (!activeTab) return

    // 히스토리 키 생성 - 그룹 ID를 포함
    const historyKey = `${activeTab}-${currentYear}-${currentMonth}`

    // 이미 로드된 데이터가 있는지 확인
    if (!historicalData[historyKey]) {
      // 데이터가 없으면 로드
      loadMonthData()
    } else {
      console.log(`Using cached data for ${historyKey}`)
    }
  }, [currentMonth, currentYear, loadMonthData, historicalData, activeTab])

  useEffect(() => {
    if (activeTab) {
      // 이미 안정적인 데이터가 있는지 확인
      const key = `${activeTab}-${currentYear}-${currentMonth}`
      if (!stableProgressData[key] || Date.now() - stableProgressData[key].timestamp > 5 * 60 * 1000) {
        loadMonthData()
      }
    }
  }, [activeTab, currentYear, currentMonth, loadMonthData, stableProgressData])

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

  // 현재 월/년과 그룹에 맞는 히스토리 키 생성
  const historyKey = activeTab ? `${activeTab}-${currentYear}-${currentMonth}` : ""

  // 현재 월인지 확인
  const isCurrentMonthYearCheck = currentMonth === currentMonthNum && currentYear === currentYearNum

  // 표시할 멤버 데이터 결정 (안정적인 데이터 우선 사용)
  const displayMembers = useMemo(() => {
    if (!activeTab) return []

    const key = `${activeTab}-${currentYear}-${currentMonth}`

    // 1. 안정적인 데이터가 있으면 우선 사용
    if (stableProgressData[key]?.members?.length > 0) {
      return stableProgressData[key].members
    }

    // 2. 현재 월이면 currentMonthMembers 사용
    if (isCurrentMonthYearCheck) {
      return currentMonthMembers
    }

    // 3. 히스토리 데이터 사용
    return historicalData[key]?.members || []
  }, [
    activeTab,
    currentYear,
    currentMonth,
    isCurrentMonthYearCheck,
    stableProgressData,
    currentMonthMembers,
    historicalData,
  ])

  // 정렬된 멤버 데이터
  const sortedMembers = useMemo(() => {
    // 이미 정렬/랭킹이 있는 데이터인 경우 그대로 사용
    if (displayMembers.length > 0 && displayMembers[0].rank !== undefined) {
      return displayMembers
    }

    // 정렬이 필요한 경우
    return [...displayMembers]
      .sort((a, b) => b.totalProgress - a.totalProgress)
      .map((member, index) => ({ ...member, rank: index + 1 }))
  }, [displayMembers])

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
                  {isCurrentMonth
                    ? "아직 챌린지 참여자가 없어요"
                    : `${currentYear}년 ${currentMonth}월에는 이 그룹의 챌린지 기록이 없어요`}
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

