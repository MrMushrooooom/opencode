import React, { useState, useEffect, useRef } from 'react'
import { Typography, Space, Tag, Button, Input, Modal } from 'antd'
import { ToolOutlined, EditOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Message, Part } from '../../types'
import { useCurrentPermission, useAppStore } from '../../store'
import { webViewService } from '../../services/webviewService'
import { renderToolOutput } from './toolRenderer'

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

  const renderMessagePart = (part: Part, index: number, isLastPart: boolean) => {
    switch (part.type) {
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
        const isCompleted = status === 'completed'
        const isError = status === 'error'
        
        // Build tool title with input parameters for better context
        const toolName = toolPart.tool || 'Tool'
        let toolTitle = toolName
        if (state?.input && typeof state.input === 'object') {
          const input = state.input as Record<string, any>
          // Extract relevant parameter for different tools
          if (toolName === 'read' && input.filePath) {
            toolTitle = `${toolName} ${input.filePath}`
          } else if (toolName === 'glob' && input.pattern) {
            toolTitle = `${toolName} ${input.pattern}`
          } else if (toolName === 'list' && input.directory) {
            toolTitle = `${toolName} ${input.directory}`
          } else if (toolName === 'bash' && input.description) {
            toolTitle = `${toolName} ${input.description}`
          } else if (toolName === 'edit' && input.filePath) {
            toolTitle = `${toolName} ${input.filePath}`
          } else {
            // Generic: show first parameter
            const keys = Object.keys(input)
            if (keys.length > 0) {
              const firstKey = keys[0]
              const firstValue = input[firstKey]
              if (typeof firstValue === 'string') {
                toolTitle = `${toolName} ${firstValue.substring(0, 50)}`
              }
            }
          }
        }
        
        // Extract output preview based on tool type for consistent display
        let outputPreview = ''
        if (isCompleted && state?.output) {
          const output = state.output
          
          // Use tool renderer for consistent display logic
          if (typeof output === 'string') {
            outputPreview = renderToolOutput(toolName, output, state?.metadata)
          } else {
            outputPreview = JSON.stringify(output, null, 2)
          }
        }
        
        return (
          <div
            key={index}
            style={{
              background: 'rgba(82, 196, 26, 0.05)',
              border: '1px solid rgba(82, 196, 26, 0.2)',
              margin: '8px 0',
              padding: '12px',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Space>
                <ToolOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                <Text style={{ color: '#cccccc', fontSize: '12px', fontFamily: 'monospace' }}>
                  {toolTitle}
                </Text>
                {(!isError || !state?.error) && (
                  <>
                    <Tag 
                      color={
                        isCompleted ? 'green' :
                        status === 'running' ? 'blue' : 'default'
                      }
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        animation: status === 'running' ? 'running-pulse 2s ease-in-out infinite' : 'none'
                      }}
                    >
                      {status === 'running' ? 'running' : status}
                    </Tag>
                    {status === 'running' && (
                      <style>{`
                        @keyframes running-pulse {
                          0% { opacity: 1; }
                          50% { opacity: 0.5; }
                          100% { opacity: 1; }
                        }
                      `}</style>
                    )}
                  </>
                )}
              </Space>
              
              {isCompleted && outputPreview && (
                <div style={{
                  color: '#888888',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '8px',
                  borderRadius: '4px',
                  maxHeight: '300px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {outputPreview}
                </div>
              )}
              
              {isError && state?.error && !state.error.includes('rejected') && (
                <div style={{
                  color: '#888888',
                  fontSize: '11px'
                }}>
                  {state.error}
                </div>
              )}
              
              {/* Permission request UI - show when bash command is running and permission is required */}
              {status === 'running' && currentPermission && toolName === 'bash' && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '4px'
                }}>
                  <Text style={{ color: '#cccccc', fontSize: '11px', display: 'block', marginBottom: '6px' }}>
                    {currentPermission.title || 'Permission required'}
                  </Text>
                  <Space size={4}>
                    <Button
                      size="small"
                      style={{ fontSize: '11px', height: '22px', padding: '0 8px' }}
                      onClick={() => handlePermissionRespond('once')}
                    >
                      Run Once
                    </Button>
                    <Button
                      size="small"
                      style={{ fontSize: '11px', height: '22px', padding: '0 8px' }}
                      onClick={() => handlePermissionRespond('always')}
                    >
                      Always Allow
                    </Button>
                    <Button
                      size="small"
                      style={{ fontSize: '11px', height: '22px', padding: '0 8px' }}
                      onClick={() => handlePermissionRespond('reject')}
                    >
                      Reject
                    </Button>
                  </Space>
                </div>
              )}
            </Space>
          </div>
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
            {message.parts.map((part, index) => {
              const isLastPart = index === message.parts.length - 1
              return <div key={`user-part-${index}`}>{renderMessagePart(part, index, isLastPart)}</div>
            })}
            {/* Show placeholder if no renderable parts */}
            {message.parts.length === 0 || !message.parts.some(part => 
              part.type === 'text' || part.type === 'reasoning' || part.type === 'tool'
            ) ? (
              <div style={{ 
                color: '#888888',
                fontStyle: 'italic'
              }}>
                No message content
              </div>
            ) : null}
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
        {/* Show "Generating..." for empty assistant messages */}
        {message.parts.length === 0 || !message.parts.some(part => 
          part.type === 'text' || part.type === 'reasoning' || part.type === 'tool'
        ) ? (
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
    </div>
  )
}
