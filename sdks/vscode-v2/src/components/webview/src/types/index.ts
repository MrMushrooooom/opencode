/**
 * Frontend type definitions for WebView components
 * Minimal type definitions - directly use API types where possible
 */

// Import API types directly - no need for re-export
// @ts-ignore
import type { Provider, Model, Session, Agent, Message, Permission, Part } from "@opencode-ai/sdk"

// Re-export API types for convenience
export type { Provider, Model, Session, Agent, Message, Part }

/**
 * Message part types for chat interface
 * These are specific to the frontend UI and don't exist in API types
 */
export interface FrontendTextPart {
  readonly type: "text"
  readonly content: string
}

export interface FrontendReasoningPart {
  readonly type: "reasoning"
  readonly content: string
}

export interface FrontendToolPart {
  readonly type: "tool"
  readonly tool: {
    readonly name: string
    readonly input: unknown
    readonly output?: unknown
    readonly error?: string
  }
}

export interface FrontendPart {
  readonly type: "text" | "reasoning" | "tool"
  readonly content?: string
  readonly tool?: {
    readonly name: string
    readonly input: unknown
    readonly output?: unknown
    readonly error?: string
  }
}

/**
 * File change representation for build mode
 * Enhanced structure with line statistics and message association
 */
export interface FrontendFileChange {
  readonly filePath: string
  readonly type: "create" | "modify" | "delete"
  readonly addedLines: number
  readonly removedLines: number
  readonly diff?: string
  readonly originalContent?: string
  readonly modifiedContent?: string
  readonly messageId: string
  readonly partId: string
  readonly toolName: string
}

/**
 * WebView message types for frontend-backend communication
 * These define the message structure for WebView communication
 */
export interface WebViewMessage {
  readonly type: string
  readonly data?: unknown
  readonly message?: string
  readonly providerId?: string
  readonly modelId?: string
}

/**
 * WebView service interface for frontend-backend communication
 */
export interface WebViewService {
  sendMessage(message: WebViewMessage): void
  postMessage(message: WebViewMessage): void
  onMessage(handler: (message: any) => void): void
  openFile(filePath: string): void
  openExternal(url: string): void
}

/**
 * Frontend application state interface
 * This defines the complete state structure for the frontend Zustand store
 * Contains both business data (from backend) and UI state (frontend-specific)
 */
export interface FrontendAppState {
  // Business data (synchronized from backend)
  readonly providers: readonly Provider[]
  readonly currentProvider: Provider | null
  readonly currentModel: Model | null

  readonly agents: readonly Agent[]
  readonly currentAgent: Agent | null

  readonly sessions: readonly Session[]
  readonly currentSession: Session | null

  readonly permissions: readonly any[]
  readonly currentPermission: any | null

  readonly messages: readonly Message[]
  readonly isStreaming: boolean
  readonly streamingMessageId?: string
  readonly currentStreamingMessage?: string
  readonly queuedMessages: readonly string[] // Message IDs that are queued

  // UI state (frontend-specific)
  readonly mode: "plan" | "build"
  readonly status: "ready" | "sending" | "generating" | "error"
  readonly error: string | null
  readonly editingMessageId: string | null

  readonly canUndo: boolean
  readonly canRedo: boolean

  // UI settings (frontend-specific)
  readonly showThinkingBlocks: boolean
  readonly showToolDetails: boolean

  // Store methods
  setSessions: (sessions: readonly Session[]) => void
  setCurrentSession: (session: Session | null) => void
  addSession: (session: Session) => void

  setPermissions: (permissions: readonly any[]) => void
  addPermission: (permission: any) => void
  removePermission: (permissionId: string) => void
  setCurrentPermission: (permission: any | null) => void

  setMessages: (messages: readonly Message[]) => void
  addMessage: (message: Message) => void
  updateMessage: (messageId: string, updates: Partial<Message>) => void
  updateMessagePart: (messageId: string, part: FrontendPart) => void
  clearMessages: () => void

  setStreaming: (isStreaming: boolean, messageId?: string) => void
  setQueuedMessages: (queuedMessages: readonly string[]) => void
  updateQueuedMessages: () => void

  setProviders: (providers: readonly Provider[]) => void
  setCurrentProvider: (provider: Provider | null) => void
  setCurrentModel: (model: Model | null) => void

  setAgents: (agents: readonly Agent[]) => void
  setCurrentAgent: (agent: Agent | null) => void

  setMode: (mode: "plan" | "build") => void
  setStatus: (status: "ready" | "sending" | "generating" | "error") => void
  setError: (error: string | null) => void

  setUndoRedoState: (canUndo: boolean, canRedo: boolean) => void

  setShowThinkingBlocks: (show: boolean) => void
  setShowToolDetails: (show: boolean) => void

  setEditingMessageId: (messageId: string | null) => void

  reset: () => void
}
