import { create } from 'zustand'
import type { 
  FrontendAppState, 
  Session, 
  Provider,
  Model,
  Agent,
  Message,
  FrontendFileChange,
  FrontendPart,
  Permission
} from '../types'

/**
 * Application state management using Zustand
 * Provides centralized state management for the WebView frontend
 * Uses frontend-optimized types for better performance and type safety
 */
export const useAppStore = create<FrontendAppState>((set, get) => ({
  // Session management
  sessions: [],
  currentSession: null,
  
  // Permission management
  permissions: [],
  currentPermission: null,
  
  // Message management
  messages: [],
  isStreaming: false,
  currentStreamingMessage: undefined,
  queuedMessages: [],
  
  // Provider and model management
  providers: [],
  currentProvider: null,
  currentModel: null,
  
  // Agent management
  agents: [],
  currentAgent: null,
  
  // UI state
  mode: 'plan',
  status: 'ready',
  error: null,
  editingMessageId: null,
  
  // Build mode specific
  fileChanges: [],
  canUndo: false,
  canRedo: false,
  
  // Settings
  showThinkingBlocks: false,
  showToolDetails: false,
  
  // Actions
  setSessions: (sessions: readonly Session[]) => set({ sessions }),
  
  setCurrentSession: (session: Session | null) => set({ currentSession: session }),
  
  addSession: (session: Session) => set((state) => ({
    sessions: [session, ...(state.sessions || [])]
  })),
  
  setPermissions: (permissions: readonly Permission[]) => set({ permissions }),
  
  addPermission: (permission: Permission) => set((state) => ({
    permissions: [...state.permissions, permission],
    currentPermission: state.currentPermission || permission
  })),
  
  removePermission: (permissionId: string) => set((state) => {
    const updatedPermissions = state.permissions.filter((p: Permission) => p.id !== permissionId)
    return {
      permissions: updatedPermissions,
      currentPermission: state.currentPermission?.id === permissionId 
        ? (updatedPermissions[0] || null)
        : state.currentPermission
    }
  }),
  
  setCurrentPermission: (permission: Permission | null) => set({ currentPermission: permission }),
  
  updateSession: (sessionId: string, updates: Partial<Session>) => set((state) => ({
    sessions: (state.sessions || []).map(session =>
      session.id === sessionId ? { ...session, ...updates } : session
    ),
    currentSession: state.currentSession?.id === sessionId
      ? { ...state.currentSession, ...updates }
      : state.currentSession
  })),
  
  deleteSession: (sessionId: string) => set((state) => ({
    sessions: (state.sessions || []).filter(session => session.id !== sessionId),
    currentSession: state.currentSession?.id === sessionId ? null : state.currentSession
  })),
  
  setMessages: (messages: readonly Message[]) => set({ messages }),
  
  addMessage: (message: Message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  updateMessage: (messageId: string, updates: Partial<Message>) => set((state) => ({
    messages: state.messages.map(message =>
      message.info.id === messageId ? { ...message, ...updates } : message
    )
  })),
  
  updateMessagePart: (messageId: string, part: FrontendPart) => set((state) => ({
    messages: state.messages.map(message => {
      if (message.info.id === messageId) {
        // Find existing part by ID or add new one if not found
        const existingPartIndex = message.parts.findIndex((p: FrontendPart) => (p as any).id === (part as any).id)
        if (existingPartIndex !== -1) {
          // Update existing part
          const updatedParts = [...message.parts]
          updatedParts[existingPartIndex] = part
          return { ...message, parts: updatedParts }
        } else {
          // Add new part
          return { ...message, parts: [...message.parts, part] }
        }
      }
      return message
    })
  })),
  
  setStreaming: (isStreaming: boolean, messageId?: string) => set({
    isStreaming,
    currentStreamingMessage: messageId
  }),
  
  setQueuedMessages: (queuedMessages: readonly string[]) => set({ queuedMessages }),
  
  updateQueuedMessages: () => set((state) => {
    // Find the last incomplete assistant message to determine queued messages
    let lastAssistantMessageId = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz" // Default high value
    
    // Iterate backwards through messages to find last incomplete assistant message
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const message = state.messages[i]
      if (message.info.role === 'assistant') {
        const assistantMsg = message.info as any
        if (assistantMsg.time?.completed > 0) {
          // This assistant message is completed, stop looking
          break
        }
        // This assistant message is incomplete, use its ID
        lastAssistantMessageId = assistantMsg.id
        break
      }
    }
    
    // Find all user messages that should be queued
    const queuedMessageIds = state.messages
      .filter(msg => msg.info.role === 'user')
      .map(msg => msg.info.id)
      .filter(msgId => msgId > lastAssistantMessageId)
    
    return { queuedMessages: queuedMessageIds }
  }),
  
  setProviders: (providers: readonly Provider[]) => set({ providers }),
  
  setCurrentProvider: (provider: Provider | null) => set({ currentProvider: provider }),
  
  setCurrentModel: (model: Model | null) => set({ currentModel: model }),
  
  setAgents: (agents: readonly Agent[]) => set({ agents }),
  
  setCurrentAgent: (agent: Agent | null) => set({ currentAgent: agent }),
  
  setMode: (mode: 'plan' | 'build') => set({ mode }),
  
  setStatus: (status: 'ready' | 'sending' | 'generating' | 'error') => set({ status }),
  
  setError: (error: string | null) => set({ error }),
  
  setFileChanges: (fileChanges: readonly FrontendFileChange[]) => set({ fileChanges }),
  
  setUndoRedoState: (canUndo: boolean, canRedo: boolean) => set({ canUndo, canRedo }),
  
  setShowThinkingBlocks: (show: boolean) => set({ showThinkingBlocks: show }),
  
  setShowToolDetails: (show: boolean) => set({ showToolDetails: show }),
  
  setEditingMessageId: (messageId: string | null) => set({ editingMessageId: messageId }),
  
  clearMessages: () => set({ messages: [] }),
  
  reset: () => set({
    sessions: [],
    currentSession: null,
    permissions: [],
    currentPermission: null,
    messages: [],
    isStreaming: false,
    currentStreamingMessage: undefined,
    providers: [],
    currentProvider: null,
    currentModel: null,
    agents: [],
    currentAgent: null,
    mode: 'plan',
    status: 'ready',
    error: null,
    editingMessageId: null,
    fileChanges: [],
    canUndo: false,
    canRedo: false,
    showThinkingBlocks: false,
    showToolDetails: false
  })
}))

/**
 * Selector hooks for optimized re-renders
 */
export const useSessions = () => useAppStore(state => state.sessions)
export const useCurrentSession = () => useAppStore(state => state.currentSession)
export const useMessages = () => useAppStore(state => state.messages)
export const useStreaming = () => useAppStore(state => ({
  isStreaming: state.isStreaming,
  currentStreamingMessage: state.currentStreamingMessage
}))
export const useProviders = () => useAppStore(state => state.providers)
export const useCurrentProvider = () => useAppStore(state => state.currentProvider)
export const useCurrentModel = () => useAppStore(state => state.currentModel)
export const useMode = () => useAppStore(state => state.mode)
export const useStatus = () => useAppStore(state => state.status)
export const useFileChanges = () => useAppStore(state => state.fileChanges)
export const useUndoRedoState = () => useAppStore(state => ({
  canUndo: state.canUndo,
  canRedo: state.canRedo
}))
export const useSettings = () => useAppStore(state => ({
  showThinkingBlocks: state.showThinkingBlocks,
  showToolDetails: state.showToolDetails
}))
export const useCurrentPermission = () => useAppStore(state => state.currentPermission)
