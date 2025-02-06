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
    const checkLoginStatus = async () => {
      try {
        const token = await KakaoUser.getAccessToken()
        if (token) {
          const profile = await KakaoUser.me()
          const uniqueId = `kakao_${profile.id}`
          const password = `${uniqueId}_fixed_string`

          try {
            await auth().signInWithEmailAndPassword(profile.email, password)
            console.log("Auto login successful")
          } catch (error) {
            console.error("Auto login failed:", error)
          }
        }
      } catch (error) {
        console.log("No Kakao access token available")
      }
    }

    checkLoginStatus()
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

  const saveUserToFirestore = async (user: any, profile: any, profileImageUrl: string) => {
    try {
      const userData = {
        uid: user.uid,
        email: profile.email,
        nickname: profile.nickname || profile.name || "Unknown",
        profileImageUrl: profileImageUrl,
        kakaoId: profile.id,
        friends: [],
        createdAt: firestore.FieldValue.serverTimestamp(),
      }

      // Filter out undefined values
      const filteredUserData = Object.fromEntries(Object.entries(userData).filter(([_, value]) => value !== undefined))

      await firestore().collection("users").doc(user.uid).set(filteredUserData, { merge: true })
    } catch (error) {
      console.error("Error saving user to Firestore:", error)
      throw error
    }
  }

  const handleKakaoLogin = async () => {
    if (isLoading) return
    setIsLoading(true)

    try {
      const token = await KakaoUser.login()
      if (!token) {
        throw new Error("Failed to obtain Kakao access token")
      }

      const profile = await KakaoUser.me()
      if (!profile.email) {
        throw new Error("카카오 계정에 이메일이 없습니다. 이메일을 등록해주세요.")
      }

      const uniqueId = `kakao_${profile.id}`
      const password = `${uniqueId}_fixed_string`

      try {
        const userCredential = await auth().signInWithEmailAndPassword(profile.email, password)
        console.log("기존 사용자 로그인 성공")

        const userDoc = await firestore().collection("users").doc(userCredential.user.uid).get()
        const userData = userDoc.data()

        onLoginSuccess({
          nickname: userData?.nickname ?? profile.nickname ?? "Unknown",
          profileImageUrl: userData?.profileImageUrl ?? "",
        })

        return
      } catch (signInError: any) {
        if (signInError.code === "auth/user-not-found") {
          const newUserCredential = await auth().createUserWithEmailAndPassword(profile.email, password)
          console.log("새 사용자 생성 성공")

          const firebaseImageUrl = await uploadProfileImage(profile.profileImageUrl ?? "", newUserCredential.user.uid)
          await saveUserToFirestore(newUserCredential.user, profile, firebaseImageUrl)

          onLoginSuccess({
            nickname: profile.nickname ?? "Unknown",
            profileImageUrl: firebaseImageUrl,
          })
        } else {
          throw signInError
        }
      }
    } catch (error: any) {
      console.error("로그인 실패:", error)
      let errorMessage = "로그인 과정에서 오류가 발생했습니다."

      if (error.message === "카카오 계정에 이메일이 없습니다. 이메일을 등록해주세요.") {
        errorMessage = error.message
      } else if (error.code === "auth/invalid-credential") {
        errorMessage = "인증 정보가 유효하지 않습니다. 다시 시도해주세요."
      } else if (error.code === "auth/email-already-in-use") {
        errorMessage = "이미 가입된 이메일입니다. 잠시 후 다시 시도해주세요."
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

      console.log("Apple Auth Response:", appleAuthRequestResponse)

      if (!appleAuthRequestResponse.identityToken) {
        throw new Error("Apple Sign-In failed - no identity token returned")
      }

      const { identityToken, nonce, fullName, email } = appleAuthRequestResponse
      const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce)

      const userCredential = await auth().signInWithCredential(appleCredential)
      const { user } = userCredential

      console.log("Full Name from Apple:", fullName)
      console.log("User from Firebase:", user)

      const defaultProfileImage = require("../assets/default-profile-image.png")

      // 이름 구성 로직
      let userName = "Unknown"
      if (fullName && (fullName.givenName || fullName.familyName)) {
        userName = `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim()
      } else {
        userName = `User_${Math.floor(Math.random() * 10000)}`
      }

      console.log("User name set to:", userName)

      const userDoc = await firestore().collection("users").doc(user.uid).get()

      if (!userDoc.exists) {
        const userData = {
          uid: user.uid,
          email: email || user.email,
          nickname: userName,
          profileImageUrl: user.photoURL || defaultProfileImage,
          createdAt: firestore.FieldValue.serverTimestamp(),
        }
        await firestore().collection("users").doc(user.uid).set(userData)
        console.log("New user data saved to Firestore:", userData)

        onLoginSuccess({
          nickname: userName,
          profileImageUrl: user.photoURL || defaultProfileImage,
        })
      } else {
        const userData = userDoc.data()
        // 기존 유저의 경우 저장된 이름을 우선적으로 사용하되, 없으면 새로 생성한 이름 사용
        const nickname = userData?.nickname || userName
        await firestore().collection("users").doc(user.uid).update({ nickname })
        console.log("Existing user data updated in Firestore:", { nickname })

        onLoginSuccess({
          nickname: nickname,
          profileImageUrl: userData?.profileImageUrl || user.photoURL || defaultProfileImage,
        })
      }
      console.log("Login success, user profile:", {
        nickname: userName,
        profileImageUrl: user.photoURL || defaultProfileImage,
      })
    } catch (error: any) {
      console.error("Apple login failed:", error)
      Alert.alert("로그인 실패", "Apple 로그인 과정에서 오류가 발생했습니다.")
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
          <TouchableOpacity style={styles.kakaoButton} onPress={handleKakaoLogin} disabled={isLoading}>
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

