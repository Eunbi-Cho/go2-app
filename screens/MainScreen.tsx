import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView } from "react-native"
import { Calendar, type DateData } from "react-native-calendars"

interface MarkedDates {
  [date: string]: { marked: boolean; dotColor: string }
}

const MainScreen: React.FC = () => {
  const [weeklyProgress, setWeeklyProgress] = useState(0)
  const [markedDates, setMarkedDates] = useState<MarkedDates>({})

  useEffect(() => {
    // TODO: Fetch actual goal progress data from your backend
    setWeeklyProgress(75)

    // TODO: Fetch actual achievement dates from your backend
    setMarkedDates({
      "2023-05-01": { marked: true, dotColor: "green" },
      "2023-05-03": { marked: true, dotColor: "green" },
      "2023-05-05": { marked: true, dotColor: "green" },
    })
  }, [])

  const onDayPress = (day: DateData) => {
    console.log("Selected day", day)
    // TODO: Handle day selection, e.g., show details of achievements for that day
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.progressContainer}>
        <Text style={styles.progressTitle}>이번주 목표 달성률</Text>
        <Text style={styles.progressText}>{weeklyProgress}%</Text>
      </View>
      <View style={styles.calendarContainer}>
        <Text style={styles.calendarTitle}>내 인증 컬렉션</Text>
        <Calendar
          markedDates={markedDates}
          onDayPress={onDayPress}
          theme={{
            backgroundColor: "#ffffff",
            calendarBackground: "#ffffff",
            textSectionTitleColor: "#b6c1cd",
            selectedDayBackgroundColor: "#00adf5",
            selectedDayTextColor: "#ffffff",
            todayTextColor: "#00adf5",
            dayTextColor: "#2d4150",
            textDisabledColor: "#d9e1e8",
            dotColor: "#00adf5",
            selectedDotColor: "#ffffff",
            arrowColor: "orange",
            monthTextColor: "blue",
            indicatorColor: "blue",
            textDayFontWeight: "300",
            textMonthFontWeight: "bold",
            textDayHeaderFontWeight: "300",
            textDayFontSize: 16,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 16,
          }}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FCFF",
  },
  progressContainer: {
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  progressText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  calendarContainer: {
    backgroundColor: "#fff",
    padding: 20,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
})

export default MainScreen

