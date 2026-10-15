export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  readonly id: string
  readonly sessionId: string
  readonly role: ChatRole
  readonly content: string
  readonly createdAt: Date
}

export const createChatMessage = (params: ChatMessage): ChatMessage => ({ ...params })
