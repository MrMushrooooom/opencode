import { OpenCodeAPI } from './api'
import { Session } from '../types/app'
import * as vscode from 'vscode'

/**
 * Session Manager
 * Handles all session-related operations including lifecycle, undo/redo, and local state management
 * Unified version combining functionality from both previous SessionManager implementations
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
        sessions.sort((a, b) => {
          const aTime = typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt).getTime()
          const bTime = typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt).getTime()
          return bTime - aTime
        })
        
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
   * Create a new session (alias for createSession)
   */
  async createNewSession(): Promise<Session> {
    return this.createSession()
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
   * Switch to a specific session
   */
  async switchToSession(sessionId: string): Promise<Session> {
    try {
      const sessions = await this.api.getSessions()
      const session = sessions.find(s => s.id === sessionId)
      if (!session) {
        throw new Error(`Session ${sessionId} not found`)
      }
      this.outputChannel.appendLine(`✅ Switched to session: ${sessionId}`)
      return session
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to switch to session: ${error.message}`)
      throw error
    }
  }

  /**
   * Update session properties
   */
  async updateSession(sessionId: string, updates: { title?: string }): Promise<Session> {
    try {
      const session = await this.api.updateSession(sessionId, updates)
      this.outputChannel.appendLine(`✅ Session updated: ${sessionId}`)
      
      // Update local session list
      const localSession = this.sessions.find(s => s.id === sessionId)
      if (localSession) {
        localSession.title = session.title || localSession.title
        localSession.updatedAt = Date.now()
      }
      
      return session
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to update session: ${error.message}`)
      throw error
    }
  }

  /**
   * Update session (local version)
   */
  updateSessionLocal(sessionId: string, updates: Partial<Session>): void {
    const sessionIndex = this.sessions.findIndex(session => session.id === sessionId)
    if (sessionIndex !== -1) {
      this.sessions[sessionIndex] = { ...this.sessions[sessionIndex], ...updates }
      this.outputChannel.appendLine(`✅ Updated local session: ${sessionId}`)
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.api.deleteSession(sessionId)
      
      // Remove from local list
      this.sessions = this.sessions.filter(session => session.id !== sessionId)
      
      this.outputChannel.appendLine(`✅ Session deleted: ${sessionId}`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to delete session: ${error.message}`)
      throw error
    }
  }

  /**
   * Undo to a specific message
   */
  async undoToMessage(sessionId: string, messageId?: string, partId?: string): Promise<Session> {
    try {
      const revertedSession = await this.api.revertSession(sessionId, messageId, partId)
      this.outputChannel.appendLine(`✅ Undo completed - reverted to message ${messageId || 'latest'}`)
      
      // Note: WebView communication is handled by WebViewCommunicationManager
      
      return revertedSession
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to undo: ${error.message}`)
      throw error
    }
  }

  /**
   * Redo changes
   */
  async redoChanges(sessionId: string): Promise<Session> {
    try {
      const unrevertedSession = await this.api.unrevertSession(sessionId)
      this.outputChannel.appendLine(`✅ Redo completed`)
      
      // Note: WebView communication is handled by WebViewCommunicationManager
      
      return unrevertedSession
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to redo: ${error.message}`)
      throw error
    }
  }

  /**
   * Check if undo is possible
   */
  canUndo(session: Session): boolean {
    return !!(session.revert?.messageId || session.revert?.partId)
  }

  /**
   * Get revert information
   */
  getRevertInfo(session: Session): { messageId?: string; partId?: string } | null {
    return session.revert || null
  }

  /**
   * Calculate revert info like TUI does
   */
  calculateRevertInfo(session: any): { messageCount: number; toolCount: number } {
    // This is a simplified version - in a real implementation,
    // you'd calculate based on the actual message and tool call counts
    return {
      messageCount: 1, // Default to 1 message reverted
      toolCount: 0     // Default to 0 tool calls reverted
    }
  }

  /**
   * Get the last user message for pre-filling input (TUI behavior)
   */
  getLastUserMessage(): string {
    // This would need to be implemented based on your message storage
    // For now, return empty string
    return ''
  }
}
