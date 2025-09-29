import { OpenCodeClientWrapper } from './client'
import { SessionManager } from './session'
import { MessageManager } from './message'
import { ServerManager } from '../services/server'
import { AppState, Session, PromptParams, PromptResponse } from '../types/app'
import * as vscode from 'vscode'

/**
 * Main OpenCode Application
 * Coordinates all components and manages application state
 */
export class OpenCodeApp {
  private client: OpenCodeClientWrapper
  private sessionManager: SessionManager
  private messageManager: MessageManager
  private serverManager: ServerManager
  private state: AppState
  private outputChannel: vscode.OutputChannel

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel
    
    // Initialize state
    this.state = {
      currentSession: null,
      sessions: [],
      messages: [],
      currentMode: 'plan',
      currentModel: null,
      isConnected: false,
      serverPort: null
    }

    // Initialize components
    this.client = new OpenCodeClientWrapper(outputChannel)
    this.sessionManager = new SessionManager(this.client, outputChannel)
    this.messageManager = new MessageManager(this.client, outputChannel)
    this.serverManager = new ServerManager(outputChannel)
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

      // Initialize OpenCode client with exact server URL
      await this.client.initialize(serverURL)
      this.state.isConnected = true

      // Load existing sessions
      await this.sessionManager.loadSessions()
      this.state.sessions = this.sessionManager.getSessions()

      // Ensure we have a current session
      const currentSession = await this.sessionManager.ensureCurrentSession()
      this.state.currentSession = currentSession

      this.outputChannel.appendLine('✅ OpenCode application initialized successfully')
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to initialize OpenCode application: ${error.message}`)
      throw error
    }
  }

  /**
   * Send a message to OpenCode
   */
  async sendMessage(text: string, mode: 'plan' | 'build' = 'plan'): Promise<string> {
    try {
      this.outputChannel.appendLine(`📤 Sending message: "${text}" in ${mode} mode`)

      // Ensure we have a current session
      const session = await this.sessionManager.ensureCurrentSession()
      this.state.currentSession = session

      // Prepare prompt parameters
      const params: PromptParams = {
        text,
        mode,
        sessionId: session.id
      }

      // Send message
      const response = await this.messageManager.sendMessage(params)
      
      // Update state
      this.state.messages = this.messageManager.getMessages()
      this.state.currentMode = mode

      this.outputChannel.appendLine(`✅ Message sent successfully`)
      return response.content

    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to send message: ${error.message}`)
      throw error
    }
  }

  /**
   * Create a new session
   */
  async createSession(): Promise<Session> {
    try {
      this.outputChannel.appendLine('📝 Creating new session...')
      const session = await this.sessionManager.create()
      this.state.currentSession = session
      this.state.sessions = this.sessionManager.getSessions()
      this.outputChannel.appendLine(`✅ Session created: ${session.id}`)
      return session
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to create session: ${error.message}`)
      throw error
    }
  }

  /**
   * Switch to a different session
   */
  async switchSession(sessionId: string): Promise<void> {
    try {
      this.outputChannel.appendLine(`🔄 Switching to session: ${sessionId}`)
      await this.sessionManager.switch(sessionId)
      this.state.currentSession = this.sessionManager.getCurrentSession()
      this.state.messages = this.messageManager.getMessagesForSession(sessionId)
      this.outputChannel.appendLine(`✅ Switched to session: ${sessionId}`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to switch session: ${error.message}`)
      throw error
    }
  }

  /**
   * Get current application state
   */
  getState(): AppState {
    return { ...this.state }
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
   * Get messages for current session
   */
  getMessages(): any[] {
    if (!this.state.currentSession) {
      return []
    }
    return this.messageManager.getMessagesForSession(this.state.currentSession.id)
  }

  /**
   * Check if application is connected
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
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    try {
      this.outputChannel.appendLine('🛑 Disposing OpenCode application...')
      await this.serverManager.stopServer()
      this.state.isConnected = false
      this.outputChannel.appendLine('✅ OpenCode application disposed')
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Error disposing OpenCode application: ${error.message}`)
    }
  }
}
