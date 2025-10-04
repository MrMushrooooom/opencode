import * as vscode from 'vscode'

/**
 * WebView Communication Manager
 * Centralized communication hub between the main extension and WebView
 * All WebView communication goes through this manager
 */
export class WebViewCommunicationManager {
  private webviewPanel: any
  private outputChannel: vscode.OutputChannel

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel
  }

  /**
   * Set webview panel reference
   */
  setWebviewPanel(panel: any): void {
    this.webviewPanel = panel
    this.outputChannel.appendLine(`📡 WebView panel set`)
  }

  /**
   * Clear webview panel reference
   */
  clearWebviewPanel(): void {
    this.webviewPanel = null
    this.outputChannel.appendLine(`📡 WebView panel cleared`)
  }

  /**
   * Send streaming update to webview
   */
  sendStreamingUpdate(messageId: string, content: string | object, partType: string, role?: string): void {
    if (this.webviewPanel) {
      // Convert object content to JSON string for message-updated events
      const contentString = typeof content === 'object' ? JSON.stringify(content) : content
      this.outputChannel.appendLine(`📡 [WebviewComm] Sending streaming update to panel. messageId: ${messageId}, partType: ${partType}, ContentString (first 100 chars): ${contentString.substring(0, 100)}... (length: ${contentString.length})`)
      this.webviewPanel.sendStreamingUpdate(messageId, contentString, partType, role)
      this.outputChannel.appendLine(`📡 Streaming update sent: ${messageId}`)
    }
  }

  /**
   * Send message to webview
   */
  sendMessage(message: any): void {
    if (this.webviewPanel) {
      this.webviewPanel.sendMessageToWebview(message)
      this.outputChannel.appendLine(`📡 Message sent: ${message.type}`)
    }
  }

  /**
   * Show permission request in webview
   */
  showPermissionRequest(permission: any): void {
    if (this.webviewPanel) {
      this.webviewPanel.showPermissionRequest(permission)
      this.outputChannel.appendLine(`📡 Permission request shown: ${permission.type}`)
    }
  }

  /**
   * Send undo success message to webview
   */
  sendUndoSuccess(messageId?: string, partId?: string, revertInfo?: any, lastUserMessage?: string): void {
    if (this.webviewPanel) {
      this.webviewPanel.sendMessage({
        type: 'undoSuccess',
        messageId: messageId,
        partId: partId,
        revertInfo: revertInfo,
        lastUserMessage: lastUserMessage
      })
      this.outputChannel.appendLine(`📡 Undo success sent: ${messageId || 'latest'}`)
    }
  }

  /**
   * Send redo success message to webview
   */
  sendRedoSuccess(): void {
    if (this.webviewPanel) {
      this.webviewPanel.sendMessage({
        type: 'redoSuccess'
      })
      this.outputChannel.appendLine(`📡 Redo success sent`)
    }
  }

  /**
   * Check if webview is available
   */
  isWebViewAvailable(): boolean {
    return this.webviewPanel !== null
  }

  /**
   * Get webview panel reference
   */
  getWebviewPanel(): any {
    return this.webviewPanel
  }
}
