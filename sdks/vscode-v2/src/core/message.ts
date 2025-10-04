import { OpenCodeAPI } from './api'
import { Message, PromptParams, PromptResponse } from '../types/app'
import * as vscode from 'vscode'

/**
 * Message Manager
 * Handles message-related operations using OpenCode API
 * Similar to TUI's components/chat package
 */
export class MessageManager {
  private api: OpenCodeAPI
  private outputChannel: vscode.OutputChannel
  private streamingMessages: Map<string, string> = new Map()
  private workspacePath: string

  constructor(api: OpenCodeAPI, outputChannel: vscode.OutputChannel, workspacePath: string) {
    this.api = api
    this.outputChannel = outputChannel
    this.workspacePath = workspacePath
  }

  /**
   * Get messages for a specific session (from OpenCode server)
   */
  async getMessagesForSession(sessionId: string): Promise<Message[]> {
    try {
      const serverMessages = await this.api.getSessionMessages(sessionId)
      
      // Convert server messages to our format
      const messages: Message[] = []
      for (const serverMsg of serverMessages) {
        this.outputChannel.appendLine(`🔍 Processing server message: ${serverMsg.info.id}, role: ${serverMsg.info.role}, parts: ${serverMsg.parts?.length || 0}`)
        this.outputChannel.appendLine(`🔍 Server message info: ${JSON.stringify(serverMsg.info, null, 2)}`)
        const content = this.parseResponse({ parts: serverMsg.parts })
        this.outputChannel.appendLine(`📝 Parsed content length: ${content?.length || 0}`)
        if (content) {
          messages.push({
            id: serverMsg.info.id,
            sessionId: sessionId,
            role: serverMsg.info.role,
            content: content,
            timestamp: serverMsg.info.time?.created || Date.now(),
            mode: serverMsg.info.mode || 'plan',
            model: serverMsg.info.modelID || null // Add model information if available
          })
        } else {
          this.outputChannel.appendLine(`⚠️ Skipping message with no content: ${serverMsg.info.id}`)
        }
      }
      
      return messages
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get messages for session: ${error.message}`)
      return []
    }
  }

  /**
   * Send a message to OpenCode
   * Following TUI approach: send prompt and rely entirely on SSE for response
   */
  async sendMessage(params: PromptParams, currentModel?: any): Promise<PromptResponse> {
    try {
      // Generate message ID (following OpenCode format)
      const messageId = this.generateMessageId()

      // Prepare prompt parameters (following TUI's SessionPromptParams structure)
      const promptParams = {
        model: {
          providerID: currentModel?.providerId || 'anthropic',
          modelID: currentModel?.id || 'claude-3-5-sonnet-20241022'
        },
        agent: params.mode || 'plan',
        messageID: messageId,
        parts: [
          {
            id: MessageManager.generatePartId(),
            type: 'text',
            text: params.text
          }
        ],
        // Add workspace context for better directory awareness
        workspace: this.workspacePath
      }

      // Log the actual model parameters being sent to server
      this.outputChannel.appendLine(`🔍 Sending request with model: ${currentModel?.providerId}/${currentModel?.id} (${currentModel?.name})`)
      this.outputChannel.appendLine(`📋 Model parameters: ${JSON.stringify(promptParams.model)}`)
      this.outputChannel.appendLine(`📁 Workspace path: ${this.workspacePath}`)

      // Send prompt to OpenCode (following TUI approach)
      // The actual response will come through SSE, not from this call
      await this.api.sendPrompt(params.sessionId!, promptParams)

      // Return empty response - the actual content will come through SSE
      const promptResponse: PromptResponse = {
        content: '', // Empty - SSE will provide the actual content
        messageId: messageId,
        sessionId: params.sessionId!
      }

      this.outputChannel.appendLine(`📤 Returning prompt response with messageId: ${messageId}`)
      return promptResponse

    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to send message: ${error.message}`)
      throw error
    }
  }


  /**
   * Parse OpenCode response to extract content
   */
  private parseResponse(response: any): string {
    try {
      if (!response || !response.parts) {
        this.outputChannel.appendLine(`⚠️ No response or parts to parse`)
        return ''
      }

      this.outputChannel.appendLine(`🔍 Parsing ${response.parts.length} parts`)
      
      // Extract text content from parts
      const textParts = response.parts.filter((part: any) => part.type === 'text')
      this.outputChannel.appendLine(`📝 Found ${textParts.length} text parts`)
      
      const content = textParts.map((part: any) => part.text).join('\n')
      
      if (content.trim()) {
        this.outputChannel.appendLine(`✅ Extracted content: ${content.substring(0, 50)}...`)
        return content
      } else {
        // If no text content, check for other part types
        const partTypes = response.parts.map((part: any) => part.type)
        this.outputChannel.appendLine(`⚠️ No text content found. Part types: ${partTypes.join(', ')}`)
        
        // If no text content, check if there are tool parts that should be displayed
        const toolParts = response.parts.filter((part: any) => part.type === 'tool')
        if (toolParts.length > 0) {
          this.outputChannel.appendLine(`🔧 Found ${toolParts.length} tool parts, no text content`)
          // CRITICAL FIX: Return a special marker to indicate tool-only message
          // This allows frontend to know this message has tool calls
          return '[TOOL_CALLS_ONLY]'
        }
        
        // If no text content and no tool parts, return empty string
        this.outputChannel.appendLine(`📝 No text or tool content found`)
        return ''
      }
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to parse response: ${error.message}`)
      return `Error parsing response: ${error.message}`
    }
  }

  /**
   * Generate a unique message ID using TUI's exact algorithm
   * This ensures string comparison works correctly for QUEUED logic
   */
  private generateMessageId(): string {
    return MessageManager.generateAscendingId('msg')
  }

  /**
   * Static method to generate ascending IDs (TUI's id.Ascending implementation)
   * This ensures consistent ID generation across all instances
   */
  static generateAscendingId(prefix: string): string {
    return MessageManager.generateId(prefix, false)
  }

  /**
   * Static method to generate descending IDs (TUI's id.Descending implementation)
   */
  static generateDescendingId(prefix: string): string {
    return MessageManager.generateId(prefix, true)
  }

  /**
   * Generate a unique part ID using TUI's exact algorithm
   * Used for TextPart, ToolPart, etc.
   */
  static generatePartId(): string {
    return MessageManager.generateAscendingId('prt')
  }

  /**
   * TUI's exact ID generation algorithm
   * Replicates packages/tui/internal/id/id.go:generateNewID
   */
  private static generateId(prefix: string, descending: boolean): string {
    // Global state (like TUI's package-level variables)
    if (!MessageManager.globalIdState) {
      MessageManager.globalIdState = {
        lastTimestamp: 0,
        counter: 0
      }
    }

    const state = MessageManager.globalIdState
    const currentTimestamp = Date.now()
    
    // Reset counter if timestamp changed (TUI logic)
    if (currentTimestamp !== state.lastTimestamp) {
      state.lastTimestamp = currentTimestamp
      state.counter = 0
    }
    state.counter++
    
    // Combine timestamp and counter (TUI's exact formula)
    let now = BigInt(currentTimestamp) * BigInt(0x1000) + BigInt(state.counter)
    
    // Apply descending logic if needed
    if (descending) {
      now = ~now
    }
    
    // Convert to 6-byte hex string (TUI's exact encoding)
    const timeBytes = Buffer.alloc(6)
    for (let i = 0; i < 6; i++) {
      timeBytes[i] = Number((now >> BigInt(40 - 8 * i)) & BigInt(0xff))
    }
    const timeHex = timeBytes.toString('hex')
    
    // Generate random base62 suffix (TUI's randomBase62)
    // TUI uses length-12 = 26-12 = 14 characters
    const randomBase62 = MessageManager.generateRandomBase62(14)
    
    return `${prefix}_${timeHex}${randomBase62}`
  }

  /**
   * Global state for ID generation (TUI's package-level variables)
   */
  private static globalIdState: {
    lastTimestamp: number
    counter: number
  } | null = null

  /**
   * Generate random base62 string (TUI's randomBase62 implementation)
   */
  private static generateRandomBase62(length: number): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * 62)]
    }
    return result
  }

  /**
   * Handle streaming message part update
   * Following TUI approach: server sends complete accumulated text, not incremental updates
   */
  handleStreamingUpdate(messageId: string, part: any): string | object {
    if (part.type === 'text') {
      // Following TUI approach: server sends complete accumulated text, not incremental updates
      // We should REPLACE the content, not append to it
      const newTextContent = part.text || ''
      
      // Replace the content (server sends complete text each time)
      this.streamingMessages.set(messageId, newTextContent)
      return newTextContent
    } else if (part.type === 'tool') {
      // Handle tool part updates - Following TUI approach
      const currentContent = this.streamingMessages.get(messageId) || ''
      
      if (part.state?.status === 'completed') {
        // Tool execution completed - format like TUI
        const toolOutput = part.state.output || ''
        const toolTitle = part.state.title || part.tool || 'Tool'
        
        // Format tool result similar to TUI's renderToolDetails
        let toolResult = ''
        if (toolOutput) {
          // Truncate long outputs like TUI does
          const truncatedOutput = toolOutput.length > 500 ? 
            toolOutput.substring(0, 500) + '\n\n(Output truncated due to length)' : 
            toolOutput
          toolResult = `**${toolTitle}**\n\n\`\`\`\n${truncatedOutput}\n\`\`\``
        } else {
          toolResult = `**${toolTitle}** - Completed`
        }
        
        // Following TUI approach: append tool results to existing content
        this.streamingMessages.set(messageId, currentContent + '\n\n' + toolResult)
        return this.streamingMessages.get(messageId) || ''
      } else if (part.state?.status === 'error') {
        // Tool execution failed
        const toolError = part.state.error || 'Unknown error'
        const toolTitle = part.state.title || part.tool || 'Tool'
        const errorResult = `**${toolTitle}** - Error\n\n\`\`\`\n${toolError}\n\`\`\``
        this.streamingMessages.set(messageId, currentContent + '\n\n' + errorResult)
        return this.streamingMessages.get(messageId) || ''
      } else if (part.state?.status === 'running') {
        // Tool is running
        const toolTitle = part.state.title || part.tool || 'Tool'
        const runningResult = `**${toolTitle}** - Running...`
        this.streamingMessages.set(messageId, currentContent + '\n\n' + runningResult)
        return this.streamingMessages.get(messageId) || ''
      }
      
      return currentContent
    } else if (part.type === 'step-finish') {
      // Message is complete, remove from streaming
      const finalContent = this.streamingMessages.get(messageId) || ''
      this.streamingMessages.delete(messageId)
      this.outputChannel.appendLine(`✅ Streaming complete: ${finalContent.substring(0, 50)}${finalContent.length > 50 ? '...' : ''}`)
      return finalContent
    }

    const currentContent = this.streamingMessages.get(messageId) || ''
    return currentContent
  }

  /**
   * Check if a message is currently streaming
   */
  isStreaming(messageId: string): boolean {
    return this.streamingMessages.has(messageId)
  }

  /**
   * Get current streaming content for a message
   */
  getStreamingContent(messageId: string): string {
    return this.streamingMessages.get(messageId) || ''
  }

}
