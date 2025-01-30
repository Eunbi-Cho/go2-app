import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import firestore from "@react-native-firebase/firestore"
import auth from "@react-native-firebase/auth"
import { Ionicons } from "@expo/vector-icons"
import type { Goal } from "../types/goal"
import EmojiKeyboard from "../components/EmojiKeyboard"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../types/navigation"

type GoalCreationScreenProps = NativeStackScreenProps<RootStackParamList, "GoalCreation">

const COLORS = ["#f4583f", "#ffa8b0", "#ffa14a", "#fece51", "#48b86e", "#80daff", "#387aff"]

export const GoalCreationScreen: React.FC<GoalCreationScreenProps> = ({ navigation, route }) => {
  const { userProfile, goal } = route.params
  const [icon, setIcon] = useState(goal?.icon || "")
  const [selectedColor, setSelectedColor] = useState(goal?.color || COLORS[0])
  const [name, setName] = useState(goal?.name || "")
  const [weeklyGoal, setWeeklyGoal] = useState(goal?.weeklyGoal || 1)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isFormValid, setIsFormValid] = useState(false)

  const isEditMode = !!goal

  useEffect(() => {
    setIsFormValid(icon !== "" && name !== "")
  }, [icon, name])

  const handleSubmit = async () => {
    if (!isFormValid) return

    try {
      const currentUser = auth().currentUser
      if (!currentUser) {
        throw new Error("User not authenticated")
      }

      const goalData: Omit<Goal, "id" | "progress" | "days"> = {
        icon,
        color: selectedColor,
        name,
        weeklyGoal,
        userId: currentUser.uid,
      }

      if (isEditMode) {
        await firestore().collection("goals").doc(goal.id).update(goalData)
        console.log("Goal updated successfully:", goalData)
      } else {
        await firestore()
          .collection("goals")
          .add({
            ...goalData,
            progress: 0,
            days: Array(7).fill(false),
            createdAt: firestore.FieldValue.serverTimestamp(),
          })
        console.log("New goal added successfully:", goalData)
      }

      navigation.goBack()
    } catch (error) {
      console.error("Error saving goal:", error)
      Alert.alert("오류", "목표를 저장하는 중 오류가 발생했습니다.")
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    setIcon(emoji)
    setShowEmojiPicker(false)
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#000000" />
      </TouchableOpacity>

      <Text style={styles.title}>
        나, {userProfile.nickname}의{"\n"}
        {isEditMode ? "목표 수정" : "이번달 목표는"}
      </Text>

      <TouchableOpacity
        style={[styles.iconInput, { backgroundColor: selectedColor }]}
        onPress={() => setShowEmojiPicker(true)}
      >
        <View style={styles.iconContainer}>
          {icon ? (
            <Text style={styles.iconText}>{icon}</Text>
          ) : (
            <>
              <View style={styles.dashedBorder} />
              <Ionicons name="add-outline" size={24} color="#ffffff" />
            </>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.colorContainer}>
        {COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[styles.colorOption, { backgroundColor: color }, selectedColor === color && styles.selectedColor]}
            onPress={() => setSelectedColor(color)}
          />
        ))}
      </View>

      <Text style={styles.label}>목표 이름</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="ex. 영어 듣기 1시간"
        placeholderTextColor="#a5a5a5"
      />

      <Text style={styles.label}>주간 목표 달성 횟수</Text>
      <View style={styles.frequencyContainer}>
        <Text style={styles.frequencyLabel}>주</Text>
        <View style={styles.frequencyInputContainer}>
          {[1, 2, 3, 4, 5, 6, 7].map((num) => (
            <Pressable
              key={num}
              style={[styles.frequencyOption, weeklyGoal === num && styles.selectedFrequency]}
              onPress={() => setWeeklyGoal(num)}
            >
              <Text style={[styles.frequencyText, weeklyGoal === num && styles.selectedFrequencyText]}>{num}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.frequencyLabel}>회</Text>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, !isFormValid && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={!isFormValid}
      >
        <Text style={styles.submitButtonText}>{isEditMode ? "수정하기" : "추가하기"}</Text>
      </TouchableOpacity>

      <EmojiKeyboard
        isVisible={showEmojiPicker}
        onEmojiSelect={(emoji) => {
          setIcon(emoji)
          setShowEmojiPicker(false)
        }}
        onClose={() => setShowEmojiPicker(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: 60,
    zIndex: 1,
  },
  title: {
    fontSize: 24,
    color: "#000000",
    marginTop: 40,
    marginBottom: 40,
    textAlign: "center",
    lineHeight: 36,
  },
  iconInput: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    alignSelf: "center",
  },
  dashedBorder: {
    position: "absolute",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#ffffff",
    width: 44,
    height: 44,
    borderRadius: 30,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    fontSize: 40,
  },
  colorContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 40,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: "#000000",
  },
  label: {
    alignSelf: "flex-start",
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 10,
  },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#a5a5a5",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 30,
    fontSize: 16,
    color: "#000000",
    backgroundColor: "#f8f8f8",
  },
  frequencyContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 40,
  },
  frequencyLabel: {
    fontSize: 18,
    marginHorizontal: 10,
    color: "#000000",
  },
  frequencyInputContainer: {
    flexDirection: "row",
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 5,
  },
  frequencyOption: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  selectedFrequency: {
    backgroundColor: "#387aff",
  },
  frequencyText: {
    fontSize: 18,
    color: "#000000",
  },
  selectedFrequencyText: {
    color: "#ffffff",
  },
  submitButton: {
    width: "100%",
    height: 56,
    backgroundColor: "#387aff",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#a5a5a5",
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
  },
})

export default GoalCreationScreen

