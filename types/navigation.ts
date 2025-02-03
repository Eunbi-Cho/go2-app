import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { Goal } from "./goal"

export type UserProfile = {
  nickname: string
  profileImageUrl: string
}

export type RootStackParamList = {
  Login: undefined
  MainTabs: undefined
  GoalCreation: { userProfile: UserProfile; goal?: Goal }
  Profile: { userProfile: UserProfile; handleLogout: () => void }
  Home: undefined
  Challenge: undefined
  FriendProfile: { userId: string }
}

export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>

