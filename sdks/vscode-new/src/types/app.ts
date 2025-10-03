// Application state types
export interface AppState {
  currentSession: Session | null
  messages: Message[]
  currentMode: 'plan' | 'build'
  currentModel: Model | null
  recentlyUsedModels: ModelUsage[]
  isConnected: boolean
  serverPort: number | null
}

export interface Session {
  id: string
  title?: string
  createdAt: string | number
  updatedAt: string | number
  messageCount?: number
  revert?: {
    messageId?: string
    partId?: string
  }
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

// BUILD Mode: Permission types
export interface Permission {
  id: string
  sessionId: string
  type: 'edit' | 'bash' | 'webfetch'
  description: string
  metadata?: Record<string, any>
  createdAt: string
}

// BUILD Mode: File change types
export interface FileChange {
  filePath: string
  type: 'added' | 'modified' | 'deleted'
  diff?: string
  preview?: string
  lineCount?: number
}

// BUILD Mode: Diff types
export interface DiffLine {
  oldLineNo: number
  newLineNo: number
  kind: 'context' | 'added' | 'removed'
  content: string
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface DiffResult {
  oldFile: string
  newFile: string
  hunks: DiffHunk[]
}
