import { Permission } from '../../types/app'
import * as vscode from 'vscode'

/**
 * Permission Manager
 * Handles permission requests and responses for BUILD mode operations
 */
export class PermissionManager {
  private permissions: Permission[] = []
  private currentPermission: Permission | null = null
  private outputChannel: vscode.OutputChannel

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel
  }

  /**
   * Add a new permission request to the queue
   */
  addPermission(permission: Permission): void {
    this.permissions.push(permission)
    this.outputChannel.appendLine(`🔐 Permission queued: ${permission.type} - ${permission.description}`)
    
    // Process if no current permission
    if (!this.currentPermission) {
      this.processNextPermission()
    }
  }

  /**
   * Process the next permission in the queue
   */
  private processNextPermission(): void {
    if (this.permissions.length === 0) {
      this.currentPermission = null
      return
    }

    this.currentPermission = this.permissions.shift()!
    this.outputChannel.appendLine(`🔐 Processing permission: ${this.currentPermission.type}`)
    
    // Note: WebView communication is handled by WebViewCommunicationManager
  }

  /**
   * Respond to the current permission request
   */
  async respondToPermission(response: 'once' | 'always' | 'reject'): Promise<void> {
    if (!this.currentPermission) {
      throw new Error('No current permission to respond to')
    }

    try {
      // Here you would typically send the response to the OpenCode server
      // For now, we'll just log it
      this.outputChannel.appendLine(`🔐 Permission response: ${response} for ${this.currentPermission.type}`)
      
      // Clear current permission and process next
      this.currentPermission = null
      this.processNextPermission()
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to respond to permission: ${error.message}`)
      throw error
    }
  }

  /**
   * Get the current permission being processed
   */
  getCurrentPermission(): Permission | null {
    return this.currentPermission
  }

  /**
   * Get all pending permissions
   */
  getPendingPermissions(): Permission[] {
    return [...this.permissions]
  }

  /**
   * Clear all permissions
   */
  clearPermissions(): void {
    this.permissions = []
    this.currentPermission = null
  }
}
