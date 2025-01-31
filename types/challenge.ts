import type { Goal } from "./goal"

export interface ChallengeMember {
  id: string
  name: string
  profileImage: string
  goals: Goal[]
  totalProgress: number
  rank?: number
}

export interface Challenge {
  id: string
  month: number
  year: number
  members: ChallengeMember[]
}

