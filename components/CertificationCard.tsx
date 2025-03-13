"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from "react-native"
import type { Goal } from "../types/goal"
import type { Certification } from "../types/certification"
import type { User } from "../types/user"
import type { EmojiReaction, GroupedEmojiReaction } from "../types/emoji"
import CircularProgress from "./CircularProgress"
import { lightenColor } from "../utils/colorUtils"
import SkeletonLoader from "./SkeletonLoader"
import EmojiKeyboard from "./EmojiKeyboard"
import MoodPlusIcon from "./icons/MoodPlusIcon"
import firestore from "@react-native-firebase/firestore"
import auth from "@react-native-firebase/auth"
import type React from "react"

interface CertificationCardProps {
  certification: Certification
  goal: Goal
  user: User | undefined
  isLoading?: boolean
  currentUser: User | null
}

const CertificationCard: React.FC<CertificationCardProps> = ({ certification, goal, user, isLoading, currentUser }) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [showEmojiKeyboard, setShowEmojiKeyboard] = useState(false)
  const [emojiReactions, setEmojiReactions] = useState<EmojiReaction[]>([])
  const [groupedReactions, setGroupedReactions] = useState<GroupedEmojiReaction[]>([])
  const [hasPermission, setHasPermission] = useState(true)

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
  }, [certification, goal, user, currentUser])

  useEffect(() => {
    console.log("CertificationCard props:", {
      certificationId: certification.id,
      goalId: goal.id,
      userId: user?.id,
      userProfileImageUrl: user?.profileImageUrl,
    })
  }, [certification, goal, user])

  // Fetch emoji reactions when the component mounts
  useEffect(() => {
    let unsubscribe: () => void = () => {}

    const fetchEmojiReactions = async () => {
      try {
        // First, check if we can access the collection
        const reactionsSnapshot = await firestore()
          .collection("emojiReactions")
          .where("certificationId", "==", certification.id)
          .limit(1)
          .get()
          .catch((error) => {
            console.error("Error checking emoji reactions access:", error)
            setHasPermission(false)
            return null
          })

        if (!reactionsSnapshot) return

        // If we can access it, set up the listener
        unsubscribe = firestore()
          .collection("emojiReactions")
          .where("certificationId", "==", certification.id)
          .onSnapshot(
            (snapshot) => {
              const reactions = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as EmojiReaction[]

              setEmojiReactions(reactions)
              groupReactions(reactions)
            },
            (error) => {
              console.error("Error in emoji reactions listener:", error)
              setHasPermission(false)
            },
          )
      } catch (error) {
        console.error("Error fetching emoji reactions:", error)
        setHasPermission(false)
      }
    }

    fetchEmojiReactions()

    return () => unsubscribe()
  }, [certification.id])

  // Group similar emoji reactions
  const groupReactions = (reactions: EmojiReaction[]) => {
    const groupedEmojis: { [key: string]: GroupedEmojiReaction } = {}

    reactions.forEach((reaction) => {
      if (!groupedEmojis[reaction.emoji]) {
        groupedEmojis[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          userIds: [],
          reactionIds: [],
        }
      }

      groupedEmojis[reaction.emoji].count += 1
      groupedEmojis[reaction.emoji].userIds.push(reaction.userId)
      groupedEmojis[reaction.emoji].reactionIds.push(reaction.id)
    })

    const groupedArray = Object.values(groupedEmojis)
    setGroupedReactions(groupedArray)
  }

  const handleEmojiSelect = async (emoji: string) => {
    console.log("Selected emoji:", emoji, "for certification:", certification.id)
    setShowEmojiKeyboard(false)

    if (!hasPermission) {
      Alert.alert("권한 오류", "이모지 반응을 추가할 권한이 없습니다. 관리자에게 문의하세요.", [{ text: "확인" }])
      return
    }

    const currentUserId = auth().currentUser?.uid
    if (!currentUserId) return

    try {
      // Check if the user already has any reaction on this certification
      const userReactions = emojiReactions.filter((reaction) => reaction.userId === currentUserId)

      // Check if the user already reacted with this specific emoji
      const existingReaction = userReactions.find((reaction) => reaction.emoji === emoji)

      if (existingReaction) {
        // User already reacted with this emoji, so remove the reaction
        await firestore().collection("emojiReactions").doc(existingReaction.id).delete()
        console.log("Removed emoji reaction:", existingReaction.id)
      } else {
        // If user has any other reactions, remove them first (one reaction per user per certification)
        if (userReactions.length > 0) {
          for (const reaction of userReactions) {
            await firestore().collection("emojiReactions").doc(reaction.id).delete()
            console.log("Removed previous emoji reaction:", reaction.id)
          }
        }

        // Add new reaction
        await firestore().collection("emojiReactions").add({
          certificationId: certification.id,
          emoji: emoji,
          userId: currentUserId,
          timestamp: firestore.FieldValue.serverTimestamp(),
        })
        console.log("Added emoji reaction")
      }
    } catch (error) {
      console.error("Error managing emoji reaction:", error)
      Alert.alert("오류", "이모지 반응을 처리하는 중 오류가 발생했습니다.", [{ text: "확인" }])
    }
  }

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

            {/* Emoji reactions container */}
            <View style={styles.emojiReactionsContainer}>
              {hasPermission &&
                groupedReactions.map((reaction, index) => (
                  <TouchableOpacity
                    key={`${reaction.emoji}-${index}`}
                    style={styles.emojiReactionBubble}
                    onPress={() => handleEmojiSelect(reaction.emoji)}
                  >
                    <Text style={styles.emojiReactionText}>{reaction.emoji}</Text>
                    {reaction.count >= 2 && <Text style={styles.emojiReactionCount}> {reaction.count}</Text>}
                  </TouchableOpacity>
                ))}
              <TouchableOpacity style={styles.emojiButton} onPress={() => setShowEmojiKeyboard(true)}>
                <MoodPlusIcon color="#ffffff" size={24} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <EmojiKeyboard
        isVisible={showEmojiKeyboard}
        onEmojiSelect={handleEmojiSelect}
        onClose={() => setShowEmojiKeyboard(false)}
      />
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
  emojiReactionsContainer: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  emojiButton: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiButtonText: {
    fontSize: 20,
  },
  emojiReactionBubble: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiReactionText: {
    fontSize: 18,
    // marginRight: 4,
  },
  emojiReactionCount: {
    fontSize: 14,
    color: "#ffffff",
  },
})

export default CertificationCard

