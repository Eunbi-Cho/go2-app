import type React from "react"
import { View, StyleSheet, TouchableOpacity, Text, Alert } from "react-native"
import * as KakaoUser from "@react-native-kakao/user"
import auth from "@react-native-firebase/auth"
import firestore from "@react-native-firebase/firestore"
import storage from "@react-native-firebase/storage"

const firebaseAuth = auth()

interface LoginScreenProps {
  onLoginSuccess: (profile: { nickname: string; profileImageUrl: string }) => void
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
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
      return imageUrl // Return original URL if upload fails
    }
  }

  const saveUserToFirestore = async (user: any, kakaoProfile: any, firebaseImageUrl: string) => {
    try {
      await firestore().collection("users").doc(user.uid).set({
        uid: user.uid,
        email: user.email,
        nickname: kakaoProfile.nickname,
        profileImageUrl: firebaseImageUrl,
        friends: [],
        createdAt: firestore.FieldValue.serverTimestamp(),
      })
    } catch (error) {
      console.error("Error saving user to Firestore:", error)
    }
  }

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
        let userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password)
        if (!userCredential.user) {
          userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password)
        }

        const firebaseImageUrl = await uploadProfileImage(result.profileImageUrl ?? "", userCredential.user.uid)
        await saveUserToFirestore(userCredential.user, result, firebaseImageUrl)

        onLoginSuccess({
          nickname: result.nickname ?? "Unknown",
          profileImageUrl: firebaseImageUrl,
        })
      } catch (firebaseError: any) {
        console.error("Firebase auth failed", firebaseError)
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

