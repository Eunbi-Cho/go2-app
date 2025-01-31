import type React from "react"
import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from "react-native"
import * as ImagePicker from "expo-image-picker"
// import ViewShot, { type ViewShotProperties } from "react-native-view-shot"
import firestore, { type FirebaseFirestoreTypes } from "@react-native-firebase/firestore"

interface ImagePickerModalProps {
  visible: boolean
  onClose: () => void
  onImageSelected: (imageUri: string, timestamp: FirebaseFirestoreTypes.Timestamp) => void
}

const ImagePickerModal: React.FC<ImagePickerModalProps> = ({ visible, onClose, onImageSelected }) => {
  // const viewShotRef = useRef<ViewShot & ViewShotProperties>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const requestPermission = async (permissionType: "camera" | "mediaLibrary") => {
    if (permissionType === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      return status === "granted"
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      return status === "granted"
    }
  }

  const handleCameraLaunch = async () => {
    const hasPermission = await requestPermission("camera")
    if (!hasPermission) {
      Alert.alert(
        "카메라 권한 필요",
        "이 기능을 사용하려면 카메라 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.",
        [{ text: "확인" }],
      )
      return
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      Alert.alert("오류", "카메라에 접근하는 중 오류가 발생했습니다.")
    }
  }

  const handleGalleryLaunch = async () => {
    const hasPermission = await requestPermission("mediaLibrary")
    if (!hasPermission) {
      Alert.alert(
        "갤러리 권한 필요",
        "이 기능을 사용하려면 갤러리 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.",
        [{ text: "확인" }],
      )
      return
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error accessing photo library:", error)
      Alert.alert("오류", "갤러리에 접근하는 중 오류가 발생했습니다.")
    }
  }

  const handleConfirm = async () => {
    if (!selectedImage) return

    const timestamp = firestore.Timestamp.now()

    try {
      // Instead of using ViewShot, we'll use the selectedImage directly
      onImageSelected(selectedImage, timestamp)
      onClose()
      setSelectedImage(null)
    } catch (error) {
      console.error("Error processing image:", error)
      Alert.alert("오류", "이미지를 처리하는 중 오류가 발생했습니다.")
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>사진 선택</Text>
          <TouchableOpacity style={styles.optionButton} onPress={handleCameraLaunch}>
            <Text style={styles.optionButtonText}>카메라로 촬영</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionButton} onPress={handleGalleryLaunch}>
            <Text style={styles.optionButtonText}>갤러리에서 선택</Text>
          </TouchableOpacity>
          {selectedImage && (
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>확인</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* {selectedImage && (
        <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }} style={styles.viewShot}>
          <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
          <View style={styles.timestampOverlay}>
            <Text style={styles.timestampText}>
              {new Date().toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}
            </Text>
          </View>
        </ViewShot>
      )} */}
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    width: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#000000",
  },
  optionButton: {
    backgroundColor: "#387aff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  optionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    textAlign: "center",
  },
  confirmButton: {
    backgroundColor: "#387aff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 16,
    textAlign: "center",
  },
  closeButton: {
    marginTop: 10,
    padding: 15,
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
  },
  closeButtonText: {
    color: "#000000",
    fontSize: 16,
    textAlign: "center",
  },
  // viewShot: {
  //   position: "absolute",
  //   width: 1,
  //   height: 1,
  //   opacity: 0,
  // },
  selectedImage: {
    width: 300,
    height: 400,
    resizeMode: "cover",
  },
  // timestampOverlay: {
  //   position: "absolute",
  //   top: 0,
  //   left: 0,
  //   right: 0,
  //   bottom: 0,
  //   justifyContent: "center",
  //   alignItems: "center",
  //   backgroundColor: "rgba(0, 0, 0, 0.3)",
  // },
  // timestampText: {
  //   color: "#ffffff",
  //   fontSize: 18,
  //   fontWeight: "bold",
  // },
})

export default ImagePickerModal

