import * as vscode from 'vscode'
import { OpenCodeApp } from '../../core/app'
import { Session } from '../../types/app'
import * as path from 'path'
import * as fs from 'fs'

/**
 * OpenCode Webview Panel
 * Manages the main UI interface with modular template system
 */
export class OpenCodePanel {
  private app: OpenCodeApp
  private webview: vscode.WebviewPanel
  private outputChannel: vscode.OutputChannel
  private disposed: boolean = false

  constructor(app: OpenCodeApp, outputChannel: vscode.OutputChannel) {
    this.app = app
    this.outputChannel = outputChannel

    // Create webview panel
    this.webview = vscode.window.createWebviewPanel(
      'opencode-assistant',
      'OpenCode Assistant',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    )

    // Set initial HTML
    this.webview.webview.html = this.getHtmlForWebview()

    // Handle messages from webview
    this.webview.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      []
    )

    // Handle panel disposal
    this.webview.onDidDispose(() => {
      this.disposed = true
      // Clear the webview panel reference in app
      this.app.clearWebviewPanel()
    })

    // Set webview panel reference in app for streaming updates
    this.app.setWebviewPanel(this)
    
    // CRITICAL FIX: Call updateUI immediately after setting the panel
    // This ensures that models, sessions, and messages are loaded and displayed
    // as soon as the panel is created and linked to the app.
    this.updateUI().catch((error: any) => {
      this.outputChannel.appendLine(`❌ Failed to update UI immediately after panel creation: ${error.message}`)
    })
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'sendMessage':
          await this.handleSendMessage(message.text, message.mode)
          break
        case 'createSession':
          await this.handleCreateSession()
          break
        case 'switchSession':
          await this.handleSwitchSession(message.sessionId)
          break
        case 'getState':
          await this.handleGetState()
          break
        case 'getModels':
          await this.handleGetModels()
          break
        case 'getSessions':
          await this.handleGetSessions()
          break
        case 'switchModel':
          await this.handleSwitchModel(message.providerId, message.modelId)
          break
        case 'updateSession':
          await this.handleUpdateSession(message.sessionId, message.updates)
          break
        case 'deleteSession':
          await this.handleDeleteSession(message.sessionId)
          break
        case 'respondToPermission':
          await this.handleRespondToPermission(message.permissionId, message.response)
          break
        case 'undoToMessage':
          await this.handleUndoToMessage(message.messageId, message.partId)
          break
        case 'redoChanges':
          await this.handleRedoChanges()
          break
        case 'debug':
          // Log all debug messages for troubleshooting
          this.outputChannel.appendLine(`🐛 Frontend: ${message.message}`)
          break

        case 'checkServerStatus':
          // Check server status for debugging
          const status = this.app.getServerStatus()
          this.outputChannel.appendLine(`🔍 Server Status:`)
          this.outputChannel.appendLine(`  - Connected: ${status.isConnected}`)
          this.outputChannel.appendLine(`  - Port: ${status.serverPort}`)
          this.outputChannel.appendLine(`  - API Base URL: ${status.apiBaseURL}`)
          this.outputChannel.appendLine(`  - API Initialized: ${status.apiInitialized}`)
          break
        default:
          this.outputChannel.appendLine(`⚠️ Unknown message type: ${message.type}`)
      }
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Error handling message: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle send message
   */
  private async handleSendMessage(text: string, mode: 'plan' | 'build' = 'plan'): Promise<void> {
    try {
      this.outputChannel.appendLine(`📤 Frontend sent message: "${text}" (mode: ${mode})`)
      const response = await this.app.sendMessage(text, mode)
      this.outputChannel.appendLine(`✅ Message sent successfully`)
      
      // Don't call updateUI() here as it resets the current model
      // The message will be handled by SSE streaming updates
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to send message: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle create session
   */
  private async handleCreateSession(): Promise<void> {
    try {
      // TUI approach: Clear chat area first for manual session creation
      this.sendMessageToWebview({
        type: 'clearChat'
      })
      
      const session = await this.app.createNewSession()
      this.outputChannel.appendLine(`✅ New session created: ${session.id}`)
      
      // Send session created message to webview
      this.sendMessageToWebview({
        type: 'sessionCreated',
        session: session
      })
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to create session: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle switch session
   */
  private async handleSwitchSession(sessionId: string): Promise<void> {
    try {
      await this.app.switchToSession(sessionId)
      this.outputChannel.appendLine(`✅ Switched to session: ${sessionId}`)
      
      // Load messages for the new session
      const messages = await this.app.getCurrentSessionMessages()
      this.outputChannel.appendLine(`📋 Loaded ${messages.length} messages for session ${sessionId}`)
      
      // Update UI with new state
      await this.updateUI()
      
      // Send session switched message with messages
      this.outputChannel.appendLine(`📡 Sending sessionSwitched message to webview: ${sessionId}`)
      this.sendMessageToWebview({
        type: 'sessionSwitched',
        sessionId: sessionId,
        messages: messages
      })
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to switch session: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle get state
   */
  private async handleGetState(): Promise<void> {
    try {
      const state = this.app.getState()
      this.sendMessageToWebview({
        type: 'stateUpdate',
        state: state
      })
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get state: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle get models
   */
  private async handleGetModels(): Promise<void> {
    try {
      const models = this.app.getAvailableModels()
      this.sendMessageToWebview({
        type: 'modelsUpdate',
        models: models
      })
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get models: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle get sessions
   */
  private async handleGetSessions(): Promise<void> {
    try {
      const sessions = this.app.getSessions()
      this.sendMessageToWebview({
        type: 'sessionsUpdate',
        sessions: sessions
      })
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get sessions: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle switch model
   */
  private async handleSwitchModel(providerId: string, modelId: string): Promise<void> {
    try {
      await this.app.switchModel(providerId, modelId)
      this.outputChannel.appendLine(`✅ Switched to model: ${providerId}/${modelId}`)
      
      // Update UI with new state
      await this.updateUI()
      
      this.sendMessageToWebview({
        type: 'modelSwitched',
        providerId: providerId,
        modelId: modelId
      })
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to switch model: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle update session
   */
  private async handleUpdateSession(sessionId: string, updates: { title?: string }): Promise<void> {
    try {
      const session = await this.app.updateSession(sessionId, updates)
      this.outputChannel.appendLine(`✅ Session updated: ${sessionId}`)
      
      // Update UI with new state
      await this.updateUI()
      
      this.sendMessageToWebview({
        type: 'sessionUpdated',
        session: session
      })
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to update session: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle delete session
   */
  private async handleDeleteSession(sessionId: string): Promise<void> {
    try {
      await this.app.deleteSession(sessionId)
      this.outputChannel.appendLine(`✅ Session deleted: ${sessionId}`)
      
      // Update UI with new state
      await this.updateUI()
      
      this.outputChannel.appendLine(`📡 Sending sessionDeleteSuccess message to webview: ${sessionId}`)
      this.sendMessageToWebview({
        type: 'sessionDeleteSuccess',
        sessionId: sessionId
      })
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to delete session: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle respond to permission
   */
  private async handleRespondToPermission(permissionId: string, response: 'once' | 'always' | 'reject'): Promise<void> {
    try {
      await this.app.respondToPermission(permissionId, response)
      this.outputChannel.appendLine(`✅ Permission response sent: ${response} for ${permissionId}`)
      
    this.sendMessageToWebview({
        type: 'permissionResponseSuccess',
        permissionId: permissionId,
        response: response
      })
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to respond to permission: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle undo to message
   */
  private async handleUndoToMessage(messageId?: string, partId?: string): Promise<void> {
    try {
      await this.app.undoToMessage(messageId, partId)
      this.outputChannel.appendLine(`✅ Undo completed`)
      
      // Update UI with new state
      await this.updateUI()
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to undo: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle redo changes
   */
  private async handleRedoChanges(): Promise<void> {
    try {
      await this.app.redoChanges()
      this.outputChannel.appendLine(`✅ Redo completed`)
      
      // Update UI with new state
      await this.updateUI()
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to redo: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Update UI with current state
   */
  private async updateUI(): Promise<void> {
    try {
      const state = this.app.getState()
      this.sendMessageToWebview({
        type: 'stateUpdate',
        state: state
      })
      
      // Send models and sessions data to ensure UI is updated
      const models = this.app.getAvailableModels()
      this.outputChannel.appendLine(`📡 Sending ${models.length} models to webview`)
      this.sendMessageToWebview({
        type: 'modelsUpdate',
        models: models
      })
      
      const sessions = this.app.getSessions()
      this.outputChannel.appendLine(`📡 Sending ${sessions.length} sessions to webview`)
      this.sendMessageToWebview({
        type: 'sessionsUpdate',
        sessions: sessions
      })
      
      // If we have a current session, also load its messages
      if (state.currentSession) {
        const messages = await this.app.getCurrentSessionMessages()
        this.outputChannel.appendLine(`📋 Loaded ${messages.length} messages for current session ${state.currentSession.id}`)
        this.sendMessageToWebview({
          type: 'messagesLoaded',
          messages: messages
        })
      }
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to update UI: ${error.message}`)
    }
  }

  /**
   * Check if panel is disposed
   */
  isDisposed(): boolean {
    return this.disposed
  }

  /**
   * Dispose of the panel
   */
  dispose(): void {
    if (!this.disposed) {
      this.disposed = true
      this.webview.dispose()
      this.outputChannel.appendLine('📡 WebView panel disposed')
    }
  }

  /**
   * Show the panel
   */
  show(): void {
    if (!this.disposed) {
      this.webview.reveal()
    }
  }

  /**
   * Send message to webview
   */
  private sendMessageToWebview(message: any): void {
    if (!this.disposed) {
      this.webview.webview.postMessage(message)
    }
  }

  /**
   * Send message to webview
   */
  sendMessage(message: any): void {
    this.sendMessageToWebview(message)
  }

  /**
   * Send streaming update to webview
   */
  sendStreamingUpdate(messageId: string, content: string, partType: string, role?: string): void {
    this.outputChannel.appendLine(`📡 [Panel] Received streaming update from WebviewComm. messageId: ${messageId}, partType: ${partType}, Content (first 100 chars): ${content.substring(0, 100)}... (length: ${content.length})`)
    this.sendMessageToWebview({
      type: 'streamingUpdate',
      messageId: messageId,
      content: content,
      partType: partType,
      role: role
    })
  }

  /**
   * Show permission request in webview
   */
  showPermissionRequest(permission: any): void {
    this.sendMessageToWebview({
      type: 'permissionRequest',
      permission: permission
    })
  }

  /**
   * Get HTML for webview using template system
   */
  private getHtmlForWebview(): string {
    try {
      // Get the path to the template file
      const templatePath = path.join(__dirname, 'components', 'webview', 'templates', 'index.html')
      
      // Read the template file
      const template = fs.readFileSync(templatePath, 'utf8')
      
      // Replace relative paths with webview-compatible URIs
      // webviewUri should point to the webview directory (parent of templates)
      const webviewDir = path.dirname(path.dirname(templatePath)) // Go up from templates to webview
      const webviewUri = this.webview.webview.asWebviewUri(vscode.Uri.file(webviewDir))
      
      // Replace CSS and JS paths
      const html = template
        .replace(/href="styles\//g, `href="${webviewUri}/styles/`)
        .replace(/src="scripts\//g, `src="${webviewUri}/scripts/`)
      
      return html
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to load template: ${error.message}`)
      
      // Fallback to simple HTML
      return this.getFallbackHtml()
    }
  }

  /**
   * Fallback HTML in case template loading fails
   */
  private getFallbackHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenCode Assistant</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }
        .error {
            color: var(--vscode-errorForeground);
            text-align: center;
            margin-top: 50px;
        }
    </style>
</head>
<body>
    <div class="error">
        <h2>OpenCode Assistant</h2>
        <p>Failed to load interface. Please reload the extension.</p>
        </div>
</body>
</html>`
  }
}