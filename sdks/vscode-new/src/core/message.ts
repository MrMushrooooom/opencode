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

  constructor(api: OpenCodeAPI, outputChannel: vscode.OutputChannel) {
    this.api = api
    this.outputChannel = outputChannel
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
        const content = this.parseResponse({ parts: serverMsg.parts })
        if (content) {
          messages.push({
            id: serverMsg.info.id,
            sessionId: sessionId,
            role: serverMsg.info.role,
            content: content,
            timestamp: serverMsg.info.time?.created || Date.now(),
            mode: serverMsg.info.mode || 'plan'
          })
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
            type: 'text',
            text: params.text
          }
        ]
      }

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
        return ''
      }

      // Extract text content from parts
      const textParts = response.parts.filter((part: any) => part.type === 'text')
      const content = textParts.map((part: any) => part.text).join('\n')
      
      if (content.trim()) {
        return content
      } else {
        // If no text content, but steps are completed, provide a default response
        const stepStartParts = response.parts.filter((part: any) => part.type === 'step-start')
        const stepFinishParts = response.parts.filter((part: any) => part.type === 'step-finish')
        if (stepStartParts.length > 0 && stepFinishParts.length > 0) {
          return 'Yes, I can help you modify code. What specific changes would you like me to make?'
        }
        return ''
      }
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to parse response: ${error.message}`)
      return `Error parsing response: ${error.message}`
    }
  }

  /**
   * Generate a unique message ID (following OpenCode Identifier format exactly)
   * Using the same algorithm as TUI's id.Ascending(id.Message)
   */
  private generateMessageId(): string {
    // Follow OpenCode's Identifier.ascending("message") format exactly
    // This matches the TUI's id.Ascending(id.Message) implementation
    
    const currentTimestamp = Date.now()
    
    // Use a simple counter for uniqueness within the same millisecond
    // This is a simplified version of the TUI's monotonic counter
    const counter = Math.floor(Math.random() * 4096) // 0-4095 range
    
    // Combine timestamp and counter like TUI does
    const combined = BigInt(currentTimestamp) * BigInt(0x1000) + BigInt(counter)
    
    // Convert to 6-byte hex string (12 hex chars)
    const timeBytes = Buffer.alloc(6)
    for (let i = 0; i < 6; i++) {
      timeBytes[i] = Number((combined >> BigInt(40 - 8 * i)) & BigInt(0xff))
    }
    const timeHex = timeBytes.toString('hex')
    
    // Generate 14 base62 characters
    const randomBase62 = this.generateRandomBase62(14)
    
    return `msg_${timeHex}${randomBase62}`
  }

  /**
   * Generate random base62 string
   */
  private generateRandomBase62(length: number): string {
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
  handleStreamingUpdate(messageId: string, part: any): string {
    if (part.type === 'text') {
      // Server sends complete accumulated text, not incremental updates
      // Following TUI approach: replace the content, don't accumulate
      const completeContent = part.text || ''
      this.streamingMessages.set(messageId, completeContent)
      return completeContent
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
