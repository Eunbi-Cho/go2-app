import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native"

interface Friend {
  id: string
  name: string
  progress: number
}

const FriendsScreen: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([])

  useEffect(() => {
    // TODO: Fetch friends list from your backend
    // For now, we'll use mock data
    setFriends([
      { id: "1", name: "김철수", progress: 80 },
      { id: "2", name: "이영희", progress: 65 },
      { id: "3", name: "박지성", progress: 90 },
    ])
  }, [])

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <Text style={styles.friendName}>{item.name}</Text>
      <Text style={styles.friendProgress}>{item.progress}%</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.title}>친구 목록</Text>
      <FlatList data={friends} renderItem={renderFriendItem} keyExtractor={(item) => item.id} />
      <TouchableOpacity style={styles.addButton}>
        <Text style={styles.addButtonText}>친구 추가</Text>
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  friendItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  friendName: {
    fontSize: 18,
  },
  friendProgress: {
    fontSize: 16,
    color: "#4CAF50",
  },
  addButton: {
    backgroundColor: "#2196F3",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 20,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
})

export default FriendsScreen

