import type React from "react"
import { useState } from "react"
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Switch } from "react-native"
import { Ionicons } from "@expo/vector-icons"

type IconName = React.ComponentProps<typeof Ionicons>["name"]

const GoalSettingScreen: React.FC = () => {
  const [title, setTitle] = useState("")
  const [isWeekly, setIsWeekly] = useState(true)
  const [frequency, setFrequency] = useState("1")
  const [selectedIcon, setSelectedIcon] = useState<IconName>("star-outline")
  const [selectedColor, setSelectedColor] = useState("#4CAF50")

  const icons: IconName[] = [
    "star-outline",
    "heart-outline",
    "fitness-outline",
    "book-outline",
    "musical-notes-outline",
  ]
  const colors = ["#4CAF50", "#2196F3", "#FFC107", "#9C27B0", "#F44336"]

  const handleSave = () => {
    // TODO: Save goal to backend
    console.log({
      title,
      isWeekly,
      frequency: Number.parseInt(frequency),
      icon: selectedIcon,
      color: selectedColor,
    })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>목표 제목</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="목표를 입력하세요" />

      <Text style={styles.label}>주기 선택</Text>
      <View style={styles.periodContainer}>
        <Text>주간</Text>
        <Switch value={isWeekly} onValueChange={setIsWeekly} />
        <Text>월간</Text>
      </View>

      {isWeekly && (
        <View>
          <Text style={styles.label}>주 실행 횟수</Text>
          <TextInput style={styles.input} value={frequency} onChangeText={setFrequency} keyboardType="numeric" />
        </View>
      )}

      <Text style={styles.label}>아이콘 선택</Text>
      <View style={styles.iconContainer}>
        {icons.map((icon) => (
          <TouchableOpacity
            key={icon}
            style={[styles.iconButton, selectedIcon === icon && styles.selectedIcon]}
            onPress={() => setSelectedIcon(icon)}
          >
            <Ionicons name={icon} size={24} color="black" />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>색상 선택</Text>
      <View style={styles.colorContainer}>
        {colors.map((color) => (
          <TouchableOpacity
            key={color}
            style={[styles.colorButton, { backgroundColor: color }, selectedColor === color && styles.selectedColor]}
            onPress={() => setSelectedColor(color)}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>저장</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F5FCFF",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  periodContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  iconContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  iconButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
  },
  selectedIcon: {
    backgroundColor: "#e0e0e0",
  },
  colorContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  colorButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  selectedColor: {
    borderWidth: 2,
    borderColor: "#000",
  },
  saveButton: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
})

export default GoalSettingScreen

