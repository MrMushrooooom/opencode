import type {
  AppStruct,
  StateStruct,
  MessageStruct
} from '../types/app'
import * as vscode from 'vscode'
// @ts-ignore
import * as opencode from '@opencode-ai/sdk'
import { StateManager } from './state'
import { TypeConverter } from './typeConverter'

/**
 * Main OpenCode application controller
 * Manages application state, session lifecycle, and message processing
 */
export class OpenCodeApp {
  private app: AppStruct
  private stateManager: StateManager
  private client: opencode.OpencodeClient | null = null
  private outputChannel: vscode.OutputChannel
  private workspacePath: string
  private webviewPanel: any = null
  private eventStream?: any
  private abortController?: AbortController
  private isStreaming: boolean = false
  private revertingSessionId: string | null = null
  
  // ID generation: maintains unique identifiers for messages, parts, sessions
  private lastTimestamp = 0
  private counter = 0

  constructor(outputChannel: vscode.OutputChannel, workspacePath: string, context: vscode.ExtensionContext) {
    this.outputChannel = outputChannel
    this.workspacePath = workspacePath

    this.stateManager = new StateManager(workspacePath, context)

    this.app = {
      project: null,
      agents: [],
      providers: [],
      config: null,
      client: null,
      session: null,
      messages: [],
      provider: null,
      model: null,
      permissions: [],
      currentPermission: null,
      workspacePath: workspacePath,
      isConnected: false,
      serverPort: null,
      isServerRunning: false
    }
  }

  async initializeClient(baseURL: string): Promise<void> {
    this.client = opencode.createOpencodeClient({ baseUrl: baseURL })
    this.app.client = this.client
    this.app.isConnected = true
    this.outputChannel.appendLine(`OpenCode client initialized: ${baseURL}`)
  }

  /**
   * Initialize application: start server, load config, providers, agents, and restore session
   */
  async initialize(): Promise<void> {
    try {
      this.outputChannel.appendLine('Initializing OpenCode application...')

      const { ServerManager } = await import('../services/server.js')
      const serverManager = new ServerManager(this.outputChannel)
      const serverURL = await serverManager.startServer(this.app.workspacePath)
      
      await this.initializeClient(serverURL)
      await this.loadProject()
      await this.loadConfig()
      await this.stateManager.loadState()
      await this.loadProviders()
      await this.loadAgents()
      await this.loadPermissions()
      await this.getSessions()
      await this.restoreLastSession()
      await this.startEventStream()
      
      this.outputChannel.appendLine('OpenCode application initialized successfully')
    } catch (error) {
      this.outputChannel.appendLine(`Failed to initialize OpenCode application: ${error}`)
      throw error
    }
      }

  /**
   * Load project context for session isolation per workspace
   */
  async loadProject(): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    const response = await this.client.project.current({
      query: { directory: this.app.workspacePath }
    })
    this.app.project = response.data
    this.outputChannel.appendLine(`Project loaded: ${this.app.project?.id} (${this.app.project?.worktree})`)
  }

  async loadConfig(): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    const response = await this.client.config.get({})
    this.app.config = response.data
    this.outputChannel.appendLine('Configuration loaded')
  }

  async loadProviders(): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    const response = await this.client.config.providers({})
    this.app.providers = response.data.providers
    this.outputChannel.appendLine(`Loaded ${this.app.providers.length} providers`)
    
    await this.setDefaultModel()
        }

  /**
   * Set default model: recently used > persisted state > preferred provider > first available
   */
  private async setDefaultModel(): Promise<void> {
    if (!this.app.providers || this.app.providers.length === 0) {
      this.outputChannel.appendLine('No providers available for model selection')
      return
    }

    let selectedProvider: opencode.Provider | null = null
    let selectedModel: opencode.Model | null = null

    // Priority 1: Recently used
    const persistentState = this.stateManager.getState()
    this.outputChannel.appendLine(`🔍 Checking persistent state: recentlyUsedModels=${persistentState.recentlyUsedModels?.length || 0}, provider=${persistentState.provider}, model=${persistentState.model}`)
    
    if (persistentState.recentlyUsedModels && persistentState.recentlyUsedModels.length > 0) {
      const recentUsage = persistentState.recentlyUsedModels[0]
      this.outputChannel.appendLine(`🔍 Most recent usage: provider=${recentUsage.providerID}, model=${recentUsage.modelID}`)
      
      const provider = this.app.providers.find(p => p.id === recentUsage.providerID)
      if (provider && provider.models) {
        const model = Object.values(provider.models).find(m => m.id === recentUsage.modelID)
        if (model) {
          selectedProvider = provider
          selectedModel = model
          this.outputChannel.appendLine(`✅ Selected model from recent usage: ${provider.name}/${model.name}`)
      } else {
          this.outputChannel.appendLine(`❌ Recent model not found: ${recentUsage.modelID} in provider ${recentUsage.providerID}`)
        }
      } else {
        this.outputChannel.appendLine(`❌ Recent provider not found: ${recentUsage.providerID}`)
      }
    } else {
      this.outputChannel.appendLine(`📋 No recent model usage found`)
    }

    // Priority 2: Persisted state
    if (!selectedProvider && persistentState.provider && persistentState.model) {
      const provider = this.app.providers.find(p => p.id === persistentState.provider)
      if (provider && provider.models) {
        const model = Object.values(provider.models).find(m => m.id === persistentState.model)
        if (model) {
          selectedProvider = provider
          selectedModel = model
          this.outputChannel.appendLine(`Selected model from state: ${provider.name}/${model.name}`)
      }
      }
    }

    // Priority 3: Preferred provider (Anthropic)
    if (!selectedProvider) {
      const anthropicProvider = this.app.providers.find(p => p.id === 'anthropic')
      if (anthropicProvider && anthropicProvider.models) {
        const defaultModel = this.getDefaultModelForProvider(anthropicProvider)
        if (defaultModel) {
          selectedProvider = anthropicProvider
          selectedModel = defaultModel
          this.outputChannel.appendLine(`Selected model from internal priority (Anthropic): ${anthropicProvider.name}/${defaultModel.name}`)
        }
      }
    }

    // Priority 4: First available
    if (!selectedProvider && this.app.providers.length > 0) {
      const provider = this.app.providers[0]
      const defaultModel = this.getDefaultModelForProvider(provider)
      if (defaultModel) {
        selectedProvider = provider
        selectedModel = defaultModel
        this.outputChannel.appendLine(`Selected model from fallback (first available): ${provider.name}/${defaultModel.name}`)
      }
    }

    if (selectedProvider && selectedModel) {
      this.setProvider(selectedProvider)
      this.setModel(selectedModel)
      this.outputChannel.appendLine(`✅ Default model set: ${selectedProvider.name}/${selectedModel.name}`)
      } else {
      this.outputChannel.appendLine('❌ Failed to select any default model')
    }
  }

  private getDefaultModelForProvider(provider: opencode.Provider): opencode.Model | null {
    if (!provider.models) return null
    
    const defaultNames = ['claude-3-5-sonnet-20241022', 'claude-3-5-sonnet', 'gpt-4', 'gpt-4o']
    
    for (const name of defaultNames) {
      const model = Object.values(provider.models).find(m => m.name.includes(name))
      if (model) return model
    }
    
    return Object.values(provider.models)[0] || null
  }

  async loadAgents(): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    const response = await this.client.app.agents({})
    this.app.agents = response.data
    this.outputChannel.appendLine(`Loaded ${this.app.agents.length} agents`)
    
    this.app.agents.forEach(agent => {
      this.outputChannel.appendLine(`📋 Agent: ${agent.name} (mode: ${agent.mode})`)
    })
  }

  async loadPermissions(): Promise<void> {
    // Permissions managed via event stream, not loaded at startup
    this.app.permissions = []
    this.outputChannel.appendLine('Permissions initialized (managed via event stream)')
  }

  async createSession(): Promise<opencode.Session> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    this.outputChannel.appendLine(`Creating new session...`)
    
    const response = await this.client.session.create({
      query: { directory: this.workspacePath }
    })
    const session = response.data

    this.app.session = session
    this.updateSessionState(session)
    this.sendToWebView('sessionCreated', { session })
    
    this.outputChannel.appendLine(`✅ Session created: ${session.id}`)
    return session
  }


  async getSessions(): Promise<opencode.Session[]> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }
    
    const response = await this.client.session.list({
      query: { directory: this.app.workspacePath }
    })
    
    const sessions = response.data || []
    if (sessions.length > 0) {
      this.outputChannel.appendLine(`📋 Loaded ${sessions.length} sessions`)
    }
    
    return sessions
  }

  async restoreLastSession(): Promise<void> {
    const persistedSessionId = this.getCurrentSessionId()
    
    if (persistedSessionId && await this.isSessionValid(persistedSessionId)) {
      try {
        await this.restoreSession(persistedSessionId)
        this.outputChannel.appendLine(`✅ Restored persisted session: ${persistedSessionId}`)
        return
      } catch (error) {
        this.outputChannel.appendLine(`❌ Failed to restore persisted session: ${error}`)
        this.updateSessionState(null)
      }
    } else if (persistedSessionId) {
      // Session ID exists but is invalid, clear it
      this.outputChannel.appendLine(`❌ Persisted session ${persistedSessionId} is invalid, clearing it`)
      this.updateSessionState(null)
    }
    
    await this.loadMostRecentSession()
  }
  
  private async loadMostRecentSession(): Promise<void> {
    const sessions = await this.getSessions()
    
    if (sessions.length === 0) {
      this.outputChannel.appendLine(`📋 No sessions found for this project`)
      this.updateSessionState(null)
      
      if (this.webviewPanel) {
        this.sendToWebView('sessionSwitched', {
          data: {
            sessionId: null,
            session: null,
            messages: []
          }
      })
    }
      return
    }
    
    const mostRecentSession = sessions[0]
    await this.restoreSession(mostRecentSession.id)
    this.updateSessionState(mostRecentSession)
    
    this.outputChannel.appendLine(`✅ Loaded most recent session: ${mostRecentSession.id}`)
  }

  async switchToSession(sessionId: string): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    // Get session from local sessions list
    const sessions = await this.getSessions()
    const session = sessions.find(s => s.id === sessionId)
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    this.app.session = session
    await this.loadSessionMessages(sessionId)
    this.updateSessionState(session)

    this.outputChannel.appendLine(`✅ Switched to session: ${sessionId}`)
  }

  async switchModel(providerId: string, modelId: string): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    const provider = this.app.providers.find(p => p.id === providerId)
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`)
    }

    const model = provider.models?.[modelId]
    if (!model) {
      throw new Error(`Model not found: ${modelId} in provider ${providerId}`)
    }

    this.setProvider(provider)
    this.setModel(model)

    this.outputChannel.appendLine(`✅ Switched to model: ${provider.name}/${model.name}`)
  }

  async loadSessionMessages(sessionId: string): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    const response = await this.client.session.messages({
      path: { id: sessionId },
      query: { directory: this.workspacePath }
    })

    let messages = response.data || []
    
    // Filter messages based on revert state
    if (this.app.session?.revert?.messageID) {
      const revertMessageID = this.app.session.revert.messageID
      const revertIndex = messages.findIndex(msg => msg.info.id === revertMessageID)
      
      if (revertIndex !== -1) {
        // Keep everything before the revert message
        messages = messages.slice(0, revertIndex)
        this.outputChannel.appendLine(`🔍 Filtered to ${messages.length} messages (revert point at index ${revertIndex})`)
      } else {
        this.outputChannel.appendLine(`⚠️ Revert point message not found in message list`)
    }
  }

    this.app.messages = messages
    this.outputChannel.appendLine(`📋 Loaded ${this.app.messages.length} messages for session ${sessionId}`)
  }

  async updateSession(sessionId: string, title: string): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    await this.client.session.update({
      path: { id: sessionId },
      body: { title },
      query: { directory: this.workspacePath }
    })

    this.outputChannel.appendLine(`✅ Session ${sessionId} title updated: ${title}`)
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    await this.client.session.delete({
      path: { id: sessionId },
      query: { directory: this.workspacePath }
    })

    this.outputChannel.appendLine(`✅ Session ${sessionId} deleted`)
    
    // If we deleted the current session, clear it
    if (this.app.session?.id === sessionId) {
      this.app.session = null
      this.app.messages = []
      this.updateSessionState(null)
    }
  }

  /**
   * Send prompt: creates user message, sends to agent, streams response
   */
  async sendPrompt(text: string, mode: 'plan' | 'build'): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    if (!this.app.session?.id) {
      await this.createSession()
    }

    if (!this.app.session?.id) {
      throw new Error('Failed to create session')
    }

    if (!this.app.provider || !this.app.model) {
      throw new Error('No provider or model selected')
    }

    const messageId = this.generateMessageId()
    const partId = this.generatePartId()
    const now = Date.now()
    
    const userMessage: MessageStruct = {
      info: {
        id: messageId,
        sessionID: this.app.session.id,
        role: 'user',
        time: { created: now }
      } as opencode.UserMessage,
      parts: [{
        type: 'text',
        text: text,
        id: partId,
        messageID: messageId,
        sessionID: this.app.session.id,
        synthetic: false,
        time: { start: now, end: now }
      } as opencode.TextPart]
    }
    
    this.insertMessageByID(userMessage)
    this.sendToWebView('messageUpdated', { messageId, message: userMessage })

    const agent = this.app.agents.find(a => a.name === mode)
    if (!agent) {
      throw new Error(`Agent not found: ${mode}`)
    }
    
    const promptData = {
      path: { id: this.app.session.id },
      body: {
        messageID: messageId,
        model: {
          providerID: this.app.provider.id,
          modelID: this.app.model.id
        },
        agent: agent.name,
        parts: [{
          type: 'text',
          text: text,
          id: partId,
          synthetic: false,
          time: { start: now, end: now }
        } as opencode.TextPartInput]
      },
      query: { directory: this.workspacePath }
    }
    
    try {
      await this.client.session.prompt(promptData)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to send prompt: ${error.message}`)
      throw error
    }
  }

  /**
   * Revert session to message and send new prompt
   */
  async revertToMessage(sessionId: string, messageId: string, newContent: string, mode: 'plan' | 'build', shouldRevert: boolean): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    if (!this.app.provider || !this.app.model) {
      throw new Error('No provider or model selected')
    }

    this.outputChannel.appendLine(`🔄 Reverting to message ${messageId}, shouldRevert: ${shouldRevert}`)

    try {
      // Revert session to message if needed
      if (shouldRevert) {
        const response = await this.client.session.revert({
          path: { id: sessionId },
          body: {
            messageID: messageId
          },
          query: { directory: this.workspacePath }
        })
        
        this.outputChannel.appendLine(`✅ Session reverted to message ${messageId}`)
        
        if (response.data) {
          this.app.session = response.data
          this.outputChannel.appendLine(`🔍 Updated session with revert state: ${response.data.revert ? JSON.stringify(response.data.revert) : 'none'}`)
          
          await this.loadSessionMessages(sessionId)
          this.outputChannel.appendLine(`📋 Reloaded ${this.app.messages.length} messages for revert`)
          
          // Notify frontend before calling prompt
          if (this.webviewPanel && typeof this.webviewPanel.sendMessageToWebview === 'function') {
            this.webviewPanel.sendMessageToWebview({
              type: 'sessionSwitched',
              data: {
                sessionId: sessionId,
                session: response.data,
                messages: this.app.messages
              }
            })
            this.outputChannel.appendLine(`✅ Frontend updated with ${this.app.messages.length} reverted messages`)
          }
        }
      }

      // Send new prompt (will clear revert state)
      const agent = this.app.agents.find(a => a.name === mode)
      if (!agent) {
        throw new Error(`Agent not found: ${mode}`)
      }

      if (!this.app.provider || !this.app.model) {
        throw new Error('No provider or model selected')
      }

      const newMessageId = this.generateMessageId()
      const partId = this.generatePartId()
      const now = Date.now()
      
      const userMessage: MessageStruct = {
        info: {
          id: newMessageId,
          sessionID: sessionId,
          role: 'user',
          time: { created: now }
        } as opencode.UserMessage,
        parts: [{
          type: 'text',
          text: newContent,
          id: partId,
          messageID: newMessageId,
          sessionID: sessionId,
          synthetic: false,
          time: { start: now, end: now }
        } as opencode.TextPart]
      }
      
      this.insertMessageByID(userMessage)
      this.sendToWebView('messageUpdated', { messageId: newMessageId, message: userMessage })

      const promptData = {
        path: { id: sessionId },
        body: {
          messageID: newMessageId,
          model: {
            providerID: this.app.provider.id,
            modelID: this.app.model.id
          },
          agent: agent.name,
          parts: [{
            type: 'text',
            text: newContent,
            id: partId,
            synthetic: false,
            time: { start: now, end: now }
          } as opencode.TextPartInput]
        },
        query: { directory: this.workspacePath }
      }

      await this.client.session.prompt(promptData)
      this.outputChannel.appendLine(`✅ Sent new message after revert`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to revert and send: ${error.message}`)
      throw error
    }
  }

  async grantPermission(permissionId: string): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    await this.client.permission.grant({
      path: { id: permissionId }
    })

    this.outputChannel.appendLine(`Permission granted: ${permissionId}`)
  }

  setProvider(provider: opencode.Provider): void {
    this.app.provider = provider
    this.stateManager.updateState({ provider: provider.id })
    this.stateManager.updateModelUsage(provider.id, '')
    this.stateManager.saveState().catch(error => {
      this.outputChannel.appendLine(`Failed to save provider state: ${error}`)
    })
  }

  setModel(model: opencode.Model): void {
    this.app.model = model
    if (this.app.provider) {
      this.stateManager.updateState({ model: model.id })
      this.stateManager.updateModelUsage(this.app.provider.id, model.id)
      this.stateManager.saveState().catch(error => {
        this.outputChannel.appendLine(`Failed to save model state: ${error}`)
      })
    }
  }

  setAgent(agentName: string): void {
    this.stateManager.updateAgentUsage(agentName)
  }


  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return this.generateID('msg')
  }

  /**
   * Generate unique part ID
   */
  private generatePartId(): string {
    return this.generateID('prt')
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return this.generateID('ses')
  }

  /**
   * Generate unique ID: timestamp + counter + random suffix
   * Format ensures chronological ordering via string comparison
   */
  private generateID(prefix: string): string {
    const currentTimestamp = Date.now()
    
    if (currentTimestamp !== this.lastTimestamp) {
      this.lastTimestamp = currentTimestamp
      this.counter = 0
    }
    this.counter++
    
    const now = BigInt(currentTimestamp) * BigInt(0x1000) + BigInt(this.counter)
    
    const timeBytes = Buffer.alloc(6)
    for (let i = 0; i < 6; i++) {
      timeBytes[i] = Number((now >> BigInt(40 - 8 * i)) & BigInt(0xff))
    }
    const timeHex = timeBytes.toString('hex')
    
    // Generate random base62 suffix (14 chars)
    const randomBase62 = this.randomBase62(14)
    
    return `${prefix}_${timeHex}${randomBase62}`
  }

  /**
   * Insert message maintaining chronological order via ID comparison
   */
  private insertMessageByID(newMessage: MessageStruct): void {
    const newID = newMessage.info.id
    
    let insertIndex = this.app.messages.length
    for (let i = this.app.messages.length - 1; i >= 0; i--) {
      const existingID = this.app.messages[i].info.id
      if (existingID < newID) {
        insertIndex = i + 1
        break
      }
    }
    
    this.app.messages.splice(insertIndex, 0, newMessage)
  }
  

  /**
   * Generate random base62 string
   * Characters: 0-9, A-Z, a-z
   */
  private randomBase62(length: number): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * 62)]
    }
    return result
  }
  

  /**
   * Update model usage tracking
   * Delegates to StateManager
   */
  private updateModelUsage(providerID: string, modelID: string): void {
    this.stateManager.updateModelUsage(providerID, modelID)
  }

  /**
   * Update agent usage tracking
   * Delegates to StateManager
   */
  private updateAgentUsage(agentName: string): void {
    this.stateManager.updateAgentUsage(agentName)
  }

  getApp(): AppStruct {
    return { ...this.app }
  }

  getState(): StateStruct {
    return this.stateManager.getState()
  }

  /**
   * Get frontend state: combines persistent state with runtime objects
   */
  async getFrontendState() {
    const persistentState = this.stateManager.getState()
    
    return {
      ...persistentState,
      
      currentProvider: this.app.provider,
      currentModel: this.app.model,
      providers: this.app.providers,
      agents: this.app.agents,
      sessions: await this.getSessions(),
      currentSession: this.app.session?.id ? this.app.session : null,
      
      // UI state (frontend-specific)
      mode: 'plan' as const,  // Default mode
      status: 'ready' as const,  // Default status
      error: null
    }
  }

  /**
   * Get current session ID (from runtime or persistent state)
   */
  getCurrentSessionId(): string | null {
    // Priority: runtime data first, then persistent data
    if (this.app.session?.id) {
      return this.app.session.id
    }
    
    const state = this.stateManager.getState()
    return state.currentSessionId || null
  }

  private async isSessionValid(sessionId: string): Promise<boolean> {
    try {
      const sessions = await this.getSessions()
      if (sessions.find(s => s.id === sessionId)) {
        return true
      }
      
      if (!this.client) return false
      
      const response = await this.client.session.get({ 
        path: { id: sessionId },
        query: { directory: this.workspacePath }
      })
      return response?.data !== undefined
    } catch {
      return false
    }
  }

  private async restoreSession(sessionId: string): Promise<void> {
    const sessions = await this.getSessions()
    let session = sessions.find(s => s.id === sessionId)
    
    if (!session && this.client) {
      const response = await this.client.session.get({ 
        path: { id: sessionId },
        query: { directory: this.workspacePath }
      })
      
      if (response && 'error' in response && response.error) {
        throw new Error(`Session not found: ${response.error.data?.message || sessionId}`)
      }
      
      session = response?.data
    }
    
    if (!session || !session.id) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    
    this.app.session = session
    await this.loadSessionMessages(sessionId)
    
    if (this.webviewPanel) {
      this.sendToWebView('sessionSwitched', {
        data: {
          sessionId: session.id,
          session: session,
          messages: this.app.messages
        }
      })
    }
    
    this.outputChannel.appendLine(`✅ Restored session: ${session.id}`)
  }

  /**
   * Update session state in persistent storage
   */
  private updateSessionState(session: opencode.Session | null): void {
    this.stateManager.updateState({
      currentSessionId: session?.id || undefined
    })
    // Immediately persist to disk to ensure session continuity
    this.stateManager.saveState().catch(error => {
      this.outputChannel.appendLine(`Failed to save session state: ${error}`)
    })
  }

  /**
   * Save state to persistent storage
   */
  async saveState(): Promise<void> {
    await this.stateManager.saveState()
  }

  /**
   * Load state from persistent storage
   */
  async loadState(): Promise<void> {
    const state = await this.stateManager.loadState()
    this.outputChannel.appendLine('State loaded successfully')
  }

  getCurrentSession(): opencode.Session | null {
    return this.app.session
  }

  getPermissions(): opencode.Permission[] {
    return [...this.app.permissions]
  }

  getMessages(): MessageStruct[] {
    return [...this.app.messages]
  }

  getAvailableModels(): Array<opencode.Model & { providerId: string, providerName: string }> {
    const models: Array<opencode.Model & { providerId: string, providerName: string }> = []
    for (const provider of this.app.providers) {
      if (provider.models) {
        for (const model of Object.values(provider.models)) {
          models.push({ 
            ...model, 
            providerId: provider.id,
            providerName: provider.name
          })
        }
      }
    }
    return models
  }

  async getCurrentSessionMessages(): Promise<MessageStruct[]> {
    if (!this.app.session) {
      return []
    }
    return this.app.messages
  }

  async startEventStream(): Promise<void> {
    if (this.isStreaming) {
      this.outputChannel.appendLine('Event stream already listening')
      return
    }

    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    try {
      this.outputChannel.appendLine('Starting SSE event stream...')
      
      this.abortController = new AbortController()
      
      this.eventStream = await this.client.event.subscribe({
        signal: this.abortController.signal,
        query: { directory: this.workspacePath }
      })
      
      this.processEventStream()
      
      this.isStreaming = true
      this.outputChannel.appendLine('SSE event stream started successfully')
    } catch (error: any) {
      this.outputChannel.appendLine(`Failed to start event stream: ${error.message}`)
      throw error
    }
  }

  async stopEventStream(): Promise<void> {
    if (!this.isStreaming) {
      return
    }

    try {
      if (this.abortController) {
        this.abortController.abort()
      }
      
      if (this.eventStream) {
        await this.eventStream.close()
      }
      
      this.isStreaming = false
      this.outputChannel.appendLine('SSE event stream stopped')
    } catch (error: any) {
      this.outputChannel.appendLine(`Error stopping event stream: ${error.message}`)
    }
  }

  /**
   * Process incoming events from SSE stream
   */
  private async processEventStream(): Promise<void> {
    if (!this.eventStream) {
      return
    }

    try {
      for await (const event of this.eventStream.stream) {
        this.handleEvent(event)
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        this.outputChannel.appendLine(`Event stream error: ${error.message}`)
      }
    }
  }

  /**
   * Handle individual events from SSE stream
   */
  private handleEvent(event: opencode.Event): void {
    // Only log important events
    if (event.type !== 'message.part.updated') {
      this.outputChannel.appendLine(`📨 Received event: ${event.type}`)
    }
    try {
      switch (event.type) {
        case 'message.updated':
          this.handleMessageUpdated(event)
          break
        case 'message.part.updated':
          this.handleMessagePartUpdated(event)
          break
        case 'message.removed':
          this.handleMessageRemoved(event)
          break
        case 'session.updated':
          this.handleSessionUpdated(event)
          break
        case 'session.deleted':
          this.handleSessionDeleted(event)
          break
        case 'session.idle':
          this.handleSessionIdle(event)
          break
        case 'permission.updated':
          this.handlePermissionUpdated(event)
          break
        case 'permission.replied':
          this.handlePermissionReplied(event)
          break
        case 'server.connected':
          this.outputChannel.appendLine(`🔗 Server connected`)
          break
        default:
          this.outputChannel.appendLine(`❓ Unhandled event: ${event.type}`)
      }
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Event error: ${error.message}`)
    }
  }

  /**
   * Handle message updated events
   */
  private handleMessageUpdated(event: opencode.EventMessageUpdated): void {
    const message = event.properties.info
    
    const messageIndex = this.app.messages.findIndex(m => m.info.id === message.id)
    
    if (messageIndex !== -1) {
      this.app.messages[messageIndex].info = message
      
      // Only send messageUpdated for assistant messages that have content
      if (message.role === 'assistant' && this.app.messages[messageIndex].parts.length > 0) {
        this.sendToWebView('messageUpdated', { 
          messageId: message.id,
          message: this.app.messages[messageIndex]
        })
  }
    } else {
      // Insert new message at correct position using ID sorting
      this.insertMessageByID({
        info: message,
        parts: []
      })
      
      // Send messageUpdated for new assistant messages
      if (message.role === 'assistant') {
        this.sendToWebView('messageUpdated', { 
          messageId: message.id,
          message: {
            info: message,
            parts: []
          }
        })
      }
    }
    
    // Check if this is an assistant message completion
    if (message.role === 'assistant') {
      const assistantMessage = message as opencode.AssistantMessage
      if (assistantMessage.time?.completed && assistantMessage.time.completed > 0) {
        this.sendToWebView('streamingCompleted', { messageId: message.id })
        this.isStreaming = false
      }
    }
  }

  /**
   * Handle message part updated events
   */
  private handleMessagePartUpdated(event: opencode.EventMessagePartUpdated): void {
    const part = event.properties.part
    
    // Log details only for tool parts with status changes
    if (part.type === 'tool') {
      const toolPart = part as any
      const status = toolPart.state?.status
      if (status && (status === 'completed' || status === 'error')) {
        this.outputChannel.appendLine(`📦 Tool ${toolPart.tool} ${status}: ${part.id}`)
      }
    }
    
    const messageIndex = this.app.messages.findIndex(m => m.info.id === part.messageID)
    if (messageIndex !== -1) {
      const partIndex = this.app.messages[messageIndex].parts.findIndex(p => p.id === part.id)
      if (partIndex !== -1) {
        this.app.messages[messageIndex].parts[partIndex] = part
      } else {
        this.app.messages[messageIndex].parts.push(part)
  }

      // Send messagePartUpdated for assistant messages with actual content
      if (this.app.messages[messageIndex].info.role === 'assistant') {
        const hasTextContent = part.type === 'text' && part.text && part.text.trim().length > 0
        const hasToolContent = part.type === 'tool'
        const hasReasoningContent = part.type === 'reasoning' && part.text && part.text.trim().length > 0
        
        if (hasTextContent || hasToolContent || hasReasoningContent) {
          this.sendToWebView('messagePartUpdated', { 
            messageId: part.messageID, 
            partId: part.id,
            message: this.app.messages[messageIndex]
          })
        }
      }
    }
  }

  private handleMessageRemoved(event: any): void {
    const { sessionID, messageID } = event.properties
    
    this.outputChannel.appendLine(`🗑️ Message removed: ${messageID} from session ${sessionID}`)
    
    const messageIndex = this.app.messages.findIndex(m => m.info.id === messageID)
    if (messageIndex !== -1) {
      this.app.messages.splice(messageIndex, 1)
      this.outputChannel.appendLine(`🗑️ Removed message from local state, ${this.app.messages.length} messages remaining`)
      
      if (this.webviewPanel) {
        this.sendToWebView('messageRemoved', { messageId: messageID })
      }
    }
  }

  private handleSessionUpdated(event: opencode.EventSessionUpdated): void {
    const session = event.properties.info
    
    this.outputChannel.appendLine(`🔍 Session updated: ${session.id}, revert: ${session.revert ? JSON.stringify(session.revert) : 'none'}`)
    
    this.app.session = session
    this.sendSessionUpdate(session)
    }

  private handleSessionDeleted(event: opencode.EventSessionDeleted): void {
    const session = event.properties.info
    
    if (this.app.session?.id === session.id) {
      this.app.session = null
      this.app.messages = []
      this.updateSessionState(null)
    }
  }

  private handleSessionIdle(event: opencode.EventSessionIdle): void {
    this.sendToWebView('sessionIdle', { sessionID: event.properties.sessionID })
  }

  private handlePermissionUpdated(event: opencode.EventPermissionUpdated): void {
    const permission = event.properties
    
    const index = this.app.permissions.findIndex(p => p.id === permission.id)
    if (index !== -1) {
      this.app.permissions[index] = permission
    } else {
      this.app.permissions.push(permission)
    }
    
    this.sendPermissionRequest(permission)
  }

  private handlePermissionReplied(event: opencode.EventPermissionReplied): void {
    const { permissionID } = event.properties
    
    const index = this.app.permissions.findIndex(p => p.id === permissionID)
    if (index === -1) {
      return
    }
    
    this.app.permissions.splice(index, 1)
    
    if (this.app.currentPermission?.id === permissionID) {
      this.app.currentPermission = null
    }
    
    this.outputChannel.appendLine(`✅ Permission ${permissionID} replied`)
    
    this.sendToWebView('permissionReplied', { permissionID })
  }

  /**
   * Respond to permission request: grant or reject file operations
   */
  async respondToPermission(
    sessionId: string, 
    permissionId: string, 
    response: 'once' | 'always' | 'reject'
  ): Promise<void> {
    if (!this.client) {
      throw new Error('OpenCode client not initialized')
    }

    this.outputChannel.appendLine(`🔄 Responding to permission ${permissionId} with ${response}`)
    
    try {
      // Use underlying client to avoid method loss during bundling
      const underlyingClient = (this.client as any)._client
      
      if (!underlyingClient || !underlyingClient.post) {
        throw new Error('Underlying client or post method not available')
    }

      // Call the API directly
      const url = `/session/${sessionId}/permissions/${permissionId}?directory=${encodeURIComponent(this.workspacePath)}`
      
      await underlyingClient.post({
        url: url,
        body: {
          response: response
        },
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST'
      })
      
      this.outputChannel.appendLine(`✅ Permission ${permissionId} responded successfully`)
      
      // Manually trigger permission.replied event to ensure UI updates
      this.handlePermissionReplied({
        type: 'permission.replied',
        properties: {
          sessionID: sessionId,
          permissionID: permissionId,
          response: response
        }
      } as any)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to respond to permission: ${error.message}`)
      this.outputChannel.appendLine(`❌ Error stack: ${error.stack}`)
      throw error
    }
  }

  isEventStreaming(): boolean {
    return this.isStreaming
  }

  // WebView Communication
  setWebviewPanel(panel: any): void {
    this.webviewPanel = panel
    this.outputChannel.appendLine('WebView panel set')
  }

  clearWebviewPanel(): void {
    this.webviewPanel = null
    this.outputChannel.appendLine('WebView panel cleared')
  }

  /**
   * Send message to webview frontend
   */
  sendToWebView(type: string, data?: any): void {
    if (this.webviewPanel && typeof this.webviewPanel.sendMessageToWebview === 'function') {
      const message = { type, data }
      this.webviewPanel.sendMessageToWebview(message)
      
      if (!['messagePartUpdated', 'sessionUpdated'].includes(type)) {
        this.outputChannel.appendLine(`📤 ${type}`)
      }
    } else {
      this.outputChannel.appendLine(`⚠️ Cannot send message to WebView: panel not available`)
    }
  }

  /**
   * Send session update: converts Session to frontend format
   */
  sendSessionUpdate(session: opencode.Session): void {
    const frontendSession = TypeConverter.sessionToFrontend(session)
    this.sendToWebView('sessionUpdated', frontendSession)
  }

  sendPermissionRequest(permission: opencode.Permission): void {
    this.sendToWebView('permissionRequest', permission)
  }

  isWebViewAvailable(): boolean {
    return this.webviewPanel !== null
  }

  dispose(): void {
    if (this.eventStream) {
      this.eventStream.close()
    }
    if (this.abortController) {
      this.abortController.abort()
    }
    this.webviewPanel = null
  }
}