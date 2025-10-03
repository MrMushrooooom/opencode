import { createOpencodeClient, OpencodeClient } from '@opencode-ai/sdk'
import * as vscode from 'vscode'

/**
 * OpenCode API Client
 * Provides a clean interface for OpenCode server communication
 * Similar to TUI's internal/api package
 */
export class OpenCodeAPI {
  private client: OpencodeClient | null = null
  private baseURL: string | null = null
  private outputChannel: vscode.OutputChannel

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel
  }

  /**
   * Initialize the OpenCode API client
   */
  async initialize(baseURL: string): Promise<void> {
    try {
      this.baseURL = baseURL
      this.outputChannel.appendLine(`🔧 Initializing OpenCode API client with baseURL: ${baseURL}`)
      
      // Validate URL format
      try {
        new URL(baseURL)
        this.outputChannel.appendLine(`✅ URL format is valid: ${baseURL}`)
      } catch (urlError: any) {
        this.outputChannel.appendLine(`❌ Invalid URL format: ${baseURL}, error: ${urlError.message}`)
        throw new Error(`Invalid baseURL format: ${baseURL}`)
      }

      this.client = createOpencodeClient({
        baseUrl: baseURL
      })

      this.outputChannel.appendLine(`✅ OpenCode API client initialized successfully`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to initialize OpenCode API client: ${error.message}`)
      throw error
    }
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.client !== null && this.baseURL !== null
  }

  /**
   * Get the base URL
   */
  getBaseURL(): string | null {
    return this.baseURL
  }

  /**
   * Session Management
   */
  async createSession(): Promise<any> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine('📝 Creating session using OpenCode API...')
      const session = await this.client.session.create({})
      this.outputChannel.appendLine(`✅ Session created: ${session.data?.id}`)
      return session.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to create session: ${error.message}`)
      throw error
    }
  }

  async getSessionMessages(sessionId: string): Promise<any[]> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine(`📋 Getting messages for session ${sessionId}...`)
      const response = await this.client.session.messages({
        path: { id: sessionId }
      })
      this.outputChannel.appendLine(`✅ Retrieved ${response.data?.length || 0} messages`)
      return response.data || []
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get session messages: ${error.message}`)
      throw error
    }
  }

  async getSessions(): Promise<any[]> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine('📋 Getting sessions from server...')
      const response = await this.client.session.list({})
      this.outputChannel.appendLine(`✅ Retrieved ${response.data?.length || 0} sessions`)
      return response.data || []
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get sessions: ${error.message}`)
      throw error
    }
  }

  async sendPrompt(sessionId: string, params: any): Promise<any> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine(`📤 Sending prompt to session ${sessionId}...`)
      this.outputChannel.appendLine(`📋 Request body: ${JSON.stringify(params, null, 2)}`)
      this.outputChannel.appendLine(`🔗 API Base URL: ${this.baseURL}`)
      this.outputChannel.appendLine(`🔗 Full endpoint: ${this.baseURL}/session/${sessionId}/prompt`)
      
      const response = await this.client.session.prompt({
        path: { id: sessionId },
        body: params
      })
      this.outputChannel.appendLine(`✅ Prompt sent successfully`)
      return response.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to send prompt: ${error.message}`)
      this.outputChannel.appendLine(`❌ Error type: ${error.constructor.name}`)
      this.outputChannel.appendLine(`❌ Error stack: ${error.stack}`)
      
      // Check if it's a network error
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        this.outputChannel.appendLine(`🌐 Network error detected - server may not be running`)
        this.outputChannel.appendLine(`🔍 Check if OpenCode server is running on: ${this.baseURL}`)
      }
      
      throw error
    }
  }

  /**
   * Update session properties (e.g., title)
   */
  async updateSession(sessionId: string, updates: { title?: string }): Promise<any> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine(`📝 Updating session ${sessionId}...`)
      const response = await this.client.session.update({
        path: { id: sessionId },
        body: updates
      })
      this.outputChannel.appendLine(`✅ Session updated successfully`)
      return response.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to update session: ${error.message}`)
      throw error
    }
  }

  /**
   * Delete a session and all its data
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine(`🗑️ Deleting session ${sessionId}...`)
      const response = await this.client.session.delete({
        path: { id: sessionId }
      })
      this.outputChannel.appendLine(`✅ Session deleted successfully`)
      return response.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to delete session: ${error.message}`)
      throw error
    }
  }

  /**
   * Configuration Management
   */
  async getConfig(): Promise<any> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine('🔧 Getting OpenCode configuration...')
      const response = await this.client.config.get({})
      this.outputChannel.appendLine('✅ Configuration retrieved successfully')
      return response.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get configuration: ${error.message}`)
      throw error
    }
  }

  /**
   * Project Management
   */
  async getCurrentProject(): Promise<any> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine('📁 Getting current project...')
      const response = await this.client.project.current({})
      this.outputChannel.appendLine('✅ Project information retrieved successfully')
      return response.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get project: ${error.message}`)
      throw error
    }
  }

  /**
   * Provider and Model Management
   */
  async getProviders(): Promise<any[]> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine('📋 Getting available providers...')
      
      // Add diagnostic logging
      this.outputChannel.appendLine(`🔍 SDK client status: ${this.client ? 'initialized' : 'not initialized'}`)
      this.outputChannel.appendLine(`🔍 SDK config object: ${this.client.config ? 'available' : 'not available'}`)
      this.outputChannel.appendLine(`🔍 Base URL: ${this.baseURL}`)
      
      // Add a small delay to ensure SDK client is fully ready
      this.outputChannel.appendLine('⏳ Waiting for SDK client to be fully ready...')
      await new Promise(resolve => setTimeout(resolve, 1000))
      
        this.outputChannel.appendLine('🔍 Calling this.client.config.providers({})...')
        const response = await this.client.config.providers({})
        
        this.outputChannel.appendLine(`🔍 Raw SDK response: ${JSON.stringify(response)}`)
        
        // SDK 返回的数据结构是 {data: {providers: [...]}}
        const providers = response.data?.providers || response.providers || []
        this.outputChannel.appendLine(`✅ Retrieved ${providers.length} providers`)
        
        if (providers.length > 0) {
          providers.forEach((provider: any) => {
            const modelCount = Object.keys(provider.models || {}).length
            this.outputChannel.appendLine(`  📋 SDK Provider: ${provider.name} (${provider.id}) - ${modelCount} models`)
          })
        }
        
        return providers
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get providers: ${error.message}`)
      this.outputChannel.appendLine(`❌ Error stack: ${error.stack}`)
      throw error
    }
  }

  /**
   * Start event stream using SSE
   */
  async startEventStream(signal?: AbortSignal): Promise<any> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine('🔄 Starting event stream...')
      
      // Use OpenCode SDK's event streaming (JavaScript SDK uses subscribe method)
      const stream = await this.client.event.subscribe({ signal })
      
      this.outputChannel.appendLine('✅ Event stream started')
      return stream
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to start event stream: ${error.message}`)
      throw error
    }
  }

  /**
   * Permission Management for BUILD mode
   */
  async respondToPermission(
    sessionId: string, 
    permissionId: string, 
    response: 'once' | 'always' | 'reject'
  ): Promise<boolean> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine(`🔐 Responding to permission ${permissionId} with: ${response}`)
      
      const result = await this.client.postSessionByIdPermissionsByPermissionId({
        path: { id: sessionId, permissionId },
        body: { response }
      })
      
      this.outputChannel.appendLine(`✅ Permission response sent successfully`)
      return result.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to respond to permission: ${error.message}`)
      throw error
    }
  }

  /**
   * Session Revert (Undo functionality)
   */
  async revertSession(sessionId: string, messageId?: string, partId?: string): Promise<any> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine(`↩️ Reverting session ${sessionId} to message ${messageId || 'latest'}`)
      
      const result = await this.client.session.revert({
        path: { id: sessionId },
        body: {
          messageId,
          partId
        }
      })
      
      this.outputChannel.appendLine(`✅ Session reverted successfully`)
      return result.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to revert session: ${error.message}`)
      throw error
    }
  }

  /**
   * Session Unrevert (Redo functionality)
   */
  async unrevertSession(sessionId: string): Promise<any> {
    if (!this.client) {
      throw new Error('OpenCode API client not initialized')
    }

    try {
      this.outputChannel.appendLine(`↪️ Unreverting session ${sessionId}`)
      
      const result = await this.client.session.unrevert({
        path: { id: sessionId },
        body: {}
      })
      
      this.outputChannel.appendLine(`✅ Session unreverted successfully`)
      return result.data
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to unrevert session: ${error.message}`)
      throw error
    }
  }
}
