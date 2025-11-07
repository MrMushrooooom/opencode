import React, { useState } from 'react'
import { Input, Button, Select, Space } from 'antd'
import { SendOutlined, SettingOutlined, CameraOutlined } from '@ant-design/icons'
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
  const [selectedImages, setSelectedImages] = useState<Array<{ data: string; name: string; mime: string }>>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleSend = () => {
    const text = inputValue.trim()
    if (!text || disabled) return

    // Send prompt with images if any
    webViewService.sendUserPromptWithImages(text, mode, selectedImages)
    
    setInputValue('')
    setSelectedImages([])
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

  const handleImageUpload = () => {
    fileInputRef.current?.click()
  }

  /**
   * Detect actual image format from base64 data URL
   * Uses magic bytes to determine the real format, not file extension
   */
  const detectImageMimeType = (dataUrl: string): string => {
    // Extract base64 data
    const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!base64Match) return 'image/png' // fallback
    
    const base64Data = base64Match[2]
    // Decode first few bytes to check magic bytes
    const binaryString = atob(base64Data.substring(0, 12))
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    // Check magic bytes for different image formats
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'image/png'
    }
    // JPEG: FF D8 (SOI - Start of Image)
    // JPEG files start with FF D8, followed by various markers (FF E0 for JFIF, FF E1 for EXIF, etc.)
    // We only check the first two bytes to be more accurate
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
      return 'image/jpeg'
    }
    // GIF: 47 49 46 38 (GIF8)
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'image/gif'
    }
    // WebP: RIFF...WEBP
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      // Check for WEBP signature at offset 8
      if (base64Data.length > 20) {
        const webpCheck = atob(base64Data.substring(16, 24))
        if (webpCheck.includes('WEBP')) {
          return 'image/webp'
        }
      }
    }
    // SVG: check for XML declaration or <svg
    if (base64Data.length > 100) {
      const svgCheck = atob(base64Data.substring(0, 100)).toLowerCase()
      if (svgCheck.includes('<svg') || svgCheck.includes('<?xml')) {
        return 'image/svg+xml'
      }
    }
    
    // Fallback to original MIME type from data URL
    return base64Match[1] || 'image/png'
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const imageFiles = Array.from(files).filter(file => {
      const type = file.type.toLowerCase()
      return type.startsWith('image/') && (
        type === 'image/png' ||
        type === 'image/jpeg' ||
        type === 'image/jpg' ||
        type === 'image/gif' ||
        type === 'image/webp' ||
        type === 'image/svg+xml'
      )
    })

    imageFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        let data = event.target?.result as string
        // Detect actual MIME type from image data (not file extension)
        const actualMime = detectImageMimeType(data)
        
        // Update data URL with correct MIME type if it differs
        // FileReader may use file.type which can be incorrect
        const dataUrlMatch = data.match(/^data:([^;]+);base64,(.+)$/)
        if (dataUrlMatch) {
          const [, originalMime, base64Data] = dataUrlMatch
          if (originalMime !== actualMime) {
            // Reconstruct data URL with correct MIME type
            data = `data:${actualMime};base64,${base64Data}`
          }
        }
        
        setSelectedImages(prev => [...prev, {
          data,
          name: file.name,
          mime: actualMime // Use detected MIME type instead of file.type
        }])
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
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
        {/* Image upload button */}
        <div style={{
          marginRight: '8px'
        }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            onClick={handleImageUpload}
            disabled={disabled}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888888',
              cursor: disabled ? 'not-allowed' : 'pointer',
              padding: '4px',
              borderRadius: '4px',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => !disabled && (e.currentTarget.style.color = '#cccccc')}
            onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}
            title="Upload image"
          >
            <CameraOutlined style={{ fontSize: '16px' }} />
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

      {/* Image previews */}
      {selectedImages.length > 0 && (
        <div style={{
          marginTop: '8px',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          padding: '8px',
          background: '#2d2d30',
          borderRadius: '6px',
          border: '1px solid #3e3e42'
        }}>
          {selectedImages.map((image, index) => (
            <div
              key={index}
              style={{
                position: 'relative',
                width: '60px',
                height: '60px',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid #3e3e42'
              }}
            >
              <img
                src={image.data}
                alt={image.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              <button
                onClick={() => removeImage(index)}
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  background: 'rgba(0, 0, 0, 0.6)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  lineHeight: '1'
                }}
                title="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

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
