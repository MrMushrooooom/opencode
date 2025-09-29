// Application state types
export interface AppState {
  currentSession: Session | null
  sessions: Session[]
  messages: Message[]
  currentMode: 'plan' | 'build'
  currentModel: Model | null
  availableModels: Model[]
  providers: Provider[]
  recentlyUsedModels: ModelUsage[]
  isConnected: boolean
  serverPort: number | null
}

export interface Session {
  id: string
  title?: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  mode?: 'plan' | 'build'
}

export interface Model {
  id: string
  providerId: string
  name: string
  description?: string
}

export interface Provider {
  id: string
  name: string
  models: Model[]
}

export interface ModelUsage {
  providerId: string
  modelId: string
  lastUsed: number
}

export interface PromptParams {
  text: string
  mode: 'plan' | 'build'
  sessionId?: string
}

export interface PromptResponse {
  content: string
  messageId: string
  sessionId: string
}
