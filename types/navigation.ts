import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs"
import type { CompositeNavigationProp } from "@react-navigation/native"
import type { Goal } from "./goal"

export type UserProfile = {
  nickname: string
  profileImageUrl: string
}

export type MainTabsParamList = {
  Home: undefined
  Challenge: undefined
  Profile: undefined
}

export type RootStackParamList = {
  Login: undefined
  MainTabs: { userProfile: UserProfile; handleLogout: () => void }
  GoalCreation: { userProfile: UserProfile; goal?: Goal; isInitialGoal: boolean }
  FriendProfile: { userId: string }
}

export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>

export type MainTabsNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList>,
  NativeStackNavigationProp<RootStackParamList>
>

