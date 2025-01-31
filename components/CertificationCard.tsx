import type React from "react"
import { View, Text, StyleSheet, Image } from "react-native"
import type { Goal } from "../types/goal"
import type { Certification } from "../types/certification"
import CircularProgress from "./CircularProgress"
import { lightenColor } from "../utils/colorUtils"

interface CertificationCardProps {
  certification: Certification
  goals: Goal[]
}

const CertificationCard: React.FC<CertificationCardProps> = ({ certification, goals }) => {
  const goal = goals.find((g) => g.id === certification.goalId)

  if (!goal) return null

  const progress = certification.goalProgress
  const weeklyGoal = certification.goalWeeklyGoal
  const lighterColor = lightenColor(goal.color, 0.6) // 60% lighter

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
          <CircularProgress size={50} strokeWidth={5} progress={(progress / weeklyGoal) * 100} color={goal.color} />
          <View style={[styles.iconBackground, { backgroundColor: lighterColor }]}>
            <Text style={styles.goalIcon}>{goal.icon}</Text>
          </View>
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
    fontSize: 18,
    fontWeight: "bold",
  },
  goalIconContainer: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 50,
    height: 50,
  },
  iconBackground: {
    position: "absolute",
    top: 5,
    left: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  goalIcon: {
    fontSize: 20,
    color: "#000000",
  },
})

export default CertificationCard

