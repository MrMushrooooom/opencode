import * as opencode from '@opencode-ai/sdk'
import type { MessageStruct, Prompt } from '../types/app'

/**
 * Message conversion utilities for transforming between different message formats
 * Converts between Prompt, MessageStruct, and session parameters
 */
export class MessageConverter {

  /**
   * Convert Prompt to MessageStruct with text and file attachments
   */
  static async promptToMessage(prompt: Prompt, messageId: string, sessionId: string): Promise<MessageStruct> {
    
    const now = Date.now()
    
    const messageInfo: any = {
      id: messageId,
      sessionID: sessionId,
      role: 'user',
      time: {
        created: now / 1000
      }
    }

    let text = prompt.text
    const textAttachments = prompt.attachments.filter(att => att.type === 'text')
    
    textAttachments.sort((a, b) => a.startIndex - b.startIndex)
    
    for (const att of textAttachments) {
      if (att.startIndex > att.endIndex || att.endIndex > text.length) {
        continue
      }
      text = text.slice(0, att.startIndex) + att.display + text.slice(att.endIndex)
    }

    const parts: any[] = [
      {
        id: this.generatePartId(),
        messageID: messageId,
        sessionID: sessionId,
            type: 'text',
        text: text,
        synthetic: false,
        time: {
          start: now / 1000,
          end: now / 1000
        }
      }
    ]

    for (const attachment of prompt.attachments) {
      if (attachment.type === 'text') {
        continue // Already processed above
      }

      if (attachment.type === 'agent') {
        parts.push({
          id: this.generatePartId(),
          messageID: messageId,
          sessionID: sessionId,
          type: 'agent',
          name: attachment.name || 'agent',
          source: {
            value: attachment.display,
            start: attachment.startIndex,
            end: attachment.endIndex
          }
        } as opencode.AgentPart)
        continue
      }

      // File attachment
      const filePart: any = {
        id: this.generatePartId(),
        messageID: messageId,
        sessionID: sessionId,
        type: 'file',
        filename: attachment.filename || attachment.display,
        mime: attachment.mimeType || 'text/plain',
        url: attachment.url || '',
        source: {
          type: attachment.type === 'symbol' ? 'symbol' : 'file',
          path: attachment.path || '',
          text: {
            start: attachment.startIndex,
            end: attachment.endIndex,
            value: attachment.display
          }
        }
      }

      // Add symbol-specific fields
      if (attachment.type === 'symbol' && attachment.symbolInfo) {
        filePart.source.kind = attachment.symbolInfo.kind
        filePart.source.name = attachment.symbolInfo.name
        filePart.source.range = {
          start: {
            line: attachment.symbolInfo.range.start.line,
            character: attachment.symbolInfo.range.start.character
          },
          end: {
            line: attachment.symbolInfo.range.end.line,
            character: attachment.symbolInfo.range.end.character
      }
        }
      }

      parts.push(filePart)
    }

    return {
      info: messageInfo,
      parts: parts
    }
  }

  /**
   * Convert MessageStruct to Prompt: extracts text and attachments
   */
  static messageToPrompt(message: MessageStruct): Prompt | null {
    if (message.info.role !== 'user') {
      return null
    }

    let text = ''
    const attachments: opencode.File[] = []

    for (const part of message.parts) {
      switch (part.type) {
        case 'text':
          const textPart = part as opencode.TextPart
          if (!textPart.synthetic) {
            text += textPart.text + ' '
          }
          break

        case 'agent':
          const agentPart = part as opencode.AgentPart
          attachments.push({
            type: 'agent',
            path: '',
            status: 'modified',
            added: 0,
            removed: 0,
            display: agentPart.source.value,
            startIndex: agentPart.source.start,
            endIndex: agentPart.source.end,
            name: agentPart.name,
            filename: agentPart.name,
            mimeType: 'text/plain',
            url: ''
          })
          break

        case 'file':
          const filePart = part as opencode.FilePart
          const attachment: opencode.File = {
            type: filePart.source.type === 'symbol' ? 'symbol' : 'file',
            path: filePart.source.path,
            status: 'modified',
            added: 0,
            removed: 0,
            display: filePart.source.text.value,
            startIndex: filePart.source.text.start,
            endIndex: filePart.source.text.end,
            filename: filePart.filename,
            mimeType: filePart.mime,
            url: filePart.url
    }
    
          // Add symbol-specific information
          if (filePart.source.type === 'symbol') {
            attachment.symbolInfo = {
              name: filePart.source.name || '',
              kind: filePart.source.kind || 0,
              range: {
                start: {
                  line: filePart.source.range?.start.line || 0,
                  character: filePart.source.range?.start.character || 0
                },
                end: {
                  line: filePart.source.range?.end.line || 0,
                  character: filePart.source.range?.end.character || 0
                }
              }
            }
          }

          attachments.push(attachment)
          break
      }
    }

    return {
      text: text.trim(),
      attachments: attachments
    }
  }

  /**
   * Convert MessageStruct to session API parameters
   */
  static messageToSessionParams(message: MessageStruct): opencode.SessionPromptParamsPartUnion[] {
    const parts: opencode.SessionPromptParamsPartUnion[] = []

    for (const part of message.parts) {
      switch (part.type) {
        case 'text':
          const textPart = part as opencode.TextPart
          parts.push({
            id: textPart.id,
            type: 'text',
            text: textPart.text,
            synthetic: textPart.synthetic,
            time: {
              start: textPart.time.start,
              end: textPart.time.end
            }
          } as opencode.TextPartInput)
          break

        case 'file':
          const filePart = part as opencode.FilePart
          let source: opencode.FilePartSourceUnionParam

          if (filePart.source.type === 'file') {
            source = {
              type: 'file',
              path: filePart.source.path,
              text: {
                start: filePart.source.text.start,
                end: filePart.source.text.end,
                value: filePart.source.text.value
              }
            } as opencode.FileSourceParam
        } else {
            source = {
              type: 'symbol',
              path: filePart.source.path,
              name: filePart.source.name || '',
              kind: filePart.source.kind || 0,
              range: {
                start: {
                  line: filePart.source.range?.start.line || 0,
                  character: filePart.source.range?.start.character || 0
                },
                end: {
                  line: filePart.source.range?.end.line || 0,
                  character: filePart.source.range?.end.character || 0
                }
              },
              text: {
                start: filePart.source.text.start,
                end: filePart.source.text.end,
                value: filePart.source.text.value
              }
            } as opencode.SymbolSourceParam
          }

          parts.push({
            id: filePart.id,
            type: 'file',
            mime: filePart.mime,
            url: filePart.url,
            filename: filePart.filename,
            source: source
          } as opencode.FilePartInput)
          break

        case 'agent':
          const agentPart = part as opencode.AgentPart
          parts.push({
            id: agentPart.id,
            type: 'agent',
            name: agentPart.name,
            source: {
              value: agentPart.source.value,
              start: agentPart.source.start,
              end: agentPart.source.end
            }
          } as opencode.AgentPartInput)
          break
      }
    }

    return parts
  }

  private static generatePartId(): string {
    return `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
