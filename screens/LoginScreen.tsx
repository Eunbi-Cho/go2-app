import type React from "react"
import { View, StyleSheet, TouchableOpacity, Text, Alert } from "react-native"
import * as KakaoUser from "@react-native-kakao/user"
import auth from "@react-native-firebase/auth"

const firebaseAuth = auth()

interface LoginScreenProps {
  onLoginSuccess: (profile: { nickname: string; profileImageUrl: string }) => void
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const getProfile = async () => {
    try {
      const result = await KakaoUser.me()
      console.log("GetProfile Success", JSON.stringify(result))

      if (!result.email) {
        Alert.alert("로그인 실패", "카카오 계정에 이메일이 등록되어 있지 않습니다.")
        return
      }

      const email = result.email
      const password = "A!@" + result.id

      try {
        const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password)
        console.log("Firebase signup success", userCredential)

        onLoginSuccess({
          nickname: result.nickname ?? "Unknown",
          profileImageUrl: result.profileImageUrl ?? "",
        })
      } catch (firebaseError: any) {
        if (firebaseError.code === "auth/email-already-in-use") {
          try {
            const signInResult = await firebaseAuth.signInWithEmailAndPassword(email, password)
            console.log("Firebase signin success", signInResult)

            onLoginSuccess({
              nickname: result.nickname ?? "Unknown",
              profileImageUrl: result.profileImageUrl ?? "",
            })
          } catch (signInError) {
            console.error("Firebase sign-in failed", signInError)
          }
        } else {
          console.error("Firebase auth failed", firebaseError)
        }
      }
    } catch (error: any) {
      console.log(`GetProfile Fail(code:${error.code})`, error.message)
    }
  }

  const handleKakaoLogin = async () => {
    try {
      const result = await KakaoUser.login()
      console.log("로그인 성공", JSON.stringify(result))
      getProfile()
    } catch (error: any) {
      if (error.code === "E_CANCELLED_OPERATION") {
        console.log("로그인 취소", error.message)
      } else {
        console.log(`로그인 실패(code:${error.code})`, error.message)
      }
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>고이고이</Text>
      <Text style={styles.subtitle}>친구들과 함께 목표를 달성해보세요!</Text>
      <TouchableOpacity style={styles.button} onPress={handleKakaoLogin}>
        <Text style={styles.buttonText}>카카오로 시작하기</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5FCFF",
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
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
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
  },
})

export default LoginScreen

