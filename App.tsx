"use client"

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
import * as KakaoUser from "@react-native-kakao/user"
import { appleAuth } from "@invertase/react-native-apple-authentication"

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
  updateUserProfile: (newProfile: UserProfile) => void
}

const MainTabs: React.FC<MainTabsProps> = ({ userProfile, handleLogout, updateUserProfile }) => {
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
        {(props) => (
          <ProfileScreen
            {...props}
            userProfile={userProfile}
            handleLogout={handleLogout}
            updateUserProfile={updateUserProfile}
          />
        )}
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

  const requestUserPermission = useCallback(async () => {
    const authStatus = await messaging().requestPermission()
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL

    if (enabled) {
      console.log("Authorization status:", authStatus)
    }
  }, [])

  const getFCMToken = useCallback(async () => {
    try {
      const token = await messaging().getToken()
      console.log("FCM Token:", token)
      const currentUser = auth().currentUser
      if (currentUser) {
        const userRef = firestore().collection("users").doc(currentUser.uid)
        const userDoc = await userRef.get()

        if (userDoc.exists) {
          await userRef.update({
            fcmToken: token,
          })
        } else {
          await userRef.set({
            uid: currentUser.uid,
            email: currentUser.email,
            fcmToken: token,
            createdAt: firestore.FieldValue.serverTimestamp(),
          })
        }
        console.log("FCM token saved/updated successfully")
      }
    } catch (error) {
      console.error("Error getting or saving FCM token:", error)
    }
  }, [])

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync()

        if (!EXPO_KAKAO_APP_KEY) {
          throw new Error("Kakao App Key is not defined")
        }
        await initializeKakaoSDK(EXPO_KAKAO_APP_KEY)
        await requestUserPermission()
        await loadFonts()
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (e) {
        console.warn(e)
      } finally {
        setAppIsReady(true)
      }
    }

    prepare()
  }, [loadFonts, requestUserPermission])

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      if (user) {
        setIsLoggedIn(true)
        try {
          const userDoc = await firestore().collection("users").doc(user.uid).get()
          if (userDoc.exists) {
            const userData = userDoc.data()
            console.log("Fetched user data:", userData)
            setUserProfile({
              nickname: userData?.nickname || user.displayName || "Unknown",
              profileImageUrl:
                userData?.profileImageUrl || user.photoURL || require("./assets/default-profile-image.png"),
            })
            const userHasGoals = await checkUserGoals(user.uid)
            setHasGoals(userHasGoals)
          } else {
            console.log("User document does not exist in Firestore, creating new document")
            const newUserData = {
              uid: user.uid,
              email: user.email,
              nickname: user.displayName || "Unknown",
              profileImageUrl: user.photoURL || require("./assets/default-profile-image.png"),
              createdAt: firestore.FieldValue.serverTimestamp(),
            }
            await firestore().collection("users").doc(user.uid).set(newUserData)
            setUserProfile({
              nickname: newUserData.nickname,
              profileImageUrl: newUserData.profileImageUrl,
            })
          }
          console.log("User profile set:", userProfile)
        } catch (error) {
          console.error("Error fetching or creating user profile:", error)
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
  }, [checkUserGoals, getFCMToken, userProfile]) // Added userProfile to dependencies

  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log("Foreground Message received:", remoteMessage)
    })

    return unsubscribe
  }, [])

  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log("Background Message received:", remoteMessage)
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

  const handleLogout = async () => {
    console.log("Starting logout process...")
    try {
      // Kakao 로그아웃 시도
      try {
        const isKakaoLoggedIn = await KakaoUser.getAccessToken()
        if (isKakaoLoggedIn) {
          await KakaoUser.logout()
          console.log("Kakao logout successful")
        }
      } catch (kakaoError) {
        console.log("Not logged in with Kakao")
      }

      // Apple 로그아웃 시도
      if (appleAuth.isSupported) {
        try {
          const user = auth().currentUser
          if (user?.providerData[0]?.providerId === "apple.com") {
            await appleAuth.performRequest({
              requestedOperation: appleAuth.Operation.LOGOUT,
            })
            console.log("Apple logout successful")
          }
        } catch (appleError) {
          console.log("Apple logout skipped")
        }
      }

      // Firebase 로그아웃
      const user = auth().currentUser
      if (user) {
        await auth().signOut()
        console.log("Firebase logout successful")
      }
    } catch (error) {
      console.error("Logout error:", error)
    }
    // 모든 로그아웃 시도 후 앱 상태 업데이트
    setIsLoggedIn(false)
    setUserProfile(null)
    setHasGoals(false)
    console.log("App state updated after logout")
  }

  const updateUserProfile = (newProfile: UserProfile) => {
    setUserProfile(newProfile)
  }

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
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
                  {() => (
                    <MainTabs
                      userProfile={userProfile!}
                      handleLogout={handleLogout}
                      updateUserProfile={updateUserProfile}
                    />
                  )}
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

