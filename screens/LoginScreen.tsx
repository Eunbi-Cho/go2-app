import type React from "react"
import { useState, useEffect } from "react"
import { View, StyleSheet, TouchableOpacity, Text, Alert, ActivityIndicator } from "react-native"
import * as KakaoUser from "@react-native-kakao/user"
import auth from "@react-native-firebase/auth"
import firestore from "@react-native-firebase/firestore"
import storage from "@react-native-firebase/storage"
import type { UserProfile } from "../types/navigation"

interface LoginScreenProps {
  onLoginSuccess: (profile: UserProfile) => void
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const checkKakaoLogin = async () => {
      try {
        const token = await KakaoUser.getAccessToken()
        if (token) {
          console.log("Kakao access token is available")
        }
      } catch (error: any) {
        if (error.code === 'TokenNotFound') {
          console.log("No Kakao access token available - normal state for new login")
        } else {
          console.error("Error checking Kakao login status:", error)
        }
      }
    }

    checkKakaoLogin()
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

  const saveUserToFirestore = async (user: any, kakaoProfile: any, firebaseImageUrl: string) => {
    try {
      await firestore().collection("users").doc(user.uid).set(
        {
          uid: user.uid,
          email: kakaoProfile.email,
          nickname: kakaoProfile.nickname,
          profileImageUrl: firebaseImageUrl,
          kakaoId: kakaoProfile.id,
          friends: [],
          createdAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    } catch (error) {
      console.error("Error saving user to Firestore:", error)
      throw error
    }
  }

  const handleKakaoLogin = async () => {
    if (isLoading) return
    setIsLoading(true)
    
    try {
      // 1. 카카오 로그인
      const token = await KakaoUser.login()
      if (!token) {
        throw new Error("Failed to obtain Kakao access token")
      }

      // 2. 카카오 프로필 가져오기
      const profile = await KakaoUser.me()
      if (!profile.email) {
        throw new Error("카카오 계정에 이메일이 없습니다. 이메일을 등록해주세요.")
      }

      // 3. Firebase 인증
      const uniqueId = `kakao_${profile.id}`
      const password = `${uniqueId}_fixed_string`

      // 먼저 로그인 시도
      try {
        const userCredential = await auth().signInWithEmailAndPassword(profile.email, password)
        console.log("기존 사용자 로그인 성공")
        
        const userDoc = await firestore().collection("users").doc(userCredential.user.uid).get()
        const userData = userDoc.data()
        
        onLoginSuccess({
          nickname: userData?.nickname ?? profile.nickname ?? "Unknown",
          profileImageUrl: userData?.profileImageUrl ?? "",
        })
        
        return // 로그인 성공시 종료
      } catch (signInError: any) {
        // 로그인 실패시 (계정이 없는 경우) 새로 생성
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
          throw signInError // 다른 에러는 그대로 던지기
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>고이고이</Text>
      <Text style={styles.subtitle}>친구들과 함께 목표를 달성해보세요!</Text>
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleKakaoLogin} 
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#000000" />
        ) : (
          <Text style={styles.buttonText}>카카오로 시작하기</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#000000",
  },
  subtitle: {
    fontSize: 16,
    color: "#000000",
    marginBottom: 30,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#FEE500",
    padding: 10,
    borderRadius: 5,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "bold",
  },
})

export default LoginScreen