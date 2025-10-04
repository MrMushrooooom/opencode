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
  private webviewCommManager?: any // WebView communication manager

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel
  }

  /**
   * Set WebView communication manager
   */
  setWebviewCommManager(webviewCommManager: any): void {
    this.webviewCommManager = webviewCommManager
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
    
    // Show permission request in WebView
    if (this.webviewCommManager) {
      this.webviewCommManager.showPermissionRequest(this.currentPermission)
    }
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
   * Respond to a specific permission by ID
   */
  async respondToPermissionById(permissionId: string, response: 'once' | 'always' | 'reject'): Promise<void> {
    // Find the permission in the queue
    const permissionIndex = this.permissions.findIndex(p => p.id === permissionId)
    if (permissionIndex === -1 && this.currentPermission?.id !== permissionId) {
      throw new Error(`Permission ${permissionId} not found`)
    }

    try {
      this.outputChannel.appendLine(`🔐 Permission response: ${response} for ${permissionId}`)
      
      // Remove the permission from queue if it exists there
      if (permissionIndex !== -1) {
        this.permissions.splice(permissionIndex, 1)
      }
      
      // Clear current permission if it matches
      if (this.currentPermission?.id === permissionId) {
        this.currentPermission = null
        this.processNextPermission()
      }
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
