import { EXPO_KAKAO_APP_KEY } from "@env"
import "react-native-gesture-handler"
import { useEffect, useState } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { initializeKakaoSDK } from "@react-native-kakao/core"
import * as Font from "expo-font"
import type { RootStackParamList, UserProfile } from "./types/navigation"

import LoginScreen from "./screens/LoginScreen"
import HomeScreen from "./screens/HomeScreen"
import ChallengeScreen from "./screens/ChallengeScreen"
import ProfileScreen from "./screens/ProfileScreen"
import GoalCreationScreen from "./screens/GoalCreationScreen"

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator<RootStackParamList>()

type MainTabsProps = {
  userProfile: UserProfile
}

const MainTabs = ({ userProfile }: MainTabsProps) => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home"

          if (route.name === "Home") {
            iconName = "home"
          } else if (route.name === "Challenge") {
            iconName = "trophy"
          } else if (route.name === "Profile") {
            iconName = "person"
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: "#387aff",
        tabBarInactiveTintColor: "#ABABAB",
        tabBarShowLabel: false,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Challenge" component={ChallengeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} initialParams={{ userProfile }} />
    </Tab.Navigator>
  )
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [fontsLoaded, setFontsLoaded] = useState(false)

  useEffect(() => {
    initializeKakaoSDK(EXPO_KAKAO_APP_KEY)
    loadFonts()
  }, [])

  const loadFonts = async () => {
    await Font.loadAsync({
      ...Ionicons.font,
    })
    setFontsLoaded(true)
  }

  const handleLoginSuccess = (profile: UserProfile) => {
    setIsLoggedIn(true)
    setUserProfile(profile)
    console.log("App userProfile set:", profile)
  }

  if (!fontsLoaded) {
    return null
  }

  if (!isLoggedIn || !userProfile) {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        </NavigationContainer>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider style={{ backgroundColor: "#f8f8f8" }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" children={() => <MainTabs userProfile={userProfile} />} />
          <Stack.Screen name="GoalCreation" component={GoalCreationScreen} initialParams={{ userProfile }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

