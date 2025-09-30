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
      
      // Try to get existing sessions from server
      try {
        const serverSessions = await this.api.getSessions()
        this.outputChannel.appendLine(`📋 Retrieved ${serverSessions.length} sessions from server`)
        
        // Convert server sessions to our format
        const sessions: Session[] = []
        for (const serverSession of serverSessions) {
          const session: Session = {
            id: serverSession.id,
            title: serverSession.title || `Session ${serverSession.id.substring(0, 8)}`,
            createdAt: serverSession.time?.created || Date.now(),
            updatedAt: serverSession.time?.updated || Date.now(),
            messageCount: 0 // We'll update this when we load messages
          }
          sessions.push(session)
        }
        
        // Sort sessions by updated time (most recent first)
        sessions.sort((a, b) => b.updatedAt - a.updatedAt)
        
        this.sessions = sessions
        
        // If no sessions exist, create a new one (like TUI does)
        if (sessions.length === 0) {
          this.outputChannel.appendLine('📋 No existing sessions found, creating new session...')
          const newSession = await this.createSession()
          this.sessions = [newSession]
        }
        
        this.outputChannel.appendLine(`✅ Loaded ${this.sessions.length} sessions`)
        return this.sessions
      } catch (error: any) {
        this.outputChannel.appendLine(`⚠️ Failed to load sessions from server: ${error.message}`)
        this.outputChannel.appendLine('📋 Falling back to creating new session...')
        
        // Fallback: create a new session if server is unavailable
        const newSession = await this.createSession()
        this.sessions = [newSession]
        
        this.outputChannel.appendLine(`✅ Created fallback session: ${newSession.id}`)
        return this.sessions
      }
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
   * Load a specific session by ID
   */
  async loadSession(sessionId: string): Promise<Session | null> {
    try {
      this.outputChannel.appendLine(`📋 Loading session: ${sessionId}`)
      
      // Get session messages to verify it exists and get updated info
      const messages = await this.api.getSessionMessages(sessionId)
      
      // Find existing session or create a new one
      let session = this.sessions.find(s => s.id === sessionId)
      if (!session) {
        // Create a new session object if not found locally
        session = {
          id: sessionId,
          title: `Session ${sessionId.substring(0, 8)}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: messages.length
        }
        this.sessions.push(session)
      } else {
        // Update existing session
        session.messageCount = messages.length
        session.updatedAt = Date.now()
      }
      
      this.outputChannel.appendLine(`✅ Loaded session: ${session.title} (${messages.length} messages)`)
      return session
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to load session: ${error.message}`)
      return null
    }
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
