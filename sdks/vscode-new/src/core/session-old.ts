import { OpenCodeAPI } from './api'
import { Session } from '../types/app'
import * as vscode from 'vscode'

/**
 * Session Manager
 * Handles all session-related operations
 */
export class SessionManager {
  private api: OpenCodeAPI
  private currentSession: Session | null = null
  private sessions: Session[] = []
  private outputChannel: vscode.OutputChannel

  constructor(api: OpenCodeAPI, outputChannel: vscode.OutputChannel) {
    this.api = api
    this.outputChannel = outputChannel
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    return this.currentSession
  }

  /**
   * Get all sessions
   */
  getSessions(): Session[] {
    return this.sessions
  }

  /**
   * Create a new session
   */
  async create(): Promise<Session> {
    try {
      this.outputChannel.appendLine('📝 Creating new session...')
      const sessionData = await this.api.createSession()
      
      const session: Session = {
        id: sessionData.id,
        title: sessionData.title || 'New Session',
        createdAt: sessionData.createdAt || new Date().toISOString(),
        updatedAt: sessionData.updatedAt || new Date().toISOString()
      }

      this.sessions.push(session)
      this.currentSession = session
      
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
  async switch(sessionId: string): Promise<void> {
    try {
      this.outputChannel.appendLine(`🔄 Switching to session: ${sessionId}`)
      
      // Find session in our list
      const session = this.sessions.find(s => s.id === sessionId)
      if (session) {
        this.currentSession = session
        this.outputChannel.appendLine(`✅ Switched to session: ${sessionId}`)
        return
      }

      // If not found, try to get it from server
      const sessionData = await this.api.getSession(sessionId)
      const newSession: Session = {
        id: sessionData.id,
        title: sessionData.title || 'Session',
        createdAt: sessionData.createdAt || new Date().toISOString(),
        updatedAt: sessionData.updatedAt || new Date().toISOString()
      }

      this.sessions.push(newSession)
      this.currentSession = newSession
      
      this.outputChannel.appendLine(`✅ Switched to session: ${sessionId}`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to switch session: ${error.message}`)
      throw error
    }
  }

  /**
   * Load all sessions from server
   */
  async loadSessions(): Promise<Session[]> {
    try {
      this.outputChannel.appendLine('📋 Loading sessions from server...')
      
      const sessionsData = await this.api.listSessions()
      this.sessions = sessionsData.map((sessionData: any) => ({
        id: sessionData.id,
        title: sessionData.title || `Session ${sessionData.id.slice(0, 8)}`,
        createdAt: sessionData.createdAt || new Date().toISOString(),
        updatedAt: sessionData.updatedAt || new Date().toISOString()
      }))
      
      // If no sessions exist, create a new one
      if (this.sessions.length === 0) {
        this.outputChannel.appendLine('📋 No sessions found, creating new session...')
        const newSession = await this.create()
        return [newSession]
      }
      
      // Set the first session as current if none is set
      if (!this.currentSession && this.sessions.length > 0) {
        this.currentSession = this.sessions[0]
      }
      
      this.outputChannel.appendLine(`✅ Loaded ${this.sessions.length} sessions`)
      return this.sessions
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to load sessions: ${error.message}`)
      // If listing fails, create a new session as fallback
      const newSession = await this.create()
      return [newSession]
    }
  }

  /**
   * Ensure we have a current session
   */
  async ensureCurrentSession(): Promise<Session> {
    if (this.currentSession) {
      return this.currentSession
    }

    // Create a new session directly
    return await this.create()
  }
}
