import React, { useState } from 'react'
import { Input, Button, Select, Space } from 'antd'
import { SendOutlined, SettingOutlined, CameraOutlined, PaperClipOutlined } from '@ant-design/icons'
import { webViewService } from '../../services/webviewService'
import { useAppStore } from '../../store'
import { SessionSelector } from '../Session/SessionSelector'
import { ModelSelector } from '../Model/ModelSelector'

const { TextArea } = Input

interface InputAreaProps {
  onSendPrompt: (text: string) => void
  mode: 'plan' | 'build'
  onModeChange: (mode: 'plan' | 'build') => void
  disabled: boolean
  status: 'ready' | 'sending' | 'generating' | 'error'
}

/**
 * Input area component for user message input and mode selection
 * Redesigned with Cursor-inspired clean and minimal aesthetic
 */
export const InputArea: React.FC<InputAreaProps> = ({
  onSendPrompt,
  mode,
  onModeChange,
  disabled,
  status
}) => {
  const [inputValue, setInputValue] = useState('')
  const [isComposing, setIsComposing] = useState(false)

  const handleSend = () => {
    const text = inputValue.trim()
    if (!text || disabled) return

    onSendPrompt(text)
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCompositionStart = () => {
    setIsComposing(true)
  }

  const handleCompositionEnd = () => {
    setIsComposing(false)
  }

  return (
    <div style={{
      background: '#1e1e1e',
      borderTop: '1px solid #3e3e42',
      padding: '16px',
      position: 'relative'
    }}>
      {/* Mode selector and controls - single row with space-between */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        gap: '8px'
      }}>
        {/* Left side: Mode selector */}
        <div style={{
          display: 'flex',
          background: '#2d2d30',
          borderRadius: '6px',
          padding: '2px',
          border: '1px solid #3e3e42'
        }}>
          <button
            onClick={() => onModeChange('plan')}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: 'none',
              background: mode === 'plan' ? '#1890ff' : 'transparent',
              color: mode === 'plan' ? '#ffffff' : '#cccccc',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Plan
          </button>
          <button
            onClick={() => onModeChange('build')}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: 'none',
              background: mode === 'build' ? '#52c41a' : 'transparent',
              color: mode === 'build' ? '#ffffff' : '#cccccc',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Build
          </button>
        </div>
        
        {/* Right side: Session and Model selectors */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <SessionSelector />
          <ModelSelector />
        </div>
      </div>

      {/* Main input area */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        background: '#252526',
        border: '1px solid #3e3e42',
        borderRadius: '8px',
        padding: '12px',
        transition: 'border-color 0.2s ease'
      }}>
        {/* Attachment buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginRight: '8px'
        }}>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888888',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#cccccc'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}
            title="Upload image"
          >
            <CameraOutlined style={{ fontSize: '16px' }} />
          </button>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888888',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#cccccc'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}
            title="Attach file"
          >
            <PaperClipOutlined style={{ fontSize: '16px' }} />
          </button>
        </div>

        {/* Text input */}
        <TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder="Ask me anything about your code..."
          disabled={disabled}
          autoSize={{ minRows: 1, maxRows: 6 }}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#cccccc',
            fontSize: '14px',
            lineHeight: '1.5',
            resize: 'none',
            boxShadow: 'none'
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || disabled}
          style={{
            background: inputValue.trim() ? '#1890ff' : '#3e3e42',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            padding: '8px 12px',
            cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: '500'
          }}
        >
          <SendOutlined style={{ fontSize: '14px' }} />
          Send
        </button>

        {/* Settings button */}
        <button
          onClick={() => webViewService.showModelSelector()}
          disabled={disabled}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#888888',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '6px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#3e3e42'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title="Settings"
        >
          <SettingOutlined style={{ fontSize: '16px' }} />
        </button>
      </div>

      {/* Helper text */}
      <div style={{
        marginTop: '8px',
        fontSize: '11px',
        color: '#666666',
        textAlign: 'center'
      }}>
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  )
}
