import { EXPO_KAKAO_APP_KEY } from "@env"
import "react-native-gesture-handler"
import { useEffect, useState, useRef } from "react"
import { NavigationContainer, type NavigationContainerRef } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { initializeKakaoSDK } from "@react-native-kakao/core"
import * as Font from "expo-font"
import type { RootStackParamList, UserProfile } from "./types/navigation"
import { View, ActivityIndicator } from "react-native"
import type React from "react"

import LoginScreen from "./screens/LoginScreen"
import HomeScreen from "./screens/HomeScreen"
import ChallengeScreen from "./screens/ChallengeScreen"
import ProfileScreen from "./screens/ProfileScreen"
import GoalCreationScreen from "./screens/GoalCreationScreen"
import FriendProfileScreen from "./screens/FriendProfileScreen"

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator<RootStackParamList>()

type MainTabsProps = {
  userProfile: UserProfile
  handleLogout: () => void
}

const MainTabs = ({ userProfile, handleLogout }: MainTabsProps) => {
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
          backgroundColor: "#F5F5F5",
          borderTopWidth: 0.4,
          elevation: 0,
          shadowOpacity: 0,
          height: 80,
          paddingBottom: 5,
          paddingTop: 4,
          paddingHorizontal: 40,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Challenge" component={ChallengeScreen} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen as React.ComponentType<any>}
        initialParams={{ userProfile, handleLogout }}
      />
    </Tab.Navigator>
  )
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [fontsLoaded, setFontsLoaded] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null)

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log("Starting app initialization...")
        console.log("KAKAO_APP_KEY:", EXPO_KAKAO_APP_KEY) // Remove in production

        if (!EXPO_KAKAO_APP_KEY) {
          throw new Error("Kakao App Key is not defined")
        }

        await initializeKakaoSDK(EXPO_KAKAO_APP_KEY)
        console.log("Kakao SDK initialized successfully")

        await loadFonts()
        console.log("Fonts loaded successfully")

        setIsInitialized(true)
      } catch (error) {
        console.error("Error during app initialization:", error)
      }
    }

    initializeApp()
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

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserProfile(null)
  }

  if (!fontsLoaded || !isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#387aff" />
      </View>
    )
  }

  return (
    <SafeAreaProvider style={{ backgroundColor: "#f8f8f8" }}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isLoggedIn ? (
            <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="MainTabs">
                {() => <MainTabs userProfile={userProfile!} handleLogout={handleLogout} />}
              </Stack.Screen>
              <Stack.Screen
                name="GoalCreation"
                component={GoalCreationScreen}
                initialParams={{ userProfile: userProfile! }}
              />
              <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

