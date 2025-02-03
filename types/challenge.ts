import type { Goal } from "./goal"

export interface ChallengeMember {
  id: string
  userId: string
  name: string
  profileImage: string
  totalProgress: number
  goals: Goal[]
  rank?: number
}

export interface Challenge {
  id: string
  month: number
  year: number
  members: ChallengeMember[]
}

// Add new interface for challenge history
export interface ChallengeHistory {
  id: string
  groupId: string
  year: number
  month: number
  members: {
    userId: string
    name: string
    profileImage: string
    totalProgress: number
    rank: number
  }[]
  completedAt: Date
}

