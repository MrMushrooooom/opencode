// @ts-ignore
import * as opencode from '@opencode-ai/sdk'

/**
 * Message structure combining Message info with Parts array
 * Provides complete message representation for the application
 */
export interface MessageStruct {
  info: opencode.Message
  parts: opencode.Part[]
}

/**
 * Application state structure managing core OpenCode application state
 * Manages providers, models, sessions, messages, and permissions
 */
export interface AppStruct {
  // Core application types
  project: opencode.Project | null
  agents: opencode.Agent[]
  providers: opencode.Provider[]
  config: opencode.Config | null
  client: opencode.OpencodeClient | null  // Fixed: was any | null
  
  // Session and messages
  session: opencode.Session | null
  messages: MessageStruct[]
  
  // Provider and model selection
  provider: opencode.Provider | null
  model: opencode.Model | null
  
  // Permissions
  permissions: opencode.Permission[]
  currentPermission: opencode.Permission | null
  
  // VSCode-specific state
  workspacePath: string
  isConnected: boolean
  serverPort: number | null
  isServerRunning: boolean
}

/**
 * Persistent state structure for user preferences and usage tracking
 * Stores user preferences, recent usage history, and message history
 */
export interface StateStruct {
  // User preferences
  theme: string
  agent: string
  provider: string  // Only store ID, not full object
  model: string     // Only store ID, not full object
  
  // Agent model mapping for storing preferred model per agent
  agentModel: Record<string, AgentModel>
  
  // Recently used tracking for models and agents
  recentlyUsedModels: ModelUsage[]
  recentlyUsedAgents: AgentUsage[]
  
  // Message history for prompt autocomplete
  messageHistory: Prompt[]
  
  // UI settings
  showToolDetails: boolean
  showThinkingBlocks: boolean
  
  // VSCode-specific settings
  workspacePath: string
  autoStartServer: boolean
  serverPort: number
  
  // Session management
  currentSessionId?: string
}

/**
 * Prompt structure for message history
 * Stores user prompt text with optional file attachments
 */
export interface Prompt {
  text: string
  attachments: opencode.File[]
}

/**
 * Model usage tracking structure
 * Tracks recently used provider-model combinations with timestamps
 */
export interface ModelUsage {
  providerID: string
  modelID: string
  lastUsed: number
}

/**
 * Agent usage tracking structure
 * Tracks recently used agents with timestamps
 */
export interface AgentUsage {
  agentName: string
  lastUsed: number
}

/**
 * Agent model mapping structure
 * Maps agent names to preferred provider-model combinations
 */
export interface AgentModel {
  providerID: string
  modelID: string
}

/**
 * VSCode-specific file change tracking
 * Extends File type with VSCode UI-specific metadata
 */
export interface FileChange {
  // File object from OpenCode API
  file: opencode.File
  
  // VSCode-specific UI enhancements
  diff?: string
  preview?: string
  lineCount?: number
}