import { useState, useEffect } from "react"
import { View, Text, StyleSheet, Image } from "react-native"
import type { Goal } from "../types/goal"
import type { Certification } from "../types/certification"
import type { User } from "../types/user"
import CircularProgress from "./CircularProgress"
import { lightenColor } from "../utils/colorUtils"
import SkeletonLoader from "./SkeletonLoader"
import type React from "react" // Added import for React

interface CertificationCardProps {
  certification: Certification
  goal: Goal
  user: User | undefined
  isLoading?: boolean
  currentUser: User | null
}

const CertificationCard: React.FC<CertificationCardProps> = ({ certification, goal, user, isLoading, currentUser }) => {
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    console.log("CertificationCard props:", {
      certificationId: certification.id,
      goalId: goal.id,
      userId: user?.id || currentUser?.id,
      userProfileImageUrl: user?.profileImageUrl,
      currentUserProfileImageUrl: currentUser?.profileImageUrl,
    })
    const profileImageSource =
      user?.profileImageUrl || currentUser?.profileImageUrl
        ? { uri: user?.profileImageUrl || currentUser?.profileImageUrl }
        : require("../assets/default-profile-image.png")
    console.log("Profile image source:", profileImageSource)
  }, [certification, goal, user, currentUser]) // Added currentUser?.profileImageUrl to dependencies

  useEffect(() => {
    console.log("CertificationCard props:", {
      certificationId: certification.id,
      goalId: goal.id,
      userId: user?.id,
      userProfileImageUrl: user?.profileImageUrl,
    })
  }, [certification, goal, user])

  const progress = (goal.progress / goal.weeklyGoal) * 100
  const lighterColor = lightenColor(goal.color, 0.6)

  const profileImageSource =
    user?.profileImageUrl && typeof user?.profileImageUrl === "string" && user?.profileImageUrl.startsWith("http")
      ? { uri: user?.profileImageUrl }
      : require("../assets/default-profile-image.png")
  console.log("Profile image source:", profileImageSource)

  return (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        {(isLoading || !imageLoaded) && <SkeletonLoader width="100%" height="100%" style={styles.image} />}
        <Image
          source={{ uri: certification.imageUrl }}
          style={[styles.image, !imageLoaded && styles.hiddenImage]}
          onLoad={() => {
            console.log("Image loaded successfully:", certification.imageUrl)
            setImageLoaded(true)
          }}
          onError={() => {
            setImageLoaded(true) // Show error state instead of infinite loading
          }}
        />
        {imageLoaded && (
          <>
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
              <CircularProgress size={50} strokeWidth={3} progress={progress} color={goal.color} />
              <View style={[styles.iconBackground, { backgroundColor: lighterColor }]}>
                <Text style={styles.goalIcon}>{goal.icon}</Text>
              </View>
            </View>
            <View style={styles.profileImageContainer}>
              <Image
                source={profileImageSource}
                style={styles.profileImage}
                defaultSource={require("../assets/default-profile-image.png")}
                onError={(error) => {
                  console.log("Error loading profile image:", error.nativeEvent.error)
                  console.log("Falling back to default image")
                }}
              />
            </View>
          </>
        )}
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
  hiddenImage: {
    opacity: 0,
  },
})

export default CertificationCard

