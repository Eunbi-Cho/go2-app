export interface User {
  id: string // This is typically used as the uid
  username: string
  email: string
  profileImageUrl?: string
  nickname?: string // Adding this as it's used in the ChallengeScreen
  challengeGroupId?: string // Adding this as it might be useful
  uid?: string // Add this line to include the uid property
}

