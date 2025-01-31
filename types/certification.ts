import type { Timestamp } from "@react-native-firebase/firestore"

export interface Certification {
  id: string
  userId: string
  goalId: string
  imageUrl: string
  timestamp: Timestamp
  userProfileImage?: string
  goalProgress: number
  goalWeeklyGoal: number
}

