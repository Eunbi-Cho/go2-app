import type React from "react"
import { View, Text, StyleSheet } from "react-native"
import type { Goal } from "../types/goal"
import CircularProgress from "./CircularProgress"
import { lightenColor } from "../utils/colorUtils"

interface GoalIconsProps {
  goals: Goal[]
  size?: number
  lightColor?: boolean
}

const GoalIcons: React.FC<GoalIconsProps> = ({ goals, size = 24, lightColor = false }) => {
  return (
    <View style={styles.container}>
      {goals.map((goal, index) => {
        const progress = (goal.progress / goal.weeklyGoal) * 100
        const backgroundColor = lightColor ? lightenColor(goal.color, 0.6) : goal.color
        return (
          <View
            key={goal.id}
            style={[
              styles.iconWrapper,
              {
                left: index * (size * 0.7),
                width: size,
                height: size,
                zIndex: goals.length - index,
              },
            ]}
          >
            <CircularProgress size={size} strokeWidth={2} progress={progress} color={goal.color} />
            <View
              style={[
                styles.iconContainer,
                {
                  width: size * 0.9,
                  height: size * 0.9,
                  backgroundColor,
                },
              ]}
            >
              <Text style={[styles.icon, { fontSize: size * 0.5 }]}>{goal.icon}</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrapper: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    position: "absolute",
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    textAlign: "center",
  },
})

export default GoalIcons

