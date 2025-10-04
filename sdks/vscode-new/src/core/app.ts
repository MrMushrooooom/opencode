import { OpenCodeAPI } from './api'
import { SessionManager } from './session'
import { MessageManager } from './message'
import { ModelManager } from './model'
import { ServerManager } from '../services/server'
import { EventStreamManager } from './stream'
import { AppState, Session, PromptParams, PromptResponse, Permission } from '../types/app'
import { PermissionManager } from './permission'
import { StateManager } from './state'
import { WebViewCommunicationManager } from './webview-communication'
import * as vscode from 'vscode'

/**
 * Main OpenCode Application
 * Coordinates all components and manages application state
 * Refactored to use dedicated managers for better separation of concerns
 */
export class OpenCodeApp {
  // Core components
  private api: OpenCodeAPI
  private sessionManager: SessionManager
  private messageManager: MessageManager
  private modelManager: ModelManager
  private serverManager: ServerManager
  private eventStreamManager: EventStreamManager | null = null

  // New managers
  private permissionManager: PermissionManager
  private stateManager: StateManager
  private webviewCommManager: WebViewCommunicationManager

  private outputChannel: vscode.OutputChannel
  private workspacePath: string

  constructor(outputChannel: vscode.OutputChannel, workspacePath: string) {
    this.outputChannel = outputChannel
    this.workspacePath = workspacePath

    // Initialize core components
    this.api = new OpenCodeAPI(outputChannel, workspacePath)
    this.serverManager = new ServerManager(outputChannel)
    this.modelManager = new ModelManager(this.api, outputChannel)
    this.sessionManager = new SessionManager(this.api, outputChannel)
    this.messageManager = new MessageManager(this.api, outputChannel, workspacePath)

    // Initialize new managers
    this.permissionManager = new PermissionManager(outputChannel)
    this.stateManager = new StateManager(outputChannel)
    this.webviewCommManager = new WebViewCommunicationManager(outputChannel)
    this.eventStreamManager = new EventStreamManager(this.api, outputChannel, this.webviewCommManager)
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    try {
      this.outputChannel.appendLine('🚀 Initializing OpenCode Application...')

      // Start server
      await this.serverManager.startServer()
      const port = this.serverManager.getServerPort()
      this.stateManager.setServerPort(port)

      // Initialize API with server URL
      await this.api.initialize(`http://localhost:${port}`)
      this.stateManager.setConnected(true)

      // Initialize model manager first
      await this.modelManager.initialize()
      
      // Set current model in state manager for consistency
      const currentModel = this.modelManager.getCurrentModel()
      if (currentModel) {
        this.stateManager.setCurrentModel(currentModel)
      }

      // Load sessions (but don't auto-select one - let user choose or create on first message)
      await this.sessionManager.loadSessions()
      const sessions = await this.sessionManager.getSessions()
      
      this.outputChannel.appendLine(`📋 Loaded ${sessions.length} existing sessions`)

      // Start SSE event stream for real-time updates
      await this.eventStreamManager!.startListening(
        (messageId: string, part: any) => {
          // Handle message part updates
          const content = this.messageManager.handleStreamingUpdate(messageId, part)
          // Send streaming update to webview
          this.webviewCommManager.sendStreamingUpdate(messageId, content, part.type, part.role)
        },
        (session: any) => {
          // Handle session updates - update current session if it matches
          if (this.stateManager.getCurrentSession()?.id === session.id) {
            this.stateManager.setCurrentSession(session)
          }
        },
        (permission: any) => {
          // Handle permission requests for BUILD mode
          this.permissionManager.addPermission(permission)
        }
      )

      // Set default current session if sessions exist (align with frontend behavior)
      if (sessions.length > 0 && !this.stateManager.getCurrentSession()) {
        const defaultSession = sessions[0]
        this.stateManager.setCurrentSession(defaultSession)
        this.outputChannel.appendLine(`📝 Set default current session: ${defaultSession.title}`)
      }

      this.outputChannel.appendLine('✅ OpenCode Application initialized successfully')
      
      // Update UI after initialization is complete to ensure all data is loaded
      const webviewPanel = this.webviewCommManager.getWebviewPanel()
      if (webviewPanel) {
        this.outputChannel.appendLine(`📡 Updating UI after initialization - panel is available`)
        webviewPanel.updateUI().catch((error: any) => {
          this.outputChannel.appendLine(`❌ Failed to update UI after initialization: ${error.message}`)
        })
      } else {
        this.outputChannel.appendLine(`⚠️ WebView panel not available during initialization - UI will be updated when panel is created`)
      }
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to initialize: ${error.message}`)
      throw error
    }
  }

  /**
   * Send a message to the current session
   * Following TUI approach: create session if none exists
   */
  async sendMessage(text: string, mode: 'plan' | 'build' = 'plan'): Promise<PromptResponse> {
    let currentSession = this.stateManager.getCurrentSession()
    
    // Create session if none exists (following TUI approach)
    if (!currentSession) {
      this.outputChannel.appendLine('📝 No active session, creating new session...')
      currentSession = await this.sessionManager.createNewSession()
      this.stateManager.setCurrentSession(currentSession)
      this.outputChannel.appendLine(`✅ Created new session: ${currentSession.id}`)
      
      // Notify frontend about the new session
      this.webviewCommManager.sendMessage({
        type: 'sessionCreated',
        session: currentSession
      })
    }

    try {
      // Update current mode
      this.stateManager.setCurrentMode(mode)

      // Send message using message manager
      const response = await this.messageManager.sendMessage({
        text,
        sessionId: currentSession.id,
        mode
      }, this.stateManager.getCurrentModel())

      this.outputChannel.appendLine(`✅ Message sent: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`)
      return response
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to send message: ${error.message}`)
      throw error
    }
  }

  /**
   * Get current session messages
   */
  async getCurrentSessionMessages(): Promise<any[]> {
    const currentSession = this.stateManager.getCurrentSession()
    if (!currentSession) {
      return []
    }

    return await this.messageManager.getMessagesForSession(currentSession.id)
  }

  /**
   * Get message manager
   */
  getMessageManager(): MessageManager {
    return this.messageManager
  }

  /**
   * Create a new session
   */
  async createNewSession(): Promise<Session> {
    try {
      const session = await this.sessionManager.createNewSession()
      this.stateManager.setCurrentSession(session)
      return session
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to create session: ${error.message}`)
      throw error
    }
  }

  /**
   * Switch to a specific session
   */
  async switchToSession(sessionId: string): Promise<void> {
    try {
      const session = await this.sessionManager.switchToSession(sessionId)
      this.stateManager.setCurrentSession(session)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to switch session: ${error.message}`)
      throw error
    }
  }

  /**
   * Get current application state
   */
  getState(): AppState {
    return this.stateManager.getState()
  }

  /**
   * Get current workspace path
   */
  getWorkspacePath(): string {
    return this.workspacePath
  }

  /**
   * Update application state
   */
  updateState(updates: Partial<AppState>): void {
    this.stateManager.updateState(updates)
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    return this.stateManager.getCurrentSession()
  }

  /**
   * Get all sessions
   */
  getSessions(): Session[] {
    return this.sessionManager.getSessions()
  }

  /**
   * Check if connected to server
   */
  isConnected(): boolean {
    return this.stateManager.isConnected()
  }

  /**
   * Get server status for debugging
   */
  getServerStatus(): any {
    return {
      isConnected: this.stateManager.isConnected(),
      serverPort: this.stateManager.getServerPort(),
      apiBaseURL: this.api.getBaseURL(),
      apiInitialized: this.api.isInitialized()
    }
  }

  /**
   * Get server port
   */
  getServerPort(): number | null {
    return this.stateManager.getServerPort()
  }

  /**
   * Switch to a different model
   */
  async switchModel(providerId: string, modelId: string): Promise<void> {
    try {
      const model = await this.modelManager.switchToModel(providerId, modelId)
      
      // Update current model in state manager for consistency
      this.stateManager.setCurrentModel(model)
      
      // Update recently used models in state manager
      const recentModels = this.stateManager.getRecentlyUsedModels()
      const updatedRecent = [model, ...recentModels.filter(m => m.id !== model.id)].slice(0, 5)
      this.stateManager.setRecentlyUsedModels(updatedRecent)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to switch model: ${error.message}`)
      throw error
    }
  }

  /**
   * Get current model
   */
  getCurrentModel(): any {
    return this.stateManager.getCurrentModel()
  }

  /**
   * Get available models
   */
  getAvailableModels(): any[] {
    return this.modelManager.getAllModels()
  }

  /**
   * Get model manager
   */
  getModelManager(): ModelManager {
    return this.modelManager
  }

  /**
   * Get providers
   */
  getProviders(): any[] {
    return this.modelManager.getProviders()
  }

  /**
   * Get recently used models
   */
  getRecentlyUsedModels(): any[] {
    return this.stateManager.getRecentlyUsedModels()
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      this.outputChannel.appendLine('🧹 Cleaning up OpenCode Application...')

      // Clear webview panel reference
      this.webviewCommManager.clearWebviewPanel()
      
      // Stop server if running
      if (this.serverManager) {
        await this.serverManager.stopServer()
      }

      this.outputChannel.appendLine('✅ Cleanup completed')
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Cleanup failed: ${error.message}`)
    }
  }

  /**
   * Set webview panel reference
   */
  setWebviewPanel(panel: any): void {
    this.webviewCommManager.setWebviewPanel(panel)
    this.permissionManager.setWebviewCommManager(this.webviewCommManager)
    
    // Don't call updateUI immediately - it will be called after initialization is complete
    // This prevents sending empty data before models and sessions are loaded
  }

  /**
   * Clear webview panel reference
   */
  clearWebviewPanel(): void {
    this.webviewCommManager.clearWebviewPanel()
  }

  /**
   * Update session properties
   */
  async updateSession(sessionId: string, updates: { title?: string }): Promise<any> {
    try {
      const session = await this.sessionManager.updateSession(sessionId, updates)
      // Update current session if it matches
      if (this.stateManager.getCurrentSession()?.id === sessionId) {
        this.stateManager.setCurrentSession(session)
      }
      return session
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to update session: ${error.message}`)
      throw error
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.sessionManager.deleteSession(sessionId)
      // Clear current session if it's the one being deleted
      if (this.stateManager.getCurrentSession()?.id === sessionId) {
        this.stateManager.setCurrentSession(null)
      }
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to delete session: ${error.message}`)
      throw error
    }
  }

  /**
   * Dispose of the application
   */
  async dispose(): Promise<void> {
    await this.cleanup()
  }

  // ===== BUILD Mode: Permission Management =====

  /**
   * Add a permission request
   */
  addPermission(permission: Permission): void {
    this.permissionManager.addPermission(permission)
  }

  /**
   * Respond to a specific permission request
   */
  async respondToPermission(permissionId: string, response: 'once' | 'always' | 'reject'): Promise<void> {
    await this.permissionManager.respondToPermissionById(permissionId, response)
  }

  /**
   * Get the current permission being processed
   */
  getCurrentPermission(): Permission | null {
    return this.permissionManager.getCurrentPermission()
  }

  /**
   * Get all pending permissions
   */
  getPendingPermissions(): Permission[] {
    return this.permissionManager.getPendingPermissions()
  }

  // ===== BUILD Mode: Undo/Redo Management =====

  /**
   * Undo to a specific message
   */
  async undoToMessage(messageId?: string, partId?: string): Promise<void> {
    const currentSession = this.stateManager.getCurrentSession()
    if (!currentSession) {
      throw new Error('No active session')
    }

    try {
      const revertedSession = await this.sessionManager.undoToMessage(
        currentSession.id,
        messageId,
        partId
      )
      this.stateManager.setCurrentSession(revertedSession)
      
      // Send undo success message to webview
      this.webviewCommManager.sendUndoSuccess(
        messageId,
        partId,
        this.sessionManager.calculateRevertInfo(revertedSession),
        this.sessionManager.getLastUserMessage()
      )
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to undo: ${error.message}`)
      throw error
    }
  }

  /**
   * Redo changes
   */
  async redoChanges(): Promise<void> {
    const currentSession = this.stateManager.getCurrentSession()
    if (!currentSession) {
      throw new Error('No active session')
    }

    try {
      const unrevertedSession = await this.sessionManager.redoChanges(currentSession.id)
      this.stateManager.setCurrentSession(unrevertedSession)
      
      // Send redo success message to webview
      this.webviewCommManager.sendRedoSuccess()
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to redo: ${error.message}`)
      throw error
    }
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    const currentSession = this.stateManager.getCurrentSession()
    if (!currentSession) return false
    return this.sessionManager.canUndo(currentSession)
  }

  /**
   * Get revert information
   */
  getRevertInfo(): { messageId?: string; partId?: string } | null {
    const currentSession = this.stateManager.getCurrentSession()
    if (!currentSession) return null
    return this.sessionManager.getRevertInfo(currentSession)
  }
}