import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, TextInput } from "react-native"
import Modal from "react-native-modal"
import type { ChallengeMember } from "../types/challenge"

interface JoinChallengeModalProps {
  isVisible: boolean
  members: ChallengeMember[]
  onClose: () => void
  onJoin: () => void
  inputCode: string
  setInputCode: (text: string) => void
}

export default function JoinChallengeModal({
  isVisible,
  members,
  onClose,
  onJoin,
  inputCode,
  setInputCode,
}: JoinChallengeModalProps) {
  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      style={styles.modal}
      backdropOpacity={0.5}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <View style={styles.container}>
        <Text style={styles.title}>챌린지 참여��기</Text>
        <Text style={styles.subtitle}>현재 참여 중인 멤버</Text>

        <ScrollView style={styles.membersContainer}>
          {members.map((member) => (
            <View key={member.id} style={styles.memberItem}>
              <Image source={{ uri: member.profileImage }} style={styles.profileImage} />
              <Text style={styles.memberName}>{member.name}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="챌린지 그룹 코드 입력"
            value={inputCode}
            onChangeText={setInputCode}
          />
          <TouchableOpacity style={styles.joinButton} onPress={onJoin}>
            <Text style={styles.joinButtonText}>참여하기</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.description}>이 챌린지 그룹에 참여하시겠습니까?</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>취소</Text>
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
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#000000",
  },
  subtitle: {
    fontSize: 16,
    color: "#767676",
    marginBottom: 10,
  },
  membersContainer: {
    maxHeight: 200,
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#dde7ff",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  memberName: {
    fontSize: 16,
    color: "#000000",
  },
  description: {
    fontSize: 16,
    color: "#000000",
    textAlign: "center",
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#f8f8f8",
  },
  cancelButtonText: {
    color: "#000000",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  joinButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#387aff",
  },
  joinButtonText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
})

