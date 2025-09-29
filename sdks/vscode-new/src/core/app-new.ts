import { OpenCodeAPI } from './api'
import { SessionManager } from './session-new'
import { MessageManager } from './message-new'
import { ModelManager } from './model'
import { ServerManager } from '../services/server-new'
import { EventStreamManager } from './stream'
import { AppState, Session, PromptParams, PromptResponse } from '../types/app'
import * as vscode from 'vscode'

/**
 * Main OpenCode Application
 * Coordinates all components and manages application state
 * Similar to TUI's internal/app package
 */
export class OpenCodeApp {
  private api: OpenCodeAPI
  private sessionManager: SessionManager
  private messageManager: MessageManager
  private modelManager: ModelManager
  private serverManager: ServerManager
  private eventStreamManager: EventStreamManager
  private state: AppState
  private outputChannel: vscode.OutputChannel
  private webviewPanel: any // Reference to webview panel for streaming updates

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel
    
    // Initialize state
    this.state = {
      currentSession: null,
      sessions: [],
      messages: [],
      currentMode: 'plan', // Use 'plan' agent for testing
      currentModel: null,
      availableModels: [],
      providers: [],
      recentlyUsedModels: [],
      isConnected: false,
      serverPort: null
    }

    // Initialize components
    this.api = new OpenCodeAPI(outputChannel)
    this.serverManager = new ServerManager(outputChannel)
    this.modelManager = new ModelManager(this.api, outputChannel)
    this.sessionManager = new SessionManager(this.api, outputChannel)
    this.messageManager = new MessageManager(this.api, outputChannel)
    this.eventStreamManager = new EventStreamManager(this.api, outputChannel)
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    try {
      this.outputChannel.appendLine('🚀 Initializing OpenCode application...')

      // Start OpenCode server
      const serverURL = await this.serverManager.startServer()
      this.state.serverPort = this.serverManager.getServerPort()

      // Initialize API client
      await this.api.initialize(serverURL)

      // Initialize model manager
      await this.modelManager.initialize()
      this.state.currentModel = this.modelManager.getCurrentModel()
      this.state.providers = this.modelManager.getModelsByProvider()
      this.state.availableModels = this.modelManager.getAllModels()
      // Convert Model[] to ModelUsage[] for recentlyUsedModels
      const recentModels = this.modelManager.getRecentlyUsedModels()
      this.state.recentlyUsedModels = recentModels.map(model => ({
        providerId: model.providerId,
        modelId: model.id,
        lastUsed: Date.now()
      }))
      
      // If no models loaded, log warning but continue
      if (!this.state.currentModel) {
        this.outputChannel.appendLine(`⚠️ No models available - plugin will work in limited mode`)
        this.outputChannel.appendLine(`💡 Models may load later from cache or when network is available`)
      }

      // Load sessions
      const sessions = await this.sessionManager.loadSessions()
      this.state.sessions = sessions
      this.state.currentSession = sessions[0] || null

      // Update connection state
      this.state.isConnected = true

      // Start SSE event stream for real-time updates
      await this.eventStreamManager.startListening(
        (messageId: string, part: any) => {
          // Handle message part updates
          const content = this.messageManager.handleStreamingUpdate(messageId, part)
          // Send streaming update to webview with role information
          this.sendStreamingUpdateToWebview(messageId, content, part.type, part.role)
        },
        (session: any) => {
          // Handle session updates
          this.outputChannel.appendLine(`📝 Session updated: ${session.id}`)
        }
      )

      this.outputChannel.appendLine('✅ OpenCode application initialized successfully')
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to initialize OpenCode application: ${error.message}`)
      throw error
    }
  }

  /**
   * Send a message
   */
  async sendMessage(text: string, mode: 'plan' | 'build' = 'plan'): Promise<PromptResponse> {
    this.outputChannel.appendLine(`🚀 App.sendMessage called with: "${text}" mode: ${mode}`)

    if (!this.state.currentSession) {
      this.outputChannel.appendLine('❌ No active session')
      throw new Error('No active session')
    }

    if (!this.state.currentModel) {
      this.outputChannel.appendLine('❌ No model available')
      throw new Error('No model available - please wait for models to load or check your network connection')
    }

    this.outputChannel.appendLine(`📋 Using session: ${this.state.currentSession.id}`)
    this.outputChannel.appendLine(`🤖 Using model: ${this.state.currentModel.name} (${this.state.currentModel.providerId})`)

    const params: PromptParams = {
      text,
      mode,
      sessionId: this.state.currentSession.id
    }

    this.outputChannel.appendLine(`📤 Calling messageManager.sendMessage`)
    return await this.messageManager.sendMessage(params, this.state.currentModel)
  }

  /**
   * Get messages for current session
   */
  async getCurrentSessionMessages(): Promise<any[]> {
    if (!this.state.currentSession) {
      return []
    }

    return await this.messageManager.getMessagesForSession(this.state.currentSession.id)
  }

  /**
   * Create a new session
   */
  async createNewSession(): Promise<Session> {
    const session = await this.sessionManager.createSession()
    this.state.sessions.push(session)
    this.state.currentSession = session
    return session
  }

  /**
   * Switch to a different session
   */
  switchToSession(sessionId: string): void {
    const session = this.sessionManager.getSessionById(sessionId)
    if (session) {
      this.state.currentSession = session
      this.outputChannel.appendLine(`✅ Switched to session: ${session.title}`)
    }
  }

  /**
   * Get application state
   */
  getState(): AppState {
    return { ...this.state }
  }

  /**
   * Update application state
   */
  updateState(updates: Partial<AppState>): void {
    this.state = { ...this.state, ...updates }
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    return this.state.currentSession
  }

  /**
   * Get all sessions
   */
  getSessions(): Session[] {
    return this.state.sessions
  }

  /**
   * Check if connected to server
   */
  isConnected(): boolean {
    return this.state.isConnected
  }

  /**
   * Get server port
   */
  getServerPort(): number | null {
    return this.state.serverPort
  }

  /**
   * Model Management
   */
  async switchModel(providerId: string, modelId: string): Promise<void> {
    await this.modelManager.switchToModel(providerId, modelId)
    this.state.currentModel = this.modelManager.getCurrentModel()
    // Convert Model[] to ModelUsage[] for recentlyUsedModels
    const recentModels = this.modelManager.getRecentlyUsedModels()
    this.state.recentlyUsedModels = recentModels.map(model => ({
      providerId: model.providerId,
      modelId: model.id,
      lastUsed: Date.now()
    }))
    
    const currentModel = this.state.currentModel
    this.outputChannel.appendLine(`🔄 Model switched successfully!`)
    this.outputChannel.appendLine(`📋 New model: ${currentModel?.name || 'Unknown'} (${providerId})`)
    this.outputChannel.appendLine(`🆔 Model ID: ${modelId}`)
  }

  getCurrentModel(): any {
    return this.state.currentModel
  }

  getAvailableModels(): any[] {
    return this.state.availableModels
  }

  getProviders(): any[] {
    return this.state.providers
  }

  getRecentlyUsedModels(): any[] {
    return this.state.recentlyUsedModels
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      this.outputChannel.appendLine('🧹 Cleaning up OpenCode application...')
      await this.serverManager.stopServer()
      this.state.isConnected = false
      this.outputChannel.appendLine('✅ OpenCode application cleaned up')
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to cleanup OpenCode application: ${error.message}`)
    }
  }

  /**
   * Set webview panel reference for streaming updates
   */
  setWebviewPanel(panel: any): void {
    this.webviewPanel = panel
  }

  /**
   * Send streaming update to webview
   */
  private sendStreamingUpdateToWebview(messageId: string, content: string, partType: string, role?: string): void {
    this.outputChannel.appendLine(`📨 App.sendStreamingUpdateToWebview called`)
    this.outputChannel.appendLine(`📝 Message ID: ${messageId}`)
    this.outputChannel.appendLine(`🔄 Part type: ${partType}`)
    this.outputChannel.appendLine(`📄 Content length: ${content.length}`)
    this.outputChannel.appendLine(`👤 Role: ${role || 'unknown'}`)

    if (this.webviewPanel) {
      this.outputChannel.appendLine(`📱 Sending streaming update to webview`)
      this.webviewPanel.sendStreamingUpdate(messageId, content, partType, role)
    } else {
      this.outputChannel.appendLine(`⚠️ No webview panel available for streaming update`)
    }
  }
}
