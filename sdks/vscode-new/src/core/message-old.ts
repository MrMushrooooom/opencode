import { OpenCodeClientWrapper } from './client'
import { Message, PromptParams, PromptResponse } from '../types/app'
import * as vscode from 'vscode'

/**
 * Message Manager
 * Handles all message-related operations
 */
export class MessageManager {
  private client: OpenCodeClientWrapper
  private outputChannel: vscode.OutputChannel

  constructor(client: OpenCodeClientWrapper, outputChannel: vscode.OutputChannel) {
    this.client = client
    this.outputChannel = outputChannel
  }

  /**
   * Get messages for a specific session (from OpenCode server)
   */
  async getMessagesForSession(sessionId: string): Promise<Message[]> {
    try {
      const serverMessages = await this.client.getSessionMessages(sessionId)
      
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
   */
  async sendMessage(params: PromptParams): Promise<PromptResponse> {
    try {
      this.outputChannel.appendLine(`📤 Sending message: "${params.text}"`)
      
      // Generate message ID (following OpenCode format)
      const messageId = this.generateMessageId()
      
      // Build conversation history for context (using OpenCode SDK)
      const conversationHistory = await this.buildConversationHistory(params.sessionId!)
      
      // Prepare prompt parameters
      const promptParams = {
        model: {
          providerID: 'anthropic',
          modelID: 'claude-3-5-sonnet-20241022'
        },
        agent: params.mode,
        messageID: messageId,
        parts: [{
          type: 'text',
          text: params.text
        }],
        // Include conversation context for AI
        context: conversationHistory
      }

      this.outputChannel.appendLine(`📝 Generated messageID: ${messageId}`)
      this.outputChannel.appendLine(`📤 Sending request data: ${JSON.stringify(promptParams, null, 2)}`)

      // Send prompt to OpenCode
      const response = await this.client.sendPrompt(params.sessionId!, promptParams)
      
      this.outputChannel.appendLine(`📥 OpenCode response: ${JSON.stringify(response)}`)

      // Parse response
      const promptResponse: PromptResponse = {
        content: this.parseResponse(response),
        messageId: messageId,
        sessionId: params.sessionId!
      }

      this.outputChannel.appendLine(`✅ Message sent and response received`)
      return promptResponse

    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to send message: ${error.message}`)
      throw error
    }
  }

  /**
   * Generate a unique message ID (following OpenCode Identifier format)
   */
  private generateMessageId(): string {
    // Follow OpenCode's Identifier.ascending("message") format: msg_ + 12 hex + 14 base62
    const timestamp = Date.now()
    const timeHex = timestamp.toString(16).padStart(12, '0')
    const randomBase62 = this.generateRandomBase62(14)
    return `msg_${timeHex}${randomBase62}`
  }

  /**
   * Generate random base62 string (like OpenCode's randomBase62 function)
   */
  private generateRandomBase62(length: number): string {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    let result = ""
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * 62)]
    }
    return result
  }

  /**
   * Build conversation history for context (using OpenCode SDK)
   */
  private async buildConversationHistory(sessionId: string): Promise<any[]> {
    try {
      // Get messages from OpenCode server using SDK
      const messages = await this.client.getSessionMessages(sessionId)
      
      // Convert to OpenCode format for context
      const history = messages.map((msg: any) => ({
        role: msg.info.role,
        content: msg.parts?.find((p: any) => p.type === 'text')?.text || '',
        timestamp: msg.info.time?.created || Date.now(),
        mode: msg.info.mode || 'plan'
      }))
      
      this.outputChannel.appendLine(`📚 Built conversation history: ${history.length} messages from server`)
      return history
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to build conversation history: ${error.message}`)
      return []
    }
  }

  /**
   * Parse OpenCode response to extract content
   */
  private parseResponse(response: any): string {
    try {
      this.outputChannel.appendLine(`🔍 Parsing response: ${JSON.stringify(response)}`)
      
      // Handle OpenCode response format
      if (response.info) {
        const info = response.info
        this.outputChannel.appendLine(`🔍 Found response.info: ${JSON.stringify(info)}`)
        
        // Check for errors first
        if (info.error) {
          const error = info.error
          if (error.name === 'UnknownError' && error.data?.message === 'AI_APICallError: Forbidden') {
            return '❌ API call forbidden. Please check your API key configuration.'
          }
          return `❌ Error: ${error.data?.message || error.name || 'Unknown error'}`
        }
        
        // Extract content from parts (parts is at response level, not info level)
        this.outputChannel.appendLine(`🔍 Checking response.parts: ${response.parts ? 'exists' : 'null'}, isArray: ${Array.isArray(response.parts)}`)
        if (response.parts && Array.isArray(response.parts)) {
          this.outputChannel.appendLine(`🔍 Processing ${response.parts.length} parts`)
          
          const textParts = response.parts
            .filter((part: any) => {
              this.outputChannel.appendLine(`🔍 Part: type=${part.type}, text=${part.text ? part.text.substring(0, 20) + '...' : 'null'}`)
              return part.type === 'text' && part.text
            })
            .map((part: any) => part.text)
            .join('\n')
          
          if (textParts) {
            this.outputChannel.appendLine(`✅ Extracted text from parts: ${textParts.substring(0, 50)}...`)
            return textParts
          }
          
          // If no text parts found, check if this is an empty response
          this.outputChannel.appendLine(`🔍 No text parts found. Parts: ${response.parts.length}, types: ${response.parts.map((p: any) => p.type).join(', ')}`)
          
          // Check if this is just step-start and step-finish (empty response)
          const hasOnlySteps = response.parts.length === 2 && 
            response.parts.every((p: any) => p.type === 'step-start' || p.type === 'step-finish')
          
          if (hasOnlySteps) {
            this.outputChannel.appendLine(`🔍 Detected empty response (only step markers)`)
            return '✅ Request processed successfully (no content returned)'
          }
        }
        
        // If no parts, check for other content fields
        if (info.content) {
          return info.content
        }
        
        if (info.text) {
          return info.text
        }
        
        // If parts is empty but no error, it might be a successful empty response
        if (info.parts && info.parts.length === 0) {
          return '✅ Request processed, but no content returned.'
        }
      }
      
      // Handle direct content fields
      if (response.content) {
        return response.content
      }
      
      if (response.text) {
        return response.text
      }
      
      if (response.message) {
        return response.message
      }
      
      if (typeof response === 'string') {
        return response
      }
      
      // Fallback: stringify the response for debugging
      this.outputChannel.appendLine(`⚠️ Unexpected response format: ${JSON.stringify(response)}`)
      return `⚠️ Unexpected response format, check logs for details.`
    } catch (error) {
      this.outputChannel.appendLine(`❌ Error parsing response: ${error}`)
      return `❌ Error parsing response: ${error}`
    }
  }

  /**
   * Clear messages for a session
   */
  clearMessages(sessionId: string): void {
    this.messages = this.messages.filter(msg => msg.sessionId !== sessionId)
    this.outputChannel.appendLine(`🗑️ Cleared messages for session: ${sessionId}`)
  }

  /**
   * Clear all messages
   */
  clearAllMessages(): void {
    this.messages = []
    this.outputChannel.appendLine('🗑️ Cleared all messages')
  }
}
