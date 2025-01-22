import type React from "react"
import { View, Text, StyleSheet, Image } from "react-native"
import type { RouteProp } from "@react-navigation/native"

type RootStackParamList = {
  Profile: { userProfile: { nickname: string; profileImageUrl: string } | null }
}

type ProfileScreenRouteProp = RouteProp<RootStackParamList, "Profile">

interface ProfileScreenProps {
  route: ProfileScreenRouteProp
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ route }) => {
  const { userProfile } = route.params

  if (!userProfile) {
    return (
      <View style={styles.container}>
        <Text>로그인 정보가 없습니다.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: userProfile.profileImageUrl }} style={styles.profileImage} />
      <Text style={styles.name}>{userProfile.nickname}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5FCFF",
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
  },
})

export default ProfileScreen

