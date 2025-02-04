import { EXPO_KAKAO_APP_KEY } from "@env"
import "react-native-gesture-handler"
import { useEffect, useState, useRef, useCallback } from "react"
import { NavigationContainer, type NavigationContainerRef } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { initializeKakaoSDK } from "@react-native-kakao/core"
import * as Font from "expo-font"
import type { RootStackParamList, MainTabsParamList, UserProfile } from "./types/navigation"
import { View, ActivityIndicator, Text, StyleSheet } from "react-native"
import type React from "react"
import auth from "@react-native-firebase/auth"
import firestore from "@react-native-firebase/firestore"
import messaging from "@react-native-firebase/messaging"

import LoginScreen from "./screens/LoginScreen"
import HomeScreen from "./screens/HomeScreen"
import ChallengeScreen from "./screens/ChallengeScreen"
import ProfileScreen from "./screens/ProfileScreen"
import GoalCreationScreen from "./screens/GoalCreationScreen"
import FriendProfileScreen from "./screens/FriendProfileScreen"

const Tab = createBottomTabNavigator<MainTabsParamList>()
const Stack = createNativeStackNavigator<RootStackParamList>()

type MainTabsProps = {
  userProfile: UserProfile
  handleLogout: () => void
}

const MainTabs: React.FC<MainTabsProps> = ({ userProfile, handleLogout }) => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
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
      <Tab.Screen name="Profile">
        {(props) => <ProfileScreen {...props} userProfile={userProfile} handleLogout={handleLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  )
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [fontsLoaded, setFontsLoaded] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [hasGoals, setHasGoals] = useState(false)
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null)

  const loadFonts = useCallback(async () => {
    await Font.loadAsync({
      ...Ionicons.font,
      MungyeongGamhongApple: require("./assets/fonts/Mungyeong-Gamhong-Apple.otf"),
    })
    setFontsLoaded(true)
  }, [])

  const checkUserGoals = useCallback(async (userId: string) => {
    try {
      const goalsSnapshot = await firestore().collection("goals").where("userId", "==", userId).limit(1).get()
      return !goalsSnapshot.empty
    } catch (error) {
      console.error("Error checking user goals:", error)
      return false
    }
  }, [])

  const requestUserPermission = async () => {
    const authStatus = await messaging().requestPermission()
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL

    if (enabled) {
      console.log("Authorization status:", authStatus)
    }
  }

  const getFCMToken = useCallback(async () => {
    try {
      const token = await messaging().getToken()
      console.log("FCM Token:", token)
      const currentUser = auth().currentUser
      if (currentUser) {
        await firestore().collection("users").doc(currentUser.uid).update({
          fcmToken: token,
        })
      }
    } catch (error) {
      console.error("Error getting FCM token:", error)
    }
  }, [])

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log("Starting app initialization...")
        console.log("KAKAO_APP_KEY:", EXPO_KAKAO_APP_KEY)

        if (!EXPO_KAKAO_APP_KEY) {
          throw new Error("Kakao App Key is not defined")
        }

        await initializeKakaoSDK(EXPO_KAKAO_APP_KEY)
        console.log("Kakao SDK initialized successfully")

        await requestUserPermission()

        await loadFonts()
        console.log("Fonts loaded successfully")

        setIsInitialized(true)
      } catch (error) {
        console.error("Error during app initialization:", error)
      }
    }

    initializeApp()

    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      if (user) {
        setIsLoggedIn(true)
        try {
          const userDoc = await firestore().collection("users").doc(user.uid).get()
          if (userDoc.exists) {
            const userData = userDoc.data()
            setUserProfile({
              nickname: userData?.nickname || "Unknown",
              profileImageUrl: userData?.profileImageUrl || "",
            })
            const userHasGoals = await checkUserGoals(user.uid)
            setHasGoals(userHasGoals)
          } else {
            console.error("User document does not exist in Firestore")
            setUserProfile(null)
          }
        } catch (error) {
          console.error("Error fetching user profile:", error)
          setUserProfile(null)
        } finally {
          await getFCMToken()
          setInitializing(false)
        }
      } else {
        setIsLoggedIn(false)
        setUserProfile(null)
        setHasGoals(false)
        setInitializing(false)
      }
    })

    return () => unsubscribe()
  }, [loadFonts, checkUserGoals, getFCMToken])

  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log("Foreground Message received:", remoteMessage)
      // 여기에서 알림을 표시하는 로직을 구현할 수 있습니다.
      // 예: react-native-toast-message 라이브러리를 사용하여 토스트 메시지 표시
    })

    return unsubscribe
  }, [])

  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log("Background Message received:", remoteMessage)
    // 여기에서 백그라운드 알림 처리 로직을 구현할 수 있습니다.
  })

  const handleLoginSuccess = async (profile: UserProfile) => {
    setIsLoggedIn(true)
    setUserProfile(profile)
    const currentUser = auth().currentUser
    if (currentUser) {
      const userHasGoals = await checkUserGoals(currentUser.uid)
      setHasGoals(userHasGoals)
      if (!userHasGoals) {
        navigationRef.current?.navigate("GoalCreation", { userProfile: profile, isInitialGoal: true })
      } else {
        navigationRef.current?.navigate("MainTabs", { userProfile: profile, handleLogout })
      }
    }
    console.log("App userProfile set:", profile)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserProfile(null)
    setHasGoals(false)
  }

  if (!fontsLoaded || !isInitialized || initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#387aff" />
        <Text style={styles.loadingText}>앱을 초기화하는 중...</Text>
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
                initialParams={{ userProfile: userProfile!, isInitialGoal: !hasGoals }}
              />
              <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#767676",
    fontFamily: "MungyeongGamhongApple",
  },
})

