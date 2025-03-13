export interface EmojiReaction {
    id: string
    certificationId: string
    emoji: string
    userId: string
    timestamp: any // firestore.Timestamp
  }
  
  export interface GroupedEmojiReaction {
    emoji: string
    count: number
    userIds: string[]
    reactionIds: string[]
  }
  
  