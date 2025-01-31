import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"

interface Participant {
  id: string
  name: string
  profileImage: string
  progress: number
  goals: string[]
}

const mockParticipants: Participant[] = [
  {
    id: "1",
    name: "조은비",
    profileImage: "https://via.placeholder.com/50",
    progress: 80,
    goals: ["🎧", "😊", "🍺", "💡"],
  },
  {
    id: "2",
    name: "조은비",
    profileImage: "https://via.placeholder.com/50",
    progress: 80,
    goals: ["😊", "🍺"],
  },
  {
    id: "3",
    name: "조은비",
    profileImage: "https://via.placeholder.com/50",
    progress: 70,
    goals: ["🎧", "😊", "🍺"],
  },
  {
    id: "4",
    name: "조은비",
    profileImage: "https://via.placeholder.com/50",
    progress: 21,
    goals: ["🎧", "😊", "🍺", "💻", "💡"],
  },
]

export default function ChallengeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.monthIndicator}>
            <Text style={[styles.monthNumber, styles.inactiveMonth]}>01</Text>
            <Text style={styles.activeMonth}>02</Text>
            <Text style={[styles.monthNumber, styles.inactiveMonth]}>03</Text>
          </View>
          <Text style={styles.challengeTitle}>2월 챌린지</Text>
          <Text style={styles.daysLeft}>19일 남음</Text>
        </View>

        <View style={styles.rankingContainer}>
          {mockParticipants.map((participant, index) => (
            <View key={participant.id} style={styles.rankingItem}>
              <Text style={styles.rankNumber}>{index + 1}</Text>
              <Image source={{ uri: participant.profileImage }} style={styles.profileImage} />
              <Text style={styles.participantName}>{participant.name}</Text>
              <View style={styles.goalsContainer}>
                {participant.goals.map((goal, goalIndex) => (
                  <View key={goalIndex} style={styles.goalBadge}>
                    <Text>{goal}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.progressText}>{participant.progress}%</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.linkButton}>
        <Ionicons name="link-outline" size={24} color="#ffffff" />
        <Text style={styles.linkButtonText}>챌린지 초대 링크 복사</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: "#f8f8f8",
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: "center",
    padding: 20,
  },
  monthIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  monthNumber: {
    fontSize: 48,
    fontWeight: "bold",
    marginHorizontal: 20,
  },
  inactiveMonth: {
    color: "#d9d9d9",
    fontSize: 36,
  },
  activeMonth: {
    color: "#387aff",
    fontSize: 48,
    fontWeight: "bold",
  },
  challengeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  daysLeft: {
    color: "#767676",
  },
  rankingContainer: {
    paddingVertical: 20,
  },
  rankingItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 10,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  rankNumber: {
    fontSize: 24,
    fontWeight: "bold",
    width: 40,
    color: "#387aff",
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  participantName: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 10,
  },
  goalsContainer: {
    flexDirection: "row",
    flex: 1,
  },
  goalBadge: {
    backgroundColor: "#f8f8f8",
    borderRadius: 15,
    padding: 5,
    marginRight: 5,
  },
  progressText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#387aff",
  },
  linkButton: {
    backgroundColor: "#387aff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    marginVertical: 20,
    borderRadius: 10,
  },
  linkButtonText: {
    color: "#ffffff",
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "bold",
  },
})

