import React, { useState, useEffect, useRef } from 'react'
import { Typography, Space, Button, Input, Modal, Tag } from 'antd'
import { EditOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Message, Part } from '../../types'
import { useCurrentPermission, useAppStore } from '../../store'
import { webViewService } from '../../services/webviewService'
import { ImageThumbnail } from './ImageThumbnail'
import { ImagePreviewModal } from './ImagePreviewModal'
import { ToolPartCard } from './ToolPartCard'
import { ToolInlineDisplay } from './ToolInlineDisplay'

const { Text, Paragraph } = Typography
const { TextArea } = Input
const { confirm } = Modal

interface MessageItemProps {
  message: Message
  showThinkingBlocks: boolean
  showToolDetails: boolean
  isQueued: boolean
  needsExtraSpacing: boolean
  currentSessionId?: string
  isLastCompletedMessage?: boolean // Only show metadata for the last completed message
}

/**
 * Individual message item component
 * Renders user and assistant messages with proper styling and metadata
 */
export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  showThinkingBlocks,
  showToolDetails,
  isQueued,
  needsExtraSpacing,
  currentSessionId,
  isLastCompletedMessage = false
}) => {
  const isUser = message.info.role === 'user'
  const isAssistant = message.info.role === 'assistant'
  const currentPermission = useCurrentPermission()
  const editingMessageId = useAppStore(state => state.editingMessageId)
  const setEditingMessageId = useAppStore(state => state.setEditingMessageId)
  const mode = useAppStore(state => state.mode)
  
  const handlePermissionRespond = (response: 'once' | 'always' | 'reject') => {
    if (!currentPermission || !currentSessionId) return
    webViewService.respondToPermission(currentSessionId, currentPermission.id, response)
  }

  // Extract text content from message parts
  const extractTextContent = () => {
    return message.parts
      .filter(part => part.type === 'text')
      .map(part => (part as any).text || (part as any).content || '')
      .join('')
  }

  const handleStartEdit = (messageId: string) => {
    setEditingMessageId(messageId)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
  }

  const handleSend = () => {
    if (!editText.trim()) return
    
    confirm({
      title: 'Submit from a previous message?',
      icon: <ExclamationCircleOutlined />,
      content: 'Submitting from a previous message will revert file changes to before this message and clear the messages after this one.',
      okText: 'Continue and revert',
      okType: 'primary',
      cancelText: 'Cancel',
      centered: true,
      width: 480,
      styles: {
        mask: { backgroundColor: 'rgba(0, 0, 0, 0.6)' },
        content: {
          background: '#2d2d30',
          borderRadius: '8px',
          border: '1px solid #3e3e42'
        },
        header: {
          background: '#2d2d30',
          borderBottom: '1px solid #3e3e42',
          color: '#cccccc'
        },
        body: { 
          color: '#cccccc'
        }
      },
      onOk() {
        // Continue and revert
        if (!currentSessionId) return
        Modal.destroyAll()
        webViewService.sendMessage({
          type: 'revertToMessage',
          data: {
            sessionId: currentSessionId,
            messageId: message.info.id,
            content: editText,
            shouldRevert: true,
            mode: mode
          }
        })
        setEditingMessageId(null)
      },
      footer: (_, { OkBtn, CancelBtn }) => (
        <>
          <Button 
            onClick={() => {
              // Continue without reverting
              if (!currentSessionId) return
              Modal.destroyAll()
              webViewService.sendMessage({
                type: 'revertToMessage',
                data: {
                  sessionId: currentSessionId,
                  messageId: message.info.id,
                  content: editText,
                  shouldRevert: false,
                  mode: mode
                }
              })
              setEditingMessageId(null)
            }}
          >
            Continue without reverting
          </Button>
          <CancelBtn />
          <OkBtn />
        </>
      )
    })
  }

  const isEditing = editingMessageId === message.info.id
  const [editText, setEditText] = useState(() => extractTextContent())
  const textAreaRef = useRef<any>(null)
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string; filename?: string } | null>(null)

  // Update edit text when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditText(extractTextContent())
      // Auto focus after a brief delay
      setTimeout(() => {
        textAreaRef.current?.focus()
      }, 100)
    }
  }, [isEditing])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes
    return `${displayHours}:${displayMinutes} ${ampm}`
  }

  /**
   * Check if a part is an image file
   */
  const isImagePart = (part: Part): boolean => {
    if (part.type !== 'file') return false
    const filePart = part as any
    return filePart.mime?.startsWith('image/') ?? false
  }

  /**
   * Classify message parts into categories
   */
  const classifyParts = () => {
    const imageParts: Part[] = []
    const textParts: Part[] = []
    const otherParts: Part[] = []

    message.parts.forEach(part => {
      if (isImagePart(part)) {
        imageParts.push(part)
      } else if (part.type === 'text') {
        textParts.push(part)
      } else {
        otherParts.push(part)
      }
    })

    return { imageParts, textParts, otherParts }
  }

  const renderMessagePart = (part: Part, index: number, isLastPart: boolean) => {
    switch (part.type) {
      case 'file':
        const filePart = part as any
        // Only render images in renderMessagePart (for LLM messages if needed)
        // User messages handle images separately in the main render
        if (isImagePart(part)) {
          return (
            <div key={index} style={{ margin: '8px 0' }}>
              <ImageThumbnail
                src={filePart.url || filePart.display || ''}
                alt={filePart.filename}
                filename={filePart.filename}
                onPreview={() => setPreviewImage({
                  src: filePart.url || filePart.display || '',
                  alt: filePart.filename,
                  filename: filePart.filename
                })}
              />
            </div>
          )
        }
        // Non-image files: show filename or placeholder
        return (
          <div key={index} style={{ 
            color: '#888888',
            fontSize: '12px',
            margin: '8px 0',
            padding: '8px',
            background: '#1a1a1a',
            borderRadius: '4px',
            border: '1px solid #3e3e42'
          }}>
            📄 {filePart.filename || 'File'}
          </div>
        )

      case 'text':
        const textPart = part as any
        return (
          <Paragraph 
            key={index}
            style={{ 
              color: '#cccccc',
              margin: '8px 0',
              whiteSpace: 'pre-wrap'
            }}
          >
            {textPart.text || textPart.content}
          </Paragraph>
        )

      case 'reasoning':
        if (!showThinkingBlocks) return null
        
        const reasoningPart = part as any
        return (
          <div
            key={index}
            style={{
              background: '#1a1a1a',
              border: '1px solid #3e3e42',
              padding: '12px',
              margin: '8px 0',
              borderRadius: '4px'
            }}
          >
            <Text style={{ color: '#ffa500', fontWeight: 'bold' }}>Thinking</Text>
            <Paragraph style={{ color: '#cccccc', margin: '8px 0 0 0' }}>
              {reasoningPart.text || reasoningPart.content}
            </Paragraph>
          </div>
        )

      case 'tool':
        const toolPart = part as any
        const state = toolPart.state
        const status = state?.status || 'unknown'
        const toolName = toolPart.tool || 'Tool'
        const toolInput = (state?.input && typeof state.input === 'object') ? state.input as Record<string, any> : {}
        const toolOutput = state?.output
        const toolMetadata = state?.metadata
        const toolError = state?.error
        
        // Use inline display for lightweight tools (read, grep, glob)
        if (toolName === 'read' || toolName === 'grep' || toolName === 'glob') {
          return (
            <ToolInlineDisplay
              key={index}
              toolName={toolName}
              toolInput={toolInput}
              toolOutput={toolOutput}
              toolMetadata={toolMetadata}
              toolStatus={status as 'pending' | 'running' | 'completed' | 'error'}
              toolError={toolError}
            />
          )
        }
        
        return (
          <ToolPartCard
            key={index}
            toolPart={part}
            toolName={toolName}
            toolInput={toolInput}
            toolStatus={status as 'running' | 'completed' | 'error'}
            toolOutput={typeof toolOutput === 'string' ? toolOutput : undefined}
            toolMetadata={toolMetadata}
            toolError={toolError}
            currentPermission={currentPermission}
            currentSessionId={currentSessionId}
            onPermissionRespond={handlePermissionRespond}
          />
        )

      case 'step-start':
      case 'step-finish':
      case 'snapshot':
      case 'patch':
      case 'file':
      case 'agent':
        // These are internal parts, don't render them
        return null

      default:
        return null
    }
  }

  // Smart spacing: only add extra spacing when starting a new conversation turn
  // This happens when a user message follows an assistant message
  const messageSpacing = needsExtraSpacing ? '48px' : '16px'

  // User messages: card style, left-aligned
  if (isUser) {
    // Editing mode
    if (isEditing) {
      return (
        <div style={{ marginTop: messageSpacing }}>
          <div style={{
            maxWidth: '100%',
            background: '#2d2d30',
            borderRadius: '8px',
            padding: '12px 16px',
            border: '1px solid #3e3e42',
            position: 'relative'
          }}>
            {/* Editable text area */}
            <TextArea
              ref={textAreaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoSize={{ minRows: 1, maxRows: 6 }}
              style={{
                background: '#1e1e1e',
                color: '#cccccc',
                border: '1px solid #3e3e42',
                borderRadius: '4px',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (editText.trim()) {
                    handleSend()
                  }
                }
                if (e.key === 'Escape') {
                  handleCancelEdit()
                }
              }}
            />
            
            <div style={{ 
              marginTop: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'flex-end',
              fontSize: '11px'
            }}>
              <Space size="small">
                <Button
                  size="small"
                  onClick={handleCancelEdit}
                  style={{ color: '#888888' }}
                >
                  Cancel (Esc)
                </Button>
                <Button
                  size="small"
                  type="primary"
                  onClick={handleSend}
                  disabled={!editText.trim()}
                >
                  Send (Enter)
                </Button>
              </Space>
            </div>
          </div>
        </div>
      )
    }

    // Normal view
    const { imageParts, textParts, otherParts } = classifyParts()
    const hasRenderableContent = imageParts.length > 0 || textParts.length > 0 || otherParts.length > 0

    return (
      <div style={{ marginTop: messageSpacing }}>
        <div style={{
          maxWidth: '100%',
          background: '#2d2d30',
          borderRadius: '8px',
          padding: '12px 16px',
          border: '1px solid #3e3e42',
          position: 'relative'
        }}>
          {/* User message content */}
          <div style={{ color: '#cccccc', fontSize: '14px', lineHeight: '1.5' }}>
            {/* Image parts - displayed at top */}
            {imageParts.length > 0 && (
              <div style={{
                marginBottom: textParts.length > 0 || otherParts.length > 0 ? '12px' : '0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                {imageParts.map((part, index) => {
                  const filePart = part as any
                  return (
                    <ImageThumbnail
                      key={`image-${index}-${part.id}`}
                      src={filePart.url || filePart.display || ''}
                      alt={filePart.filename}
                      filename={filePart.filename}
                      onPreview={() => setPreviewImage({
                        src: filePart.url || filePart.display || '',
                        alt: filePart.filename,
                        filename: filePart.filename
                      })}
                    />
                  )
                })}
              </div>
            )}

            {/* Text parts */}
            {textParts.length > 0 && (
              <div>
                {textParts.map((part, index) => {
                  const isLastPart = index === textParts.length - 1 && otherParts.length === 0
                  return <div key={`text-part-${index}`}>{renderMessagePart(part, index, isLastPart)}</div>
                })}
              </div>
            )}

            {/* Other parts (reasoning, tool, etc.) */}
            {otherParts.map((part, index) => {
              const isLastPart = index === otherParts.length - 1
              return <div key={`other-part-${index}`}>{renderMessagePart(part, index, isLastPart)}</div>
            })}

            {/* Show placeholder if no renderable parts */}
            {!hasRenderableContent && (
              <div style={{ 
                color: '#888888',
                fontStyle: 'italic'
              }}>
                No message content
              </div>
            )}
          </div>
          
          {/* User message metadata */}
          <div style={{ 
            marginTop: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#888888'
          }}>
            <Space size="small">
              <span>You</span>
              <span>({formatTime(message.info.time.created)})</span>
            </Space>
            <Space size="small">
              {isQueued && (
                <Tag 
                  color="orange" 
                  style={{ 
                    fontWeight: 'bold',
                    fontSize: '9px',
                    padding: '1px 4px'
                  }}
                >
                  QUEUED
                </Tag>
              )}
              {!isQueued && !isEditing && (
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  style={{ 
                    fontSize: '11px',
                    padding: '0',
                    height: 'auto',
                    color: '#888888'
                  }}
                  onClick={() => handleStartEdit(message.info.id)}
                />
              )}
            </Space>
          </div>
        </div>
        
        {/* Image preview modal */}
        <ImagePreviewModal
          visible={previewImage !== null}
          src={previewImage?.src || ''}
          alt={previewImage?.alt}
          filename={previewImage?.filename}
          onClose={() => setPreviewImage(null)}
        />
      </div>
    )
  }

  // Assistant messages: No card wrapper, direct content
  const isCompleted = message.info.time.completed && message.info.time.completed > 0
  
  const getAgentAndModel = () => {
    // Get agent and model info from message info (AssistantMessage has Mode and ModelID fields)
    const info = message.info as any
    const agent = info.mode || info.agent || null
    const model = info.modelID || info.model || null
    return { agent, model }
  }

  const { agent, model } = getAgentAndModel()
  const hasContent = message.parts.length > 0 && message.parts.some(part => 
    part.type === 'text' || part.type === 'reasoning' || part.type === 'tool'
  )
  

  return (
    <div style={{ marginTop: messageSpacing }}>
      {/* Assistant message content - no card wrapper */}
      <div style={{ paddingLeft: '8px' }}>
        {message.parts.map((part: any, index: number) => {
          const isLastPart = index === message.parts.length - 1
          return <div key={`assistant-part-${index}-${part.id || 'unknown'}`}>{renderMessagePart(part, index, isLastPart)}</div>
        })}
        {/* Show "Generating..." for empty assistant messages that are not yet completed */}
        {!isCompleted && (message.parts.length === 0 || !message.parts.some(part => 
          part.type === 'text' || part.type === 'reasoning' || part.type === 'tool'
        )) ? (
          <div style={{ 
            color: '#888888',
            fontSize: '14px',
            fontStyle: 'italic',
            animation: 'blink 2s ease-in-out infinite'
          }}>
            Generating...
            <style>{`
              @keyframes blink {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
              }
            `}</style>
          </div>
        ) : null}
        
        {/* Show metadata only for the last assistant message (completed or not) */}
        {isAssistant && isLastCompletedMessage && isCompleted && hasContent && (
          <div style={{ 
            marginTop: '8px',
            fontSize: '11px',
            color: '#888888'
          }}>
            {agent && model ? (
              <Space size="small">
                <span style={{ textTransform: 'capitalize' }}>{agent}</span>
                <span>{model}</span>
                <span>({formatTime(message.info.time.completed)})</span>
              </Space>
            ) : (
              <Space size="small">
                <span>Assistant</span>
                <span>({formatTime(message.info.time.completed)})</span>
              </Space>
            )}
          </div>
        )}
      </div>
      
      {/* Image preview modal */}
      <ImagePreviewModal
        visible={previewImage !== null}
        src={previewImage?.src || ''}
        alt={previewImage?.alt}
        filename={previewImage?.filename}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  )
}
