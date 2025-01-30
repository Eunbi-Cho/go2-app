import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

interface CertificationCard {
  id: string
  imageUrl: string
  timestamp: string
  icons: string[]
}

const mockCertifications: CertificationCard[] = [
  {
    id: "1",
    imageUrl: "/placeholder.svg",
    timestamp: "2024.01.22 Wed 16:44",
    icons: ["🍺", "😊", "💪"],
  },
  {
    id: "2",
    imageUrl: "/placeholder.svg",
    timestamp: "2024.01.22 Wed 16:44",
    icons: ["💻", "⚙️", "🔧"],
  },
  {
    id: "3",
    imageUrl: "/placeholder.svg",
    timestamp: "2024.01.22 Wed 16:44",
    icons: ["⚙️"],
  },
  {
    id: "4",
    imageUrl: "/placeholder.svg",
    timestamp: "2024.01.22 Wed 16:44",
    icons: ["💡"],
  },
]

export default function HomeScreen() {
  const currentTime = new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.timeText}>{currentTime}</Text>
      <Text style={styles.headerText}>오늘의 목표 달성을 인증하세요</Text>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.gridContainer}>
          {mockCertifications.map((cert) => (
            <View key={cert.id} style={styles.certificationCard}>
              <View style={styles.profileIconsContainer}>
                <Image source={{ uri: "https://via.placeholder.com/40" }} style={styles.profileImage} />
                <View style={styles.iconContainer}>
                  {cert.icons.map((icon, index) => (
                    <View key={index} style={styles.iconBadge}>
                      <Text>{icon}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Image source={{ uri: "https://via.placeholder.com/300x400" }} style={styles.certificationImage} />
              <Text style={styles.timestamp}>{cert.timestamp}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.uploadButton}>
        <Text style={styles.uploadButtonText}>+ 인증샷 올리기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
  },
  timeText: {
    fontSize: 48,
    fontWeight: "bold",
    textAlign: "center",
    color: "#387aff",
    marginTop: 20,
    marginBottom: 10,
  },
  headerText: {
    fontSize: 20,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 20,
    color: "#000000",
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    paddingVertical: 10,
  },
  certificationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileIconsContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  iconContainer: {
    flexDirection: "row",
    marginLeft: 10,
  },
  iconBadge: {
    backgroundColor: "#fff3c8",
    borderRadius: 15,
    padding: 5,
    marginRight: 5,
  },
  certificationImage: {
    width: "100%",
    height: 400,
    resizeMode: "cover",
  },
  timestamp: {
    padding: 10,
    color: "#767676",
  },
  uploadButton: {
    backgroundColor: "#387aff",
    padding: 15,
    marginVertical: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  uploadButtonText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
  },
})

