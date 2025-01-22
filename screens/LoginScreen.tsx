import type React from "react"
import { View, StyleSheet, TouchableOpacity, Text } from "react-native"
import * as KakaoUser from "@react-native-kakao/user"

interface LoginScreenProps {
  onLoginSuccess: (profile: { nickname: string; profileImageUrl: string }) => void
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const handleKakaoLogin = async () => {
    try {
      const token = await KakaoUser.login()
      console.log("Kakao login success", token)

      // 사용자 프로필 정보 가져오기
      const profile = await KakaoUser.me()
      if (profile) {
        onLoginSuccess({
          nickname: profile.nickname ?? "Unknown",
          profileImageUrl: profile.profileImageUrl ?? "",
        })
      } else {
        console.error("Failed to retrieve user profile")
      }
    } catch (error) {
      console.error("Kakao login failed", error)
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

