import * as vscode from 'vscode'
import { OpenCodeApp } from '../../core/app'
// @ts-ignore
import type { Session } from '@opencode-ai/sdk'
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
  private isInErrorState: boolean = false

  constructor(app: OpenCodeApp, outputChannel: vscode.OutputChannel) {
    this.app = app
    this.outputChannel = outputChannel

    // Create webview panel
    this.webview = vscode.window.createWebviewPanel(
      'opencode-v2-assistant',
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
        case 'sendPrompt':
          if (message.data?.text && message.data?.mode) {
            await this.handleSendPrompt(message.data.text, message.data.mode)
          } else {
            this.outputChannel.appendLine(`❌ Invalid sendPrompt message: missing text or mode`)
          }
          break
        case 'sendPromptWithImages':
          if (message.data?.text && message.data?.mode && message.data?.images) {
            await this.handleSendPromptWithImages(message.data.text, message.data.mode, message.data.images)
          } else {
            this.outputChannel.appendLine(`❌ Invalid sendPromptWithImages message: missing text, mode, or images`)
          }
          break
        case 'createSession':
          await this.handleCreateSession()
          break
        case 'switchSession':
          if (message.data?.sessionId) {
            await this.handleSwitchSession(message.data.sessionId)
          } else {
            this.outputChannel.appendLine(`❌ Invalid switchSession message: missing sessionId`)
          }
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
          if (message.data?.providerId && message.data?.modelId) {
            await this.handleSwitchModel(message.data.providerId, message.data.modelId)
          } else {
            this.outputChannel.appendLine(`❌ Invalid switchModel message: missing providerId or modelId`)
          }
          break
        case 'updateSession':
          await this.handleUpdateSession(message.data.sessionId, { title: message.data.title })
          break
        case 'deleteSession':
          await this.handleDeleteSession(message.data.sessionId)
          break
        case 'respondToPermission':
          await this.handleRespondToPermission(message.data.permissionId, message.data.response)
          break
        case 'permissionRespond':
          // Frontend sends response when user clicks on permission dialog
          await this.handleRespondToPermission(message.data.permissionID, message.data.response)
          break
        case 'changeMode':
          if (message.data?.mode) {
            // Mode change is handled by frontend state management
            // Just acknowledge the change
            this.outputChannel.appendLine(`Mode changed to: ${message.data.mode}`)
          }
          break
        case 'undoToMessage':
          await this.handleUndoToMessage(message.data.messageId, message.data.partId)
          break
        case 'redoChanges':
          await this.handleRedoChanges()
          break

        case 'checkServerStatus':
          // Check server status for debugging
          this.outputChannel.appendLine(`🔍 Server Status:`)
          this.outputChannel.appendLine(`  - Connected: ${this.app.getCurrentSession() ? 'Yes' : 'No'}`)
          this.outputChannel.appendLine(`  - Sessions: ${await this.app.getSessions()}`)
          break
        case 'debug':
          // Handle debug messages from frontend
          const debugMessage = message.data?.message || message.message || 'Unknown debug message'
          this.outputChannel.appendLine(`🐛 Debug: ${debugMessage}`)
          break
        case 'initialize':
          // Handle frontend initialization request
          this.outputChannel.appendLine('🔄 Frontend initialization requested')
          // Send initial data to frontend
          await this.updateUI()
          break
        case 'startEditMessage':
          // Handle message edit request
          if (message.data?.messageId && message.data?.content) {
            this.outputChannel.appendLine(`✏️ Starting edit for message ${message.data.messageId}`)
            this.outputChannel.appendLine(`📝 Content: ${message.data.content}`)
          }
          break
        case 'revertToMessage':
          // Handle revert to message request
          if (message.data?.sessionId && message.data?.messageId && message.data?.content && message.data?.shouldRevert !== undefined && message.data?.mode) {
            const { sessionId, messageId, content, shouldRevert, mode } = message.data
            await this.app.revertToMessage(sessionId, messageId, content, mode, shouldRevert)
          }
          break
        case 'openFile':
          // Handle open file request
          if (message.data?.filePath) {
            const filePath = message.data.filePath
            try {
              const uri = vscode.Uri.file(filePath)
              await vscode.window.showTextDocument(uri, {
                preview: false  // 禁用预览模式，确保在新标签页中打开，不会被替换
              })
              this.outputChannel.appendLine(`✅ Opened file: ${filePath}`)
            } catch (error: any) {
              this.outputChannel.appendLine(`❌ Failed to open file ${filePath}: ${error.message}`)
              vscode.window.showErrorMessage(`Failed to open file: ${error.message}`)
            }
          }
          break
        default:
          this.outputChannel.appendLine(`⚠️ Unknown message type: ${message.type}`)
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error'
      this.outputChannel.appendLine(`❌ Error handling message: ${errorMessage}`)
      
      // Prevent infinite error loops by not sending error messages back to frontend
      // if we're already in an error state
      if (!this.isInErrorState) {
        this.isInErrorState = true
      this.sendMessageToWebview({
        type: 'error',
          error: errorMessage
      })
        // Reset error state after a short delay
        setTimeout(() => {
          this.isInErrorState = false
        }, 1000)
      }
    }
  }

  /**
   * Handle send prompt
   */
  private async handleSendPrompt(text: string, mode: 'plan' | 'build' = 'plan'): Promise<void> {
    try {
      this.outputChannel.appendLine(`📤 Frontend sent message: "${text}" (mode: ${mode})`)
      const response = await this.app.sendPrompt(text, mode)
      this.outputChannel.appendLine(`✅ Message sent successfully`)
      
      // Don't call updateUI here as it resets the streaming status
      // The SSE events will handle UI updates during streaming
      
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to send message: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle send prompt with images
   */
  private async handleSendPromptWithImages(text: string, mode: 'plan' | 'build', images: Array<{ data: string; name: string; mime: string }>): Promise<void> {
    try {
      this.outputChannel.appendLine(`📤 Frontend sent message with ${images.length} image(s): "${text}" (mode: ${mode})`)
      
      // Convert base64 images to opencode.File format
      const imageAttachments = images.map((image) => {
        return {
          type: 'file' as const,
          filename: image.name,
          mimeType: image.mime,
          url: image.data, // Use base64 data URL for image attachments
          display: image.data, // Store base64 data URL for display
          path: '', // No file path for uploaded images
          startIndex: text.length, // Append to end of text
          endIndex: text.length
        }
      })
      
      await this.app.sendPromptWithAttachments(text, mode, imageAttachments)
      this.outputChannel.appendLine(`✅ Message with images sent successfully`)
      
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to send message with images: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }

  /**
   * Handle respond to permission request
   */
  private async handleRespondToPermission(permissionId: string, response: 'once' | 'always' | 'reject'): Promise<void> {
    try {
      const session = this.app.getCurrentSession()
      if (!session?.id) {
        throw new Error('No active session')
      }
      
      await this.app.respondToPermission(session.id, permissionId, response)
      this.outputChannel.appendLine(`✅ Permission ${permissionId} responded: ${response}`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to respond to permission: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        error: error.message
      })
    }
  }
  private async handleCreateSession(): Promise<void> {
    try {
      const session = await this.app.createSession()
      
      // Clear current messages and switch to new session
      this.sendMessageToWebview({
        type: 'sessionSwitched',
        data: {
          sessionId: session.id,
          session: session,
          messages: []
        }
      })
      
      this.outputChannel.appendLine(`✅ New session created: ${session.id}`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to create session: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        data: { error: error.message }
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
      const session = this.app.getCurrentSession()
      this.sendMessageToWebview({
        type: 'sessionSwitched',
        data: {
        sessionId: sessionId,
          session: session,
        messages: messages
        }
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
      const state = await this.app.getFrontendState()
      this.sendMessageToWebview({
        type: 'stateUpdate',
        data: { state: state }
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
        data: { models: models }
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
        data: { sessions: sessions }
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
   * Updates backend state and sends modelChanged message to frontend
   * Does not call updateUI to avoid reloading messages during streaming
   */
  private async handleSwitchModel(providerId: string, modelId: string): Promise<void> {
    try {
      await this.app.switchModel(providerId, modelId)
      
      // Get updated state for validation and frontend sync
      const state = await this.app.getFrontendState()
      
      // Validate state before sending to frontend
      if (!state.currentProvider || !state.currentModel) {
        this.outputChannel.appendLine(`⚠️ Warning: Provider or Model is null after switch`)
        this.sendMessageToWebview({
          type: 'error',
          error: 'Failed to switch model: Provider or Model is null'
        })
        return
      }
      
      // Send modelChanged message with complete provider and model objects
      // This updates frontend state without reloading messages (avoids streaming conflicts)
      this.sendMessageToWebview({
        type: 'modelChanged',
        data: {
          provider: state.currentProvider,
          model: state.currentModel
        }
      })
      
      this.outputChannel.appendLine(`✅ Switched to model: ${state.currentProvider.name}/${state.currentModel.name}`)
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
      await this.app.updateSession(sessionId, updates.title || '')
      
      // Reload sessions to get updated data
      const sessions = await this.app.getSessions()
      this.sendMessageToWebview({
        type: 'sessionsUpdate',
        data: { sessions }
      })
      
      // Also send sessionUpdated for specific update
      this.sendMessageToWebview({
        type: 'sessionUpdated',
        data: { sessionId, updates }
      })
      
      this.outputChannel.appendLine(`✅ Session ${sessionId} updated`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to update session: ${error.message}`)
    }
  }

  private async handleDeleteSession(sessionId: string): Promise<void> {
    try {
      await this.app.deleteSession(sessionId)
      
      // If deleted session was current, create or load another session
      const currentSession = this.app.getCurrentSession()
      if (currentSession?.id === sessionId) {
        const sessions = await this.app.getSessions()
        if (sessions.length > 0) {
          await this.app.switchToSession(sessions[0].id)
        } else {
          await this.app.createSession()
        }
      }
      
      // Update frontend state
      const sessions = await this.app.getSessions()
      this.sendMessageToWebview({
        type: 'sessionsUpdate',
        data: { sessions }
      })
      
      this.outputChannel.appendLine(`✅ Session ${sessionId} deleted`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to delete session: ${error.message}`)
    }
  }


  /**
   * Handle undo to message
   */
  private async handleUndoToMessage(messageId?: string, partId?: string): Promise<void> {
    try {
      this.outputChannel.appendLine(`↩️ Undoing to message: ${messageId}, part: ${partId}`)
      // TODO: Implement undo logic
      this.outputChannel.appendLine(`✅ Undo completed successfully`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to undo: ${error.message}`)
    }
  }

  /**
   * Handle redo changes
   */
  private async handleRedoChanges(): Promise<void> {
    try {
      this.outputChannel.appendLine(`↪️ Redoing changes`)
      // TODO: Implement redo logic
      this.outputChannel.appendLine(`✅ Redo completed successfully`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to redo: ${error.message}`)
    }
  }

  /**
   * Update UI with current state
   */
  async updateUI(): Promise<void> {
    try {
      const state = await this.app.getFrontendState()
      
      this.sendMessageToWebview({
        type: 'stateUpdate',
        data: { state: state }
      })
      
      // Send models and sessions data to ensure UI is updated
      const models = this.app.getAvailableModels()
      
      this.sendMessageToWebview({
        type: 'modelsUpdate',
        data: { models: models }
      })
      
      const sessions = await this.app.getSessions()
      this.sendMessageToWebview({
        type: 'sessionsUpdate',
        data: { sessions: sessions }
      })
      
      // If we have a current session, also load its messages
      if (state.currentSession) {
        const messages = await this.app.getCurrentSessionMessages()
        this.sendMessageToWebview({
          type: 'messagesLoaded',
          data: { messages: messages }
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
  sendMessageToWebview(message: any): void {
    if (!this.disposed) {
      this.webview.webview.postMessage(message)
    }
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
      // Use absolute path to the React app build output
      // This is the standard approach for VSCode extensions
      const extensionPath = path.dirname(__dirname) // Go up from dist to vscode-v2 root
      const templatePath = path.join(extensionPath, 'src', 'components', 'webview', 'dist', 'index.html')
      
      // Read the React app template
      const template = fs.readFileSync(templatePath, 'utf8')
      
      // Get webview URI for the dist directory
      const webviewDir = path.dirname(templatePath)
      const webviewUri = this.webview.webview.asWebviewUri(vscode.Uri.file(webviewDir))
      
      // Replace bundle.js path with webview URI
      const html = template.replace(
        'src="bundle.js"',
        `src="${webviewUri}/bundle.js"`
      )
      
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