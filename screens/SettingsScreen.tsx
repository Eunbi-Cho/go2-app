import type React from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { CommonActions } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RouteProp } from "@react-navigation/native"
import auth from "@react-native-firebase/auth"
import firestore from "@react-native-firebase/firestore"
import * as KakaoUser from "@react-native-kakao/user"
import { Ionicons } from "@expo/vector-icons"
// import { appleAuth } from "@invertase/react-native-apple-authentication" // Removed Apple Auth import
import type { RootStackParamList } from "../types/navigation"

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>
  route: RouteProp<RootStackParamList, "Settings">
  handleLogout: () => void
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation, handleLogout, route }) => {
  const handleDeleteAccount = async () => {
    Alert.alert("계정 삭제", "계정을 정말 삭제하시겠습니까? 이 계정의 데이터가 모두 삭제됩니다?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            const user = auth().currentUser
            if (user) {
              const userRef = firestore().collection("users").doc(user.uid)

              // Delete user data from Firestore
              await userRef.delete()

              // Delete user's goals
              const goalsSnapshot = await firestore().collection("goals").where("userId", "==", user.uid).get()
              const goalBatch = firestore().batch()
              goalsSnapshot.docs.forEach((doc) => {
                goalBatch.delete(doc.ref)
              })
              await goalBatch.commit()

              // Delete user's certifications
              const certificationsSnapshot = await firestore()
                .collection("certifications")
                .where("userId", "==", user.uid)
                .get()
              const certBatch = firestore().batch()
              certificationsSnapshot.docs.forEach((doc) => {
                certBatch.delete(doc.ref)
              })
              await certBatch.commit()

              // Logout from Kakao if logged in
              try {
                const isKakaoLoggedIn = await KakaoUser.getAccessToken()
                if (isKakaoLoggedIn) {
                  await KakaoUser.logout()
                }
              } catch (error) {
                console.log("Kakao logout skipped")
              }

              // Delete the user's account from Firebase Authentication
              await user.delete()

              // Double-check if the user data is completely removed from Firestore
              const checkUserDoc = await userRef.get()
              if (checkUserDoc.exists) {
                console.error("User document still exists in Firestore after deletion attempt")
                throw new Error("Failed to completely delete user data")
              }

              // Navigate to Login screen
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: "Login" }],
                }),
              )
            }
          } catch (error) {
            console.error("Error deleting account:", error)
            Alert.alert("오류", "계정 삭제 중 문제가 발생했습니다. 다시 시도해 주세요.")
          }
        },
      },
    ])
  }

  const handleLogoutPress = () => {
    Alert.alert("로그아웃", "정말 로그아웃 하시겠습니까?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "로그아웃",
        onPress: handleLogout,
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#000000" />
      </TouchableOpacity>
      <View style={styles.content}>
        <TouchableOpacity style={styles.option} onPress={handleLogoutPress}>
          <Ionicons name="log-out-outline" size={24} color="#000000" style={styles.icon} />
          <Text style={styles.optionText}>로그아웃</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={24} color="#ff3b30" style={styles.icon} />
          <Text style={[styles.optionText, styles.deleteText]}>계정 삭제</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  content: {
    flex: 1,
    paddingTop: 120,
    paddingHorizontal: 20,
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 10,
  },
  option: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
    color: "#000000",
  },
  deleteText: {
    color: "#ff3b30",
  },
  icon: {
    marginRight: 15,
  },
})

export default SettingsScreen

