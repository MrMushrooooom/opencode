import { createOpencodeClient, OpencodeClient } from '@opencode-ai/sdk'
import * as vscode from 'vscode'

/**
 * OpenCode SDK Client wrapper
 * Provides a clean interface for OpenCode server communication
 */
export class OpenCodeClientWrapper {
  private sdkClient: OpencodeClient | null = null
  private baseURL: string | null = null
  private outputChannel: vscode.OutputChannel

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel
  }

  /**
   * Initialize the OpenCode SDK client
   */
  async initialize(baseURL: string): Promise<void> {
    try {
      this.baseURL = baseURL
      this.outputChannel.appendLine(`🔧 Initializing SDK client with baseURL: ${baseURL}`)
      
      // Validate URL format
      try {
        new URL(baseURL)
        this.outputChannel.appendLine(`✅ URL format is valid: ${baseURL}`)
      } catch (urlError: any) {
        this.outputChannel.appendLine(`❌ Invalid URL format: ${baseURL}, error: ${urlError.message}`)
        throw new Error(`Invalid baseURL format: ${baseURL}`)
      }

      this.sdkClient = createOpencodeClient({
        baseUrl: baseURL  // 使用小写的 baseUrl
      })

      this.outputChannel.appendLine(`✅ OpenCode SDK client initialized successfully`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to initialize OpenCode SDK client: ${error.message}`)
      this.outputChannel.appendLine(`❌ Error stack: ${error.stack}`)
      throw error
    }
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.sdkClient !== null && this.baseURL !== null
  }

  /**
   * Get the base URL
   */
  getBaseURL(): string | null {
    return this.baseURL
  }

  /**
   * Create a new session
   */
  async createSession(): Promise<any> {
    if (!this.sdkClient) {
      throw new Error('OpenCode client not initialized')
    }

    try {
      this.outputChannel.appendLine('📝 Creating session using OpenCode SDK...')
      const session = await this.sdkClient.session.create({})
      this.outputChannel.appendLine(`✅ Session created: ${session.data?.id}`)
      return session.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to create session: ${error.message}`)
      throw error
    }
  }

  /**
   * Get messages for a session (conversation history)
   */
  async getSessionMessages(sessionId: string): Promise<any[]> {
    if (!this.sdkClient) {
      throw new Error('OpenCode client not initialized')
    }

    try {
      this.outputChannel.appendLine(`📋 Getting messages for session ${sessionId}...`)
      const response = await this.sdkClient.session.messages({
        path: { id: sessionId }
      })
      this.outputChannel.appendLine(`✅ Retrieved ${response.data?.length || 0} messages`)
      return response.data || []
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get session messages: ${error.message}`)
      throw error
    }
  }

  /**
   * Send a prompt to a session
   */
  async sendPrompt(sessionId: string, params: any): Promise<any> {
    if (!this.sdkClient) {
      throw new Error('OpenCode client not initialized')
    }

    try {
      this.outputChannel.appendLine(`📤 Sending prompt to session ${sessionId}...`)
      const response = await this.sdkClient.session.prompt({
        path: { id: sessionId },
        body: params
      })
      this.outputChannel.appendLine(`✅ Prompt sent successfully`)
      return response.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to send prompt: ${error.message}`)
      throw error
    }
  }

  /**
   * Get configuration
   */
  async getConfig(): Promise<any> {
    if (!this.sdkClient) {
      throw new Error('OpenCode client not initialized')
    }

    try {
      this.outputChannel.appendLine('🔧 Getting OpenCode configuration...')
      const config = await this.sdkClient.config.get({})
      this.outputChannel.appendLine('✅ Configuration retrieved successfully')
      return config.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get configuration: ${error.message}`)
      throw error
    }
  }

  /**
   * List sessions
   */
  async listSessions(): Promise<any[]> {
    if (!this.sdkClient) {
      throw new Error('OpenCode client not initialized')
    }

    try {
      this.outputChannel.appendLine('📋 Listing sessions...')
      this.outputChannel.appendLine(`🔍 SDK client available methods: ${JSON.stringify(Object.keys(this.sdkClient))}`)
      this.outputChannel.appendLine(`🔍 Session object: ${JSON.stringify(this.sdkClient.session ? Object.keys(this.sdkClient.session) : 'undefined')}`)
      
      const sessions = await this.sdkClient.session.list({})
      this.outputChannel.appendLine(`✅ Found ${sessions.data?.length || 0} sessions`)
      this.outputChannel.appendLine(`🔍 Sessions response: ${JSON.stringify(sessions)}`)
      return sessions.data || []
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to list sessions: ${error.message}`)
      this.outputChannel.appendLine(`❌ Error stack: ${error.stack}`)
      this.outputChannel.appendLine(`❌ Error details: ${JSON.stringify(error)}`)
      throw error
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<any> {
    if (!this.sdkClient) {
      throw new Error('OpenCode client not initialized')
    }

    try {
      this.outputChannel.appendLine(`🔍 Getting session ${sessionId}...`)
      const session = await this.sdkClient.session.get({ path: { id: sessionId } })
      this.outputChannel.appendLine(`✅ Session retrieved: ${session.data?.id}`)
      return session.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get session: ${error.message}`)
      throw error
    }
  }
}
