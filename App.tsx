import { EXPO_KAKAO_APP_KEY } from "@env"
import "react-native-gesture-handler"
import React, { useEffect, useState } from "react"
import { StyleSheet } from "react-native"
import { NavigationContainer } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { initializeKakaoSDK } from "@react-native-kakao/core"

import LoginScreen from "./screens/LoginScreen"
import MainScreen from "./screens/MainScreen"
import GoalSettingScreen from "./screens/GoalSettingScreen"
import FriendsScreen from "./screens/FriendsScreen"
import ProfileScreen from "./screens/ProfileScreen"

const Tab = createBottomTabNavigator()

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userProfile, setUserProfile] = useState<{ nickname: string; profileImageUrl: string } | null>(null)

  useEffect(() => {
    initializeKakaoSDK(EXPO_KAKAO_APP_KEY)
  }, [])

  const handleLoginSuccess = (profile: { nickname: string; profileImageUrl: string }) => {
    setIsLoggedIn(true)
    setUserProfile(profile)
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {!isLoggedIn ? (
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        ) : (
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                let iconName: keyof typeof Ionicons.glyphMap = "home"

                if (route.name === "Main") {
                  iconName = focused ? "home" : "home-outline"
                } else if (route.name === "Goals") {
                  iconName = focused ? "flag" : "flag-outline"
                } else if (route.name === "Friends") {
                  iconName = focused ? "people" : "people-outline"
                } else if (route.name === "Profile") {
                  iconName = focused ? "person" : "person-outline"
                }

                return <Ionicons name={iconName} size={size} color={color} />
              },
            })}
          >
            <Tab.Screen name="Main" component={MainScreen} />
            <Tab.Screen name="Goals" component={GoalSettingScreen} />
            <Tab.Screen name="Friends" component={FriendsScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} initialParams={{ userProfile }} />
          </Tab.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
})

