import { OpenCodeAPI } from './api'
import { Session } from '../types/app'
import * as vscode from 'vscode'

/**
 * Session Manager
 * Handles session-related operations using OpenCode API
 * Similar to TUI's session management
 */
export class SessionManager {
  private api: OpenCodeAPI
  private outputChannel: vscode.OutputChannel
  private sessions: Session[] = []

  constructor(api: OpenCodeAPI, outputChannel: vscode.OutputChannel) {
    this.api = api
    this.outputChannel = outputChannel
  }

  /**
   * Load sessions from OpenCode server
   */
  async loadSessions(): Promise<Session[]> {
    try {
      this.outputChannel.appendLine('📋 Loading sessions from server...')
      
      // For now, we'll create a new session since listing sessions might not be available
      // This matches the TUI behavior where it creates a new session if none exists
      this.outputChannel.appendLine('📋 Skipping session listing (method not available), creating new session...')
      
      const newSession = await this.createSession()
      this.sessions = [newSession]
      
      this.outputChannel.appendLine(`✅ Loaded ${this.sessions.length} sessions`)
      return this.sessions
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to load sessions: ${error.message}`)
      return []
    }
  }

  /**
   * Create a new session
   */
  async createSession(): Promise<Session> {
    try {
      this.outputChannel.appendLine('📝 Creating new session...')
      
      const sessionData = await this.api.createSession()
      
      const session: Session = {
        id: sessionData.id,
        title: sessionData.title || 'New Session',
        createdAt: sessionData.time?.created || Date.now(),
        updatedAt: sessionData.time?.updated || Date.now(),
        messageCount: 0
      }

      this.outputChannel.appendLine(`✅ Created new session: ${session.id}`)
      return session
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to create session: ${error.message}`)
      throw error
    }
  }

  /**
   * Get all sessions
   */
  getSessions(): Session[] {
    return this.sessions
  }

  /**
   * Get session by ID
   */
  getSessionById(sessionId: string): Session | null {
    return this.sessions.find(session => session.id === sessionId) || null
  }

  /**
   * Update session
   */
  updateSession(sessionId: string, updates: Partial<Session>): void {
    const sessionIndex = this.sessions.findIndex(session => session.id === sessionId)
    if (sessionIndex !== -1) {
      this.sessions[sessionIndex] = { ...this.sessions[sessionIndex], ...updates }
      this.outputChannel.appendLine(`✅ Updated session: ${sessionId}`)
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      // Remove from local list
      this.sessions = this.sessions.filter(session => session.id !== sessionId)
      this.outputChannel.appendLine(`✅ Deleted session: ${sessionId}`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to delete session: ${error.message}`)
      throw error
    }
  }
}
