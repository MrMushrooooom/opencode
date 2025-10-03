import { AppState, Session } from '../types/app'
import * as vscode from 'vscode'

/**
 * State Manager
 * Manages application state and provides state operations
 */
export class StateManager {
  private state: AppState
  private outputChannel: vscode.OutputChannel

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel
    
    // Initialize state
    this.state = {
      currentSession: null,
      messages: [],
      currentMode: 'plan',
      currentModel: null,
      recentlyUsedModels: [],
      isConnected: false,
      serverPort: null
    }
  }

  /**
   * Get the current application state
   */
  getState(): AppState {
    return { ...this.state }
  }

  /**
   * Update application state
   */
  updateState(updates: Partial<AppState>): void {
    this.state = { ...this.state, ...updates }
    this.outputChannel.appendLine(`📝 State updated: ${Object.keys(updates).join(', ')}`)
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    return this.state.currentSession
  }

  /**
   * Set current session
   */
  setCurrentSession(session: Session | null): void {
    this.state.currentSession = session
    this.outputChannel.appendLine(`📝 Current session set: ${session?.id || 'null'}`)
  }

  // Note: Session management is handled by SessionManager
  // StateManager only maintains currentSession reference for consistency

  /**
   * Check if connected to server
   */
  isConnected(): boolean {
    return this.state.isConnected
  }

  /**
   * Set connection status
   */
  setConnected(connected: boolean): void {
    this.state.isConnected = connected
    this.outputChannel.appendLine(`📝 Connection status: ${connected ? 'connected' : 'disconnected'}`)
  }

  /**
   * Get server port
   */
  getServerPort(): number | null {
    return this.state.serverPort
  }

  /**
   * Set server port
   */
  setServerPort(port: number | null): void {
    this.state.serverPort = port
    this.outputChannel.appendLine(`📝 Server port set: ${port || 'null'}`)
  }

  /**
   * Get current mode
   */
  getCurrentMode(): 'plan' | 'build' {
    return this.state.currentMode
  }

  /**
   * Set current mode
   */
  setCurrentMode(mode: 'plan' | 'build'): void {
    this.state.currentMode = mode
    this.outputChannel.appendLine(`📝 Mode set: ${mode}`)
  }

  /**
   * Get current model
   */
  getCurrentModel(): any {
    return this.state.currentModel
  }

  /**
   * Set current model
   */
  setCurrentModel(model: any): void {
    this.state.currentModel = model
    this.outputChannel.appendLine(`📝 Model set: ${model?.id || 'null'}`)
  }

  // Note: Model-related data is now managed by ModelManager
  // StateManager only maintains currentModel for consistency with other state

  /**
   * Get recently used models
   */
  getRecentlyUsedModels(): any[] {
    return [...this.state.recentlyUsedModels]
  }

  /**
   * Set recently used models
   */
  setRecentlyUsedModels(models: any[]): void {
    this.state.recentlyUsedModels = [...models]
    this.outputChannel.appendLine(`📝 Recently used models updated: ${models.length} models`)
  }

  /**
   * Reset state to initial values
   */
  reset(): void {
    this.state = {
      currentSession: null,
      messages: [],
      currentMode: 'plan',
      currentModel: null,
      recentlyUsedModels: [],
      isConnected: false,
      serverPort: null
    }
    this.outputChannel.appendLine(`📝 State reset to initial values`)
  }
}
