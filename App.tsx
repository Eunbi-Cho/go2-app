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
import * as SplashScreen from "expo-splash-screen"
import type { RootStackParamList, MainTabsParamList, UserProfile } from "./types/navigation"
import { StyleSheet, View } from "react-native"
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
import CertificationSuccessScreen from "./screens/CertificationSuccessScreen"

const Tab = createBottomTabNavigator<MainTabsParamList>()
const Stack = createNativeStackNavigator<RootStackParamList>()

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync()

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
  const [hasGoals, setHasGoals] = useState(false)
  const [appIsReady, setAppIsReady] = useState(false)
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null)

  const loadFonts = useCallback(async () => {
    await Font.loadAsync({
      ...Ionicons.font,
      MungyeongGamhongApple: require("./assets/fonts/Mungyeong-Gamhong-Apple.otf"),
    })
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
    async function prepare() {
      try {
        // Keep the splash screen visible while we fetch resources
        await SplashScreen.preventAutoHideAsync()

        // Initialize Kakao SDK
        if (!EXPO_KAKAO_APP_KEY) {
          throw new Error("Kakao App Key is not defined")
        }
        await initializeKakaoSDK(EXPO_KAKAO_APP_KEY)

        // Request user permission for notifications
        await requestUserPermission()

        // Load fonts
        await loadFonts()

        // Artificially delay for two seconds to simulate a slow loading
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (e) {
        console.warn(e)
      } finally {
        // Tell the application to render
        setAppIsReady(true)
      }
    }

    prepare()
  }, [loadFonts, requestUserPermission]) // Added requestUserPermission to dependencies

  useEffect(() => {
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
        }
      } else {
        setIsLoggedIn(false)
        setUserProfile(null)
        setHasGoals(false)
      }
    })

    return () => unsubscribe()
  }, [checkUserGoals, getFCMToken])

  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log("Foreground Message received:", remoteMessage)
      // Implement your foreground notification handling logic here
    })

    return unsubscribe
  }, [])

  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log("Background Message received:", remoteMessage)
    // Implement your background notification handling logic here
  })

  const handleLoginSuccess = async (profile: UserProfile) => {
    setIsLoggedIn(true)
    setUserProfile(profile)
    const currentUser = auth().currentUser
    if (currentUser) {
      const userHasGoals = await checkUserGoals(currentUser.uid)
      setHasGoals(userHasGoals)
      navigationRef.current?.navigate("MainTabs", { userProfile: profile, handleLogout })
    }
    console.log("App userProfile set:", profile)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserProfile(null)
    setHasGoals(false)
  }

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setAppIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      await SplashScreen.hideAsync()
    }
  }, [appIsReady])

  if (!appIsReady) {
    return null
  }

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
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
                <Stack.Screen name="CertificationSuccess" component={CertificationSuccessScreen} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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

