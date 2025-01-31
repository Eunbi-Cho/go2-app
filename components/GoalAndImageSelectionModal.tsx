import type React from "react"
import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import type { Goal } from "../types/goal"

interface GoalAndImageSelectionModalProps {
  visible: boolean
  goals: Goal[]
  onClose: () => void
  onImageSelected: (goalId: string, imageUri: string) => void
}

const GoalAndImageSelectionModal: React.FC<GoalAndImageSelectionModalProps> = ({
  visible,
  goals,
  onClose,
  onImageSelected,
}) => {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null)

  const handleGoalSelect = (goalId: string) => {
    setSelectedGoal(goalId)
  }

  const handleImagePick = async (fromCamera: boolean) => {
    if (!selectedGoal) {
      alert("목표를 선택해주세요.")
      return
    }

    let result
    if (fromCamera) {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      })
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      })
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      onImageSelected(selectedGoal, result.assets[0].uri)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent}>
          <TouchableOpacity activeOpacity={1}>
            <Text style={styles.modalTitle}>어떤 목표의 인증샷인가요?</Text>
            {goals.length > 0 ? (
              <FlatList
                data={goals}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.goalItem} onPress={() => handleGoalSelect(item.id)}>
                    <View style={[styles.goalIcon, { backgroundColor: item.color }]}>
                      <Text style={styles.goalIconText}>{item.icon}</Text>
                    </View>
                    <Text style={styles.goalName}>{item.name}</Text>
                    {selectedGoal === item.id && (
                      <Ionicons name="checkmark-circle" size={24} color="#387aff" style={styles.checkIcon} />
                    )}
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={styles.noGoalsContainer}>
                <Text style={styles.noGoalsText}>오늘 인증 가능한 목표가 없습니다.</Text>
              </View>
            )}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, goals.length === 0 && styles.disabledButton]}
                onPress={() => handleImagePick(false)}
                disabled={goals.length === 0}
              >
                <Text style={styles.buttonText}>갤러리에서 선택</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, goals.length === 0 && styles.disabledButton]}
                onPress={() => handleImagePick(true)}
                disabled={goals.length === 0}
              >
                <Text style={styles.buttonText}>지금 촬영</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  modalTitle: {
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
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  goalIconText: {
    fontSize: 20,
    color: "#ffffff",
  },
  goalName: {
    fontSize: 16,
    color: "#000000",
    flex: 1,
  },
  checkIcon: {
    marginLeft: 10,
    color: "#387aff",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  button: {
    backgroundColor: "#387aff",
    padding: 15,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
  },
  disabledButton: {
    backgroundColor: "#d9d9d9",
  },
  buttonText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
  },
  noGoalsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noGoalsText: {
    fontSize: 16,
    color: "#000000",
    textAlign: "center",
  },
})

export default GoalAndImageSelectionModal

