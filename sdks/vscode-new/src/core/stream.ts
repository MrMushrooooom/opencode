import { OpenCodeAPI } from './api'
import * as vscode from 'vscode'

/**
 * Event Stream Manager
 * Handles real-time events from OpenCode server using SSE
 * Similar to TUI's SSE event handling
 */
export class EventStreamManager {
  private api: OpenCodeAPI
  private outputChannel: vscode.OutputChannel
  private isListening: boolean = false
  private eventStream?: any // OpenCode SDK event stream
  private abortController?: AbortController
  private messageRoles: Map<string, string> = new Map() // messageId -> role mapping

  constructor(api: OpenCodeAPI, outputChannel: vscode.OutputChannel) {
    this.api = api
    this.outputChannel = outputChannel
  }

  /**
   * Start listening for events using SSE
   */
  async startListening(
    onMessageUpdate: (messageId: string, part: any) => void,
    onSessionUpdate: (session: any) => void
  ): Promise<void> {
    if (this.isListening) {
      this.outputChannel.appendLine('⚠️ Event stream already listening')
      return
    }

    try {
      this.outputChannel.appendLine('🔄 Starting SSE event stream...')
      
      // Create abort controller for cleanup
      this.abortController = new AbortController()
      
      // Start SSE stream using OpenCode SDK
      this.eventStream = await this.api.startEventStream(this.abortController.signal)
      
      // Process events as they come in
      this.processEventStream(onMessageUpdate, onSessionUpdate)
      
      this.isListening = true
      this.outputChannel.appendLine('✅ SSE event stream started')
      
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to start event stream: ${error.message}`)
      throw error
    }
  }

  /**
   * Process incoming events from the stream
   */
  private async processEventStream(
    onMessageUpdate: (messageId: string, part: any) => void,
    onSessionUpdate: (session: any) => void
  ): Promise<void> {
    try {
      // JavaScript SDK returns an async generator
      for await (const event of this.eventStream.stream) {
        if (this.abortController?.signal.aborted) {
          break
        }

        // Handle different event types based on actual server event format
        if (event.type) {
          switch (event.type) {
            case 'message.part.updated':
              if (event.properties?.part) {
                // Include role information from our mapping
                const role = this.messageRoles.get(event.properties.part.messageID) || 'unknown'
                const partWithRole = {
                  ...event.properties.part,
                  role: role
                }
                onMessageUpdate(event.properties.part.messageID, partWithRole)
              }
              break
              
            case 'message.updated':
              if (event.properties?.info) {
                // Store role information for this message ID
                this.messageRoles.set(event.properties.info.id, event.properties.info.role)
              }
              break
              
            case 'session.updated':
              if (event.properties?.info) {
                onSessionUpdate(event.properties.info)
              }
              break
              
            case 'server.connected':
              this.outputChannel.appendLine(`🌐 Server connected event received`)
              break
              
            case 'session.idle':
              this.outputChannel.appendLine(`💤 Session idle event received`)
              break
              
            default:
              this.outputChannel.appendLine(`📥 Unhandled event type: ${event.type}`)
          }
        } else {
          // Handle events without explicit type field
          this.outputChannel.appendLine(`📥 Received event without type: ${JSON.stringify(event)}`)
        }
      }
    } catch (error: any) {
      if (!this.abortController?.signal.aborted) {
        this.outputChannel.appendLine(`❌ Event stream error: ${error.message}`)
      }
    }
  }

  /**
   * Stop listening for events
   */
  stopListening(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = undefined
    }
    this.eventStream = undefined
    this.isListening = false
    this.outputChannel.appendLine('🛑 SSE event stream stopped')
  }

  /**
   * Check if currently listening
   */
  isActive(): boolean {
    return this.isListening
  }
}