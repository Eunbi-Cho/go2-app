import type React from "react"
import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native"
import Modal from "react-native-modal"
import * as ImagePicker from "expo-image-picker"
import type { Goal } from "../types/goal"

interface GoalAndImageSelectionModalProps {
  isVisible: boolean
  goals: Goal[]
  onClose: () => void
  onImageSelected: (goalId: string, imageUri: string) => void
}

const GoalAndImageSelectionModal: React.FC<GoalAndImageSelectionModalProps> = ({
  isVisible,
  goals,
  onClose,
  onImageSelected,
}) => {
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)

  const handleGoalSelect = (goal: Goal) => {
    setSelectedGoal(goal)
  }

  const handleImagePick = async () => {
    if (!selectedGoal) return

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      onImageSelected(selectedGoal.id, result.assets[0].uri)
    }
  }

  const handleCameraLaunch = async () => {
    if (!selectedGoal) return

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      onImageSelected(selectedGoal.id, result.assets[0].uri)
    }
  }

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      backdropTransitionOutTiming={0}
      backdropTransitionInTiming={0}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      style={styles.modal}
    >
      <View style={styles.container}>
        <Text style={styles.title}>어떤 목표를 인증하나요?</Text>
        <FlatList
          data={goals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.goalItem, selectedGoal?.id === item.id && styles.selectedGoalItem]}
              onPress={() => handleGoalSelect(item)}
            >
              <Text style={styles.goalIcon}>{item.icon}</Text>
              <Text style={styles.goalName}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, !selectedGoal && styles.disabledButton]}
            onPress={handleImagePick}
            disabled={!selectedGoal}
          >
            <Text style={styles.buttonText}>갤러리에서 선택</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, !selectedGoal && styles.disabledButton]}
            onPress={handleCameraLaunch}
            disabled={!selectedGoal}
          >
            <Text style={styles.buttonText}>지금 촬영</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#000000",
  },
  goalItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#f8f8f8",
  },
  selectedGoalItem: {
    backgroundColor: "#dde7ff",
  },
  goalIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  goalName: {
    fontSize: 16,
    color: "#000000",
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    backgroundColor: "#387aff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 5,
  },
  disabledButton: {
    backgroundColor: "#d9d9d9",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
})

export default GoalAndImageSelectionModal

