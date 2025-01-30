import type React from "react"
import { View, Text, StyleSheet, Image } from "react-native"
import type { RouteProp } from "@react-navigation/native"
import firestore from '@react-native-firebase/firestore';
import { useEffect, useState } from "react";

type RootStackParamList = {
  Profile: { userProfile: { nickname: string; profileImageUrl: string } | null }
}

type ProfileScreenRouteProp = RouteProp<RootStackParamList, "Profile">

interface ProfileScreenProps {
  route: ProfileScreenRouteProp
}

 // Routine 타입 정의 추가
  interface Routine {
  color: string;
  icon: string;
  name: string;
  // 다른 필요한 필드들도 여기에 추가
  }

  const ProfileScreen: React.FC<ProfileScreenProps> = ({ route }) => {
  const { userProfile } = route.params
  
  // 초기값을 null로 설정하고 타입 지정
  const [routine, setRoutine] = useState<Routine | null>(null);

  const getData = async() => {
    try {
      const goalsCollection = await firestore().collection('goal').get();
      if (!goalsCollection.empty) {
        // data() 메서드 호출 수정
        const routineData = goalsCollection.docs[0].data() as Routine;
        setRoutine(routineData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  useEffect(() => {
    getData()
  }, [])

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
      {routine && <Text>{routine.name}</Text>}
      {routine && <Text>{routine.icon}</Text>}
      {routine && <Text>{routine.color}</Text>}
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
