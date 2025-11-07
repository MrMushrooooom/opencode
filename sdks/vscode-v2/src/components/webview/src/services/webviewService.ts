import { WebViewMessage, WebViewService } from '../types'

/**
 * WebView communication service
 * Handles communication between React frontend and VSCode extension
 * Implements the WebViewService interface for type-safe communication
 */
class WebViewServiceImpl implements WebViewService {
  private vscode: any
  private messageHandlers: ((message: WebViewMessage) => void)[] = []

  constructor() {
    // Initialize VSCode API - use existing instance if available
    this.vscode = (window as any).vscodeAPI || (window as any).acquireVsCodeApi?.()
    
    if (!this.vscode) {
      console.warn('VSCode API not available - running in development mode')
    }

    // Listen for messages from VSCode extension
    window.addEventListener('message', (event) => {
      const message = event.data as WebViewMessage
      this.messageHandlers.forEach(handler => handler(message))
    })
  }

  /**
   * Send message to VSCode extension
   * Implements the WebViewService interface
   */
  sendMessage(message: WebViewMessage): void {
    if (this.vscode) {
      this.vscode.postMessage(message)
    } else {
      console.log('Development mode - would send message:', message)
    }
  }

  /**
   * Alias for sendMessage for compatibility
   */
  postMessage(message: WebViewMessage): void {
    this.sendMessage(message)
  }

  /**
   * Register message handler for incoming messages
   * Implements the WebViewService interface
   */
  onMessage(callback: (message: WebViewMessage) => void): void {
    this.messageHandlers.push(callback)
  }


  /**
   * Show session history dialog
   */
  showSessionHistory(): void {
    this.sendMessage({
      type: 'showSessionHistory'
    })
  }

  /**
   * Show model selector dialog
   */
  showModelSelector(): void {
    this.sendMessage({
      type: 'showModelSelector'
    })
  }

  /**
   * Show agent selector dialog
   */
  showAgentSelector(): void {
    this.sendMessage({
      type: 'showAgentSelector'
    })
  }

  /**
   * Send user prompt
   */
  sendUserPrompt(text: string, mode: 'plan' | 'build'): void {
    this.sendMessage({
      type: 'sendPrompt',
      data: { text, mode }
    })
  }

  /**
   * Send user prompt with images
   */
  sendUserPromptWithImages(text: string, mode: 'plan' | 'build', images: Array<{ data: string; name: string; mime: string }>): void {
    this.sendMessage({
      type: 'sendPromptWithImages',
      data: { text, mode, images }
    })
  }

  /**
   * Switch to different session
   */
  switchSession(sessionId: string): void {
    this.sendMessage({
      type: 'switchSession',
      data: { sessionId }
    })
  }

  /**
   * Create new session
   */
  createSession(): void {
    this.sendMessage({
      type: 'createSession'
    })
  }

  /**
   * Update session title
   */
  updateSession(sessionId: string, title: string): void {
    this.sendMessage({
      type: 'updateSession',
      data: { sessionId, title }
    })
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): void {
    this.sendMessage({
      type: 'deleteSession',
      data: { sessionId }
    })
  }

  /**
   * Undo last change
   */
  undo(): void {
    this.sendMessage({
      type: 'undo'
    })
  }

  /**
   * Redo last undone change
   */
  redo(): void {
    this.sendMessage({
      type: 'redo'
    })
  }

  /**
   * Toggle thinking blocks visibility
   */
  toggleThinkingBlocks(): void {
    this.sendMessage({
      type: 'toggleThinkingBlocks'
    })
  }

  /**
   * Toggle tool details visibility
   */
  toggleToolDetails(): void {
    this.sendMessage({
      type: 'toggleToolDetails'
    })
  }

  /**
   * Respond to permission request
   */
  respondToPermission(sessionID: string, permissionID: string, response: 'once' | 'always' | 'reject'): void {
    this.sendMessage({
      type: 'permissionRespond',
      data: {
        sessionID,
        permissionID,
        response
      }
    })
  }
}

// Export singleton instance
export const webViewService = new WebViewServiceImpl()
