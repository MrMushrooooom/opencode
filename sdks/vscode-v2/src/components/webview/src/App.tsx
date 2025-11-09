import React from 'react'
import { Layout, Typography, Space, Button, Card } from 'antd'
import { useAppStore, useSessions, useCurrentSession, useMessages, useStreaming, useMode, useStatus, useFileChanges, useCurrentProvider, useCurrentModel, useCurrentPermission } from './store'
import { webViewService } from './services/webviewService'
import { ChatArea } from './components/Chat/ChatArea'
import { InputArea } from './components/Chat/InputArea'
import { FileChanges } from './components/BuildMode/FileChanges'

const { Content } = Layout

/**
 * Main application component
 * Orchestrates all UI components and manages application state
 */
export const App: React.FC = () => {
  const sessions = useSessions()
  const currentSession = useCurrentSession()
  const messages = useMessages()
  const { isStreaming } = useStreaming()
  const queuedMessages = useAppStore(state => state.queuedMessages)
  const mode = useMode()
  const status = useStatus()
  const fileChanges = useFileChanges()
  const currentProvider = useCurrentProvider()
  const currentModel = useCurrentModel()
  const currentPermission = useCurrentPermission()
  
  // Get store methods using proper Zustand pattern
  const setCurrentSession = useAppStore(state => state.setCurrentSession)
  const setMode = useAppStore(state => state.setMode)
  const setStatus = useAppStore(state => state.setStatus)
  const setError = useAppStore(state => state.setError)
  const setStreaming = useAppStore(state => state.setStreaming)
  const addMessage = useAppStore(state => state.addMessage)
  const updateMessage = useAppStore(state => state.updateMessage)
  const updateMessagePart = useAppStore(state => state.updateMessagePart)
  const setFileChanges = useAppStore(state => state.setFileChanges)
  const setCurrentPermission = useAppStore(state => state.setCurrentPermission)
  const removePermission = useAppStore(state => state.removePermission)
  const setUndoRedoState = useAppStore(state => state.setUndoRedoState)

  // Notification state for small messages above input
  const [notification, setNotification] = React.useState<{ message: string; type: 'info' | 'warning' } | null>(null)

  // Initialize message handling
  React.useEffect(() => {
    const handleMessage = (message: any) => {
      /**
       * Clear streaming state and reset UI to ready state
       * Called when streaming completes, session becomes idle, or an error occurs
       * Ensures consistent state cleanup across all stream termination scenarios
       */
      const clearStreamingState = () => {
        setStreaming(false)
        setStatus('ready')
        useAppStore.getState().updateQueuedMessages()
      }

      switch (message.type) {
        case 'sessionsLoaded':
          const loadedSessions = message.data.sessions && Array.isArray(message.data.sessions) ? message.data.sessions : []
          useAppStore.getState().setSessions(loadedSessions)
          break
          
        case 'sessionCreated':
          useAppStore.getState().addSession(message.data.session)
          setCurrentSession(message.data.session)
          break
        
        case 'sessionUpdated':
          // Update specific session in the list
          // message.data format: { sessionId, updates: { title? } }
          if (message.data?.sessionId && message.data?.updates) {
            // Session updates are handled via sessionsUpdate from panel.ts
            // No need to update individual session here
          }
          break
          
        case 'sessionSwitched':
          setCurrentSession(message.data.session)
          // Ensure messages is an array
          const messages = message.data.messages || []
          webViewService.sendMessage({
            type: 'debug',
            data: { message: `[Frontend] sessionSwitched: received ${messages.length} messages` }
          })
          useAppStore.getState().setMessages(messages)
          // Scroll to bottom after session switch
          setTimeout(() => {
            const chatContainer = document.querySelector('[style*="flex: 1"]')
            if (chatContainer && chatContainer.scrollHeight) {
              chatContainer.scrollTop = chatContainer.scrollHeight
            }
          }, 100)
          break
          
        case 'messagesLoaded':
          const loadedMessages = message.data?.messages && Array.isArray(message.data.messages) ? message.data.messages : []
          useAppStore.getState().setMessages(loadedMessages)
          break
          
        case 'permissionRequest':
          // Handle permission request from backend
          const permission = message.data.permission || message.data
          if (permission && permission.id) {
            useAppStore.getState().addPermission(permission)
            setCurrentPermission(permission)
          }
          break
          
        case 'permissionReplied':
          // Handle permission replied event - remove the permission
          const permissionID = message.data?.permissionID || message.data?.id
          if (permissionID) {
            removePermission(permissionID)
            if (currentPermission?.id === permissionID) {
              setCurrentPermission(null)
            }
          }
          break
          
        case 'messageAdded':
          addMessage(message.data.message)
          // Check if this message should be queued
          if (message.data.message.info.role === 'user') {
            const { updateQueuedMessages } = useAppStore.getState()
            updateQueuedMessages()
          }
          break
          
        case 'messageUpdated':
          // Update or add message with full data from backend
          if (message.data.message) {
            const { messages } = useAppStore.getState()
            const existingMessage = messages.find(m => m.info.id === message.data.messageId)
            
            if (existingMessage) {
              // Update existing message
              updateMessage(message.data.messageId, message.data.message)
            } else {
              // Add new message
              addMessage(message.data.message)
            }
          }
          break
          
        case 'messagePartUpdated':
          // Handle part updates (for bash output, tool results, etc.)
          if (message.data.message) {
            const { messages } = useAppStore.getState()
            const existingMessage = messages.find(m => m.info.id === message.data.messageId)
            
            if (existingMessage) {
              // Update message with new part data
              updateMessage(message.data.messageId, message.data.message)
            } else {
              // Add new message if it doesn't exist yet
              addMessage(message.data.message)
            }
            
            // Recalculate queued messages when assistant messages are updated
            useAppStore.getState().updateQueuedMessages()
          }
          break
          
        case 'streamingStarted':
          // No longer needed - MessageItem handles "Generating..." display
          break
          
        case 'streamingCompleted':
          clearStreamingState()
          break
          
        case 'sessionIdle':
          clearStreamingState()
          break
          
        case 'providersLoaded':
          useAppStore.getState().setProviders(message.data.providers)
          break
          
        case 'modelChanged':
          // Update both provider and model to maintain consistency
          // Provider may change when switching models (e.g., anthropic -> opencode)
          if (message.data.provider !== undefined) {
            useAppStore.getState().setCurrentProvider(message.data.provider)
          }
          if (message.data.model !== undefined) {
            useAppStore.getState().setCurrentModel(message.data.model)
          }
          break
          
        case 'modeChanged':
          setMode(message.data.mode)
          break
          
        case 'fileChangesUpdated':
          setFileChanges(message.data.fileChanges)
          break
          
        case 'undoRedoStateUpdated':
          setUndoRedoState(message.data.canUndo, message.data.canRedo)
          break
          
        case 'error':
          // Handle both formats: { data: { error: ... } } and { error: ... }
          const errorMessage = message.data?.error || message.error || message.data?.message || message.message || 'An error occurred'
          
          setNotification({ 
            message: errorMessage, 
            type: 'info' 
          })
          setTimeout(() => setNotification(null), 4000)
          
          // Mark the last empty assistant message as completed to hide "Generating..."
          // Use getState() to get the latest messages, not the closure value
          const currentMessages = useAppStore.getState().messages
          const lastAssistantMessage = [...currentMessages]
            .reverse()
            .find(msg => msg.info.role === 'assistant' && 
              (!msg.info.time.completed || msg.info.time.completed === 0) &&
              (msg.parts.length === 0 || !msg.parts.some((part: any) => 
                part.type === 'text' || part.type === 'reasoning' || part.type === 'tool'
              )))
          
          if (lastAssistantMessage) {
            // Mark message as completed by setting time.completed to current timestamp
            const now = Date.now() / 1000
            updateMessage(lastAssistantMessage.info.id, {
              ...lastAssistantMessage,
              info: {
                ...lastAssistantMessage.info,
                time: {
                  ...lastAssistantMessage.info.time,
                  completed: now
                }
              }
            })
          }
          
          clearStreamingState()
          break
          
        case 'statusUpdate':
          setStatus(message.data.status)
          break
          
        case 'stateUpdate':
          // Update the entire state from backend
          const state = message.data.state
          useAppStore.getState().setProviders(state.providers)
          useAppStore.getState().setCurrentProvider(state.currentProvider)
          useAppStore.getState().setCurrentModel(state.currentModel)
          useAppStore.getState().setAgents(state.agents)
          useAppStore.getState().setCurrentAgent(state.currentAgent)
          useAppStore.getState().setSessions(state.sessions || [])
          useAppStore.getState().setCurrentSession(state.currentSession)
          useAppStore.getState().setMode(state.mode)
          useAppStore.getState().setStatus(state.status)
          if (state.error) {
            useAppStore.getState().setError(state.error)
          }
          break
          
        case 'modelsUpdate':
          // Update models list - models is already a flat array from getAvailableModels()
          // We need to group them by provider
          const providersMap = new Map()
          if (message.data && message.data.models && Array.isArray(message.data.models)) {
            message.data.models.forEach((model: any) => {
              if (!providersMap.has(model.providerId)) {
                // Use providerName directly from model data (now included by backend)
                providersMap.set(model.providerId, {
                  id: model.providerId,
                  name: model.providerName || model.providerId, // Fallback to providerId if name missing
                  models: {}
                })
              }
              providersMap.get(model.providerId).models[model.id] = model
            })
          }
          useAppStore.getState().setProviders(Array.from(providersMap.values()))
          break
          
        case 'sessionsUpdate':
          // Update sessions list
          const sessions = message.data && message.data.sessions && Array.isArray(message.data.sessions) ? message.data.sessions : []
          useAppStore.getState().setSessions(sessions)
          break
          
        default:
          console.warn('Unknown message type:', message.type)
      }
    }

    webViewService.onMessage(handleMessage)
    
    // Request initial data
    webViewService.sendMessage({ type: 'initialize' })
  }, [])

  const handleSendPrompt = (text: string) => {
    if (!text.trim() || isStreaming) return
    
    setStatus('sending')
    webViewService.sendUserPrompt(text, mode)
  }

  const handleModeChange = (newMode: 'plan' | 'build') => {
    setMode(newMode)
    webViewService.sendMessage({
      type: 'changeMode',
      data: { mode: newMode }
    })
  }

  const handlePermissionRespond = (response: 'once' | 'always' | 'reject') => {
    if (!currentPermission) return
    
    const sessionID = currentSession?.id || ''
    const permissionID = currentPermission.id
    
    // Send response to backend
    // The permission will be removed when permission.replied event is received
    webViewService.respondToPermission(sessionID, permissionID, response)
  }

  return (
    <>
      <Layout style={{ height: '100vh', background: '#1e1e1e' }}>
      <Content style={{ 
        background: '#1e1e1e',
        padding: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Build Mode Controls */}
        {mode === 'build' && fileChanges.length > 0 && (
          <Card 
            size="small" 
            style={{ 
              marginBottom: '16px',
              background: '#252526',
              border: '1px solid #3e3e42'
            }}
          >
            <FileChanges fileChanges={fileChanges} />
          </Card>
        )}

        {/* Chat Area */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ChatArea 
            messages={messages}
            isStreaming={isStreaming}
            currentSession={currentSession}
            queuedMessages={queuedMessages}
          />
        </div>

        {/* Small notification above input */}
        {notification && (
          <div style={{
            marginBottom: '8px',
            padding: '4px 10px',
            background: '#2d2d30',
            border: '1px solid #3e3e42',
            borderRadius: '3px',
            color: '#cccccc',
            fontSize: '11px',
            textAlign: 'center'
          }}>
            {notification.message}
          </div>
        )}

        {/* Input Area */}
        <InputArea
          onSendPrompt={handleSendPrompt}
          mode={mode}
          onModeChange={handleModeChange}
          disabled={false}
          status={status}
        />
      </Content>
    </Layout>

    </>
  )
}
