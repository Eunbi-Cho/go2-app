import type React from "react"
import { View, Text, StyleSheet, Image } from "react-native"
import type { Goal } from "../types/goal"
import type { Certification } from "../types/certification"
import CircularProgress from "./CircularProgress"
import { lightenColor } from "../utils/colorUtils"

interface CertificationCardProps {
  certification: Certification
  goals: Goal[]
  userProfileImage?: string
}

const CertificationCard: React.FC<CertificationCardProps> = ({ certification, goals, userProfileImage }) => {
  const goal = goals.find((g) => g.id === certification.goalId)

  if (!goal) return null

  const progress = certification.goalProgress
  const weeklyGoal = certification.goalWeeklyGoal
  const lighterColor = lightenColor(goal.color, 0.6) // 60% lighter

  const profileImageSource = userProfileImage
    ? { uri: userProfileImage }
    : require("../assets/default-profile-image.png") // Make sure to add a default image

  return (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: certification.imageUrl }} style={styles.image} />
        <View style={styles.overlay} />
        <View style={styles.dateTimeContainer}>
          <Text style={styles.dateTimeText}>
            {certification.timestamp.toDate().toLocaleString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </Text>
        </View>
        <View style={styles.goalIconContainer}>
          <CircularProgress size={50} strokeWidth={3} progress={(progress / weeklyGoal) * 100} color={goal.color} />
          <View style={[styles.iconBackground, { backgroundColor: lighterColor }]}>
            <Text style={styles.goalIcon}>{goal.icon}</Text>
          </View>
        </View>
        <View style={styles.profileImageContainer}>
            <Image source={profileImageSource} style={styles.profileImage} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 15,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    aspectRatio: 1,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  dateTimeContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  dateTimeText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  goalIconContainer: {
    position: "absolute",
    top: 10,
    left: 36,
    width: 50,
    height: 50,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBackground: {
    position: "absolute",
    width: 45,
    height: 45,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  goalIcon: {
    fontSize: 20,
    color: "#000000",
  },
  profileImageContainer: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: "#ffffff",
    overflow: "hidden",
    zIndex: 2,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
})

export default CertificationCard

