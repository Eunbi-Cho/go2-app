import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();

export const onCertificationCreated = onDocumentCreated(
  "certifications/{certificationId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return;
    }

    const newCertification = snapshot.data();
    const userId = newCertification.userId;

    // 사용자의 챌린지 그룹 ID 가져오기
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    const challengeGroupId = userDoc.data()?.challengeGroupId;

    if (!challengeGroupId) {
      console.log("User is not in a challenge group");
      return;
    }

    // 그룹 멤버 가져오기
    const groupMembers = await admin
      .firestore()
      .collection("users")
      .where("challengeGroupId", "==", challengeGroupId)
      .get();

    const promises = groupMembers.docs.map(async (memberDoc) => {
      const memberId = memberDoc.id;
      if (memberId === userId) return; // 인증샷을 올린 사용자에게는 알림을 보내지 않음

      const token = memberDoc.data().fcmToken;
      if (!token) return;

      const message = {
        notification: {
          title: "새로운 인증샷",
          body: `${userDoc.data()?.nickname}님이 새로운 인증샷을 올렸습니다!`,
        },
        token: token,
      };

      try {
        await admin.messaging().send(message);
        console.log("Successfully sent message to:", memberId);
      } catch (error) {
        console.log("Error sending message to:", memberId, error);
      }
    });

    await Promise.all(promises);
  }
);
