import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { Goal } from "./goal"

export type UserProfile = {
  nickname: string
  profileImageUrl: string
}

export type RootStackParamList = {
  MainTabs: undefined
  GoalCreation: { userProfile: UserProfile; goal?: Goal }
  Profile: { userProfile: UserProfile }
  Home: undefined
  Challenge: undefined
}

export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>

