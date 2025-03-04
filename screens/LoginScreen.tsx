"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import * as KakaoUser from "@react-native-kakao/user"
import auth from "@react-native-firebase/auth"
import firestore from "@react-native-firebase/firestore"
import storage from "@react-native-firebase/storage"
import { appleAuth } from "@invertase/react-native-apple-authentication"
import type { UserProfile } from "../types/navigation"

interface LoginScreenProps {
  onLoginSuccess: (profile: UserProfile) => void
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // 로그인 화면이 표시될 때 로그인 상태 초기화
    console.log("Login screen initialized")
  }, [])

  const uploadProfileImage = async (imageUrl: string, userId: string): Promise<string> => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const filename = `profile_${userId}.jpg`
      const ref = storage().ref().child(`profile_images/${filename}`)
      await ref.put(blob)
      return await ref.getDownloadURL()
    } catch (error) {
      console.error("Error uploading profile image:", error)
      return imageUrl
    }
  }

  const saveUserToFirestore = async (user: any, profile: any, profileImageUrl: string, loginType: string) => {
    try {
      const userData = {
        uid: user.uid,
        email: profile.email,
        nickname: profile.nickname || "Unknown",
        profileImageUrl: profileImageUrl,
        kakaoId: profile.id,
        loginType: loginType,
        friends: [],
        createdAt: firestore.FieldValue.serverTimestamp(),
      }

      const filteredUserData = Object.fromEntries(Object.entries(userData).filter(([_, value]) => value !== undefined))

      await firestore().collection("users").doc(user.uid).set(filteredUserData, { merge: true })
      console.log("User data saved to Firestore successfully")
    } catch (error) {
      console.error("Error saving user to Firestore:", error)
      // 여기서는 에러를 throw하지 않고 로깅만 합니다.
      // 사용자 데이터 저장 실패가 로그인 자체를 실패시키지 않도록 합니다.
    }
  }

  const checkUserExists = async (email: string, loginType: string): Promise<boolean> => {
    try {
      // 먼저 Firebase Auth에서 이메일로 로그인 시도
      try {
        await auth().signInWithEmailAndPassword(email, `${loginType}_${email}`)
        return true
      } catch (error) {
        return false
      }
    } catch (error) {
      console.error("Error checking user existence:", error)
      return false
    }
  }

  const handleKakaoLogin = async (profile?: any) => {
    if (isLoading) return
    setIsLoading(true)

    try {
      if (!profile) {
        const token = await KakaoUser.login()
        if (!token) {
          throw new Error("Failed to obtain Kakao access token")
        }
        profile = await KakaoUser.me()
      }

      if (!profile.id) {
        throw new Error("카카오 계정 정보를 가져오는데 실패했습니다.")
      }

      const email = profile.email
      if (!email) {
        throw new Error("카카오 계정에 이메일이 없습니다. 이메일을 등록해주세요.")
      }

      // 먼저 Firebase Auth에서 이메일로 로그인 시도
      try {
        // 기존 계정으로 로그인 시도
        const userCredential = await auth().signInWithEmailAndPassword(email, `kakao_${profile.id}`)
        const user = userCredential.user

        // 로그인 성공 시 사용자 정보 가져오기
        try {
          const userDoc = await firestore().collection("users").doc(user.uid).get()
          if (userDoc.exists) {
            const userData = userDoc.data()
            onLoginSuccess({
              nickname: userData?.nickname || "Unknown",
              profileImageUrl: userData?.profileImageUrl || require("../assets/default-profile-image.png"),
            })
          } else {
            // 사용자 문서가 없으면 생성
            const firebaseImageUrl = await uploadProfileImage(profile.profileImageUrl ?? "", user.uid)
            await saveUserToFirestore(user, profile, firebaseImageUrl, "kakao")

            onLoginSuccess({
              nickname: profile.nickname ?? "Unknown",
              profileImageUrl: firebaseImageUrl,
            })
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
          // 오류가 발생해도 로그인은 성공했으므로 기본 정보로 진행
          onLoginSuccess({
            nickname: profile.nickname ?? "Unknown",
            profileImageUrl: profile.profileImageUrl ?? require("../assets/default-profile-image.png"),
          })
        }

        // 로그인 상태 유지를 위한 추가 설정
        await user.reload()
        console.log("User login state refreshed")

        return
      } catch (loginError) {
        // 로그인 실패 시 새 계정 생성 시도
        console.log("Login failed, trying to create a new account")
      }

      // 새 계정 생성
      try {
        const userCredential = await auth().createUserWithEmailAndPassword(email, `kakao_${profile.id}`)
        console.log("새 사용자 생성 성공")

        const firebaseImageUrl = await uploadProfileImage(profile.profileImageUrl ?? "", userCredential.user.uid)
        await saveUserToFirestore(userCredential.user, profile, firebaseImageUrl, "kakao")

        onLoginSuccess({
          nickname: profile.nickname ?? "Unknown",
          profileImageUrl: firebaseImageUrl,
        })
      } catch (createError: any) {
        if (createError.code === "auth/email-already-in-use") {
          // 이메일이 이미 사용 중이지만 카카오 계정이 아닌 경우
          Alert.alert("로그인 실패", "이미 다른 방식으로 가입된 이메일입니다. 다른 로그인 방식을 시도해주세요.")
        } else {
          throw createError
        }
      }
    } catch (error: any) {
      console.error("로그인 실패:", error)
      let errorMessage = "로그인 과정에서 오류가 발생했습니다."

      if (error.message === "카카오 계정 정보를 가져오는데 실패했습니다.") {
        errorMessage = error.message
      } else if (error.message === "카카오 계정에 이메일이 없습니다. 이메일을 등록해주세요.") {
        errorMessage = error.message
      }

      Alert.alert("로그인 실패", errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAppleLogin = async () => {
    if (isLoading) return
    setIsLoading(true)

    try {
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      })

      if (!appleAuthRequestResponse.identityToken) {
        throw new Error("Apple Sign-In failed - no identity token returned")
      }

      const { identityToken, nonce, fullName } = appleAuthRequestResponse
      const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce)

      let userCredential
      try {
        userCredential = await auth().signInWithCredential(appleCredential)
      } catch (error) {
        if (error instanceof Error && error.message.includes("user-not-found")) {
          // Generate a random password for the new user
          const randomPassword = Math.random().toString(36).slice(-8)

          // Create a new user with the Apple ID as email and the random password
          userCredential = await auth().createUserWithEmailAndPassword(
            appleAuthRequestResponse.email || `${appleAuthRequestResponse.user}@apple.com`,
            randomPassword,
          )
        } else {
          throw error
        }
      }

      const { user } = userCredential
      let userDoc = await firestore().collection("users").doc(user.uid).get()

      if (!userDoc.exists) {
        // 새 사용자 생성
        const defaultProfileImage = require("../assets/default-profile-image.png")
        let userName = "Unknown"
        if (fullName && (fullName.givenName || fullName.familyName)) {
          userName = `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim()
        } else {
          userName = `User_${Math.floor(Math.random() * 10000)}`
        }

        const userData = {
          uid: user.uid,
          email: user.email,
          nickname: userName,
          profileImageUrl: user.photoURL || defaultProfileImage,
          loginType: "apple",
          createdAt: firestore.FieldValue.serverTimestamp(),
        }
        await firestore().collection("users").doc(user.uid).set(userData)
        userDoc = await firestore().collection("users").doc(user.uid).get()
      }

      const userData = userDoc.data()
      onLoginSuccess({
        nickname: userData?.nickname || "Unknown",
        profileImageUrl: userData?.profileImageUrl || require("../assets/default-profile-image.png"),
      })
    } catch (error: unknown) {
      console.error("Apple login failed:", error)
      Alert.alert("로그인 실패", "Apple 로그인 과정에서 오류가 발생했습니다. 다시 시도해 주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ImageBackground source={require("../assets/login-background.png")} style={styles.backgroundImage}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <View style={styles.contentContainer}>
          <Text style={styles.title1}>로그인하고</Text>
          <Text style={styles.title2}>챌린지에</Text>
          <Text style={styles.title3}>참가하세요</Text>
          <TouchableOpacity style={styles.kakaoButton} onPress={() => handleKakaoLogin()} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
            )}
          </TouchableOpacity>
          {Platform.OS === "ios" && (
            <TouchableOpacity style={styles.appleButton} onPress={handleAppleLogin} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.appleButtonText}>Apple로 시작하기</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: "cover",
  },
  container: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  contentContainer: {
    padding: 40,
    width: "100%",
    alignItems: "flex-start",
  },
  title1: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#606060",
    fontFamily: "MungyeongGamhongApple",
  },
  title2: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#FFC100",
    fontFamily: "MungyeongGamhongApple",
  },
  title3: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#606060",
    fontFamily: "MungyeongGamhongApple",
  },
  kakaoButton: {
    backgroundColor: "#FFC100",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  kakaoButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "bold",
  },
  appleButton: {
    backgroundColor: "#000000",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  appleButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
})

export default LoginScreen

