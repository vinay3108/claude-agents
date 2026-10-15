import type { ChatMessage, ChatRole } from '../entities/ChatMessage'

export interface ICoachChatRepository {
  findOrCreateSession(userId: string): Promise<{ id: string }>
  getMessages(sessionId: string, limit: number): Promise<ChatMessage[]>
  addMessage(params: { sessionId: string; role: ChatRole; content: string }): Promise<ChatMessage>
  clearMessages(sessionId: string): Promise<void>
}
