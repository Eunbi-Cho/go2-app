export interface Goal {
    id: string
    userId: string
    icon: string
    color: string
    name: string
    weeklyGoal: number
    progress: number
    days: boolean[]
    lastResetDate: Date
    weeklyProgressHistory: number[] // 새로운 필드: 주간 진행률 기록
  }
  
  