export interface AIOptions {
  model?: string
  maxTokens?: number
  systemPrompt?: string
  imageBase64?: string
  imageMimeType?: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
}

export interface AIResponse {
  content: string
  promptTokens: number
  completionTokens: number
  model: string
}

export interface AIProvider {
  runPrompt(prompt: string, options?: AIOptions): Promise<AIResponse>
  streamPrompt?(prompt: string, options?: AIOptions): AsyncIterable<string>
}
