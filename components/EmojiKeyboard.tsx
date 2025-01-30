import type React from "react"
import { useState } from "react"
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ScrollView, Dimensions } from "react-native"
import Modal from "react-native-modal"

interface EmojiKeyboardProps {
  onEmojiSelect: (emoji: string) => void
  onClose: () => void
  isVisible: boolean
}

interface EmojiCategory {
  title: string
  icon: string
  emojis: string[]
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    title: "스포츠",
    icon: "⚽",
    emojis: [
      "⚽",
      "🏀",
      "⚾",
      "🎾",
      "🏐",
      "🎱",
      "⛳",
      "🤿",
      "🥋",
      "🛹",
      "🎿",
      "🛷",
      "🏄",
      "🏄‍♂️",
      "🚴",
      "🚴‍♂️",
      "🧗‍♀️",
      "🏋️",
      "🏃",
      "🏊‍♂️",
      "🏸",
      "🎳",
      "🏑",
      "🏒",
    ],
  },
  {
    title: "표정",
    icon: "😊",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "😂",
      "☺️",
      "😊",
      "😇",
      "🙂",
      "🙃",
      "😉",
      "😌",
      "😍",
      "😘",
      "😋",
      "😛",
      "😝",
      "😜",
      "🤪",
      "🤨",
      "😎",
      "🥳",
    ],
  },
  {
    title: "제스처",
    icon: "👋",
    emojis: [
      "👋",
      "🤚",
      "✋",
      "🖐️",
      "👌",
      "🤌",
      "🤏",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "👇",
      "☝️",
      "👍",
      "👎",
      "✊",
      "👊",
      "🤛",
      "🤜",
      "👏",
    ],
  },
  {
    title: "음식",
    icon: "🍔",
    emojis: [
      "🍔",
      "🌭",
      "🍕",
      "🥪",
      "🌮",
      "🌯",
      "🍜",
      "🍝",
      "🍣",
      "🍱",
      "🍙",
      "🍚",
      "🍰",
      "🧁",
      "🍦",
      "🍨",
      "🍩",
      "🍪",
      "🍫",
      "🍭",
      "🍿",
      "🥤",
      "🍴",
      "🥢",
    ],
  },
  {
    title: "동물",
    icon: "🐶",
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🦄",
      "🐢",
      "🦋",
      "🐟",
      "🐬",
      "🦈",
      "🦘",
      "🦒",
      "🦬",
    ],
  },
  {
    title: "기타",
    icon: "🌈",
    emojis: [
      "🌈",
      "📚",
      "🎬",
      "🎵",
      "🚗",
      "🏁",
      "🎮",
      "📱",
      "💻",
      "📷",
      "🎨",
      "🎭",
      "🎪",
      "🎢",
      "🎡",
      "🎯",
      "🎲",
      "🎰",
      "🎧",
      "📺",
      "🔮",
      "🎁",
      "🏆",
      "🎉",
    ],
  },
  {
    title: "축하/기념",
    icon: "🎉",
    emojis: [
      "🎉",
      "🎊",
      "💯",
      "🎁",
      "🛍️",
      "🧧",
      "💰",
      "👰",
      "🤵",
      "💍",
      "🔮",
      "🌹",
      "🌷",
      "🌸",
      "🌺",
      "🍀",
      "🌿",
      "🎄",
      "🎋",
      "🍁",
      "🏆",
      "🥇",
      "🥈",
      "🥉",
    ],
  },
  {
    title: "업무",
    icon: "💼",
    emojis: [
      "💼",
      "📚",
      "📖",
      "🔍",
      "✏️",
      "📝",
      "📋",
      "📈",
      "📉",
      "📊",
      "💡",
      "💸",
      "💵",
      "💰",
      "⏰",
      "⌚",
      "💻",
      "🖥️",
      "📸",
      "🗣️",
      "💤",
      "🚽",
      "📎",
      "✒️",
    ],
  },
  {
    title: "교통",
    icon: "🚗",
    emojis: [
      "🚗",
      "🚕",
      "🚙",
      "🛵",
      "🚌",
      "🚒",
      "🚅",
      "✈️",
      "🚀",
      "🗽",
      "🗼",
      "🎡",
      "🎢",
      "☂️",
      "⛱️",
      "👙",
      "👗",
      "🎀",
      "🛒",
      "🛍️",
      "⛰️",
      "⛺",
      "🏠",
      "🚡",
    ],
  },
  {
    title: "국기",
    icon: "🏁",
    emojis: [
      "🏁",
      "🚩",
      "🏴",
      "🏳️",
      "🏳️‍🌈",
      "🏳️‍⚧️",
      "🏴‍☠️",
      "🇺🇳",
      "🇦🇴",
      "🇧🇫",
      "🇧🇮",
      "🇧🇼",
      "🇨🇫",
      "🇨🇩",
      "🇨🇻",
      "🇩🇯",
      "🇪🇷",
      "🇪🇹",
      "🇬🇲",
      "🇬🇼",
      "🇰🇪",
      "🇱🇸",
      "🇲🇬",
      "🇲🇱",
    ],
  },
]

const { height: SCREEN_HEIGHT } = Dimensions.get("window")
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.5

const EmojiKeyboard: React.FC<EmojiKeyboardProps> = ({ onEmojiSelect, onClose, isVisible }) => {
  const [selectedCategory, setSelectedCategory] = useState(0)

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection={["down"]}
      style={styles.modal}
      propagateSwipe
      backdropOpacity={0.5}
    >
      <View style={styles.container}>
        <View style={styles.handleBar} />
        <FlatList
          data={EMOJI_CATEGORIES[selectedCategory].emojis}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.emojiItem} onPress={() => onEmojiSelect(item)}>
              <Text style={styles.emojiText}>{item}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item, index) => index.toString()}
          numColumns={6}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.emojiList}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryContainer}>
          {EMOJI_CATEGORIES.map((category, index) => (
            <TouchableOpacity
              key={category.title}
              style={[styles.categoryButton, selectedCategory === index && styles.selectedCategory]}
              onPress={() => setSelectedCategory(index)}
            >
              <Text style={styles.categoryText}>{category.icon}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  container: {
    height: MODAL_HEIGHT,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#a5a5a5",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  emojiList: {
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  emojiItem: {
    width: "16.666%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiText: {
    fontSize: 32,
  },
  categoryContainer: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#f8f8f8",
  },
  categoryButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    marginHorizontal: 4,
  },
  selectedCategory: {
    backgroundColor: "#f8f8f8",
  },
  categoryText: {
    fontSize: 24,
  },
})

export default EmojiKeyboard

