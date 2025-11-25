import React from 'react'
import { Typography, Space } from 'antd'
import { ToolOutlined, CodeOutlined, CheckSquareOutlined } from '@ant-design/icons'
import { getFileIcon } from '../../utils/fileIcon'
import { extractFileChangeFromToolPart } from '../../utils/fileChangeExtractor'
import { webViewService } from '../../services/webviewService'

const { Text } = Typography

interface ToolPartHeaderProps {
  toolName: string
  toolInput: Record<string, any>
  toolStatus: 'pending' | 'running' | 'completed' | 'error'
  toolMetadata?: any
  toolPart: any
}

export const ToolPartHeader: React.FC<ToolPartHeaderProps> = ({
  toolName,
  toolInput,
  toolStatus,
  toolMetadata,
  toolPart
}) => {
  const fileChange = toolStatus === 'completed' ? extractFileChangeFromToolPart(toolPart) : null
  
  const handleFileClick = (filePath: string) => {
    webViewService.openFile(filePath)
  }
  
  const getFileName = (filePath: string) => {
    const parts = filePath.split('/')
    return parts[parts.length - 1] || filePath
  }
  
  const extractCommandName = (command: string | undefined): string | null => {
    if (!command || typeof command !== 'string') {
      return null
    }
    // Extract command name (first word, before space or any argument)
    const parts = command.trim().split(/\s+/)
    return parts[0] || null
  }
  
  // For todo tools (todowrite/todoread), show todo list header
  if (toolName === 'todowrite' || toolName === 'todoread') {
    // Unified data acquisition: always from toolInput (consistent with UI/Web)
    const todos = toolInput?.todos || []
    const incompleteCount = todos.filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled').length
    const isProcessing = toolStatus === 'pending' || toolStatus === 'running'
    
    return (
      <div style={{
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #3e3e42'
      }}>
        <Space size="small">
          <CheckSquareOutlined 
            style={{ 
              color: '#52c41a', 
              fontSize: '14px',
              animation: isProcessing ? 'blink 2s ease-in-out infinite' : 'none'
            }} 
          />
          <Text 
            style={{ 
              color: '#cccccc', 
              fontSize: '12px', 
              fontFamily: 'monospace',
              animation: isProcessing ? 'blink 2s ease-in-out infinite' : 'none'
            }}
          >
            Todo List
          </Text>
          {incompleteCount > 0 && (
            <Text 
              style={{ 
                color: '#888888', 
                fontSize: '11px'
              }}
            >
              {incompleteCount} {incompleteCount === 1 ? 'todo' : 'todos'}
            </Text>
          )}
        </Space>
        {isProcessing && (
          <style>{`
            @keyframes blink {
              0% { opacity: 1; }
              50% { opacity: 0.5; }
              100% { opacity: 1; }
            }
          `}</style>
        )}
      </div>
    )
  }
  
  // For bash tool, show command name in header
  if (toolName === 'bash') {
    const commandName = extractCommandName(toolInput?.command) || toolInput?.description
    if (commandName) {
      const isProcessing = toolStatus === 'pending' || toolStatus === 'running'
      return (
        <div style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #3e3e42'
        }}>
          <Space size="small">
            <CodeOutlined 
              style={{ 
                color: '#52c41a', 
                fontSize: '14px',
                animation: isProcessing ? 'blink 2s ease-in-out infinite' : 'none'
              }} 
            />
            <Text 
              style={{ 
                color: '#cccccc', 
                fontSize: '12px', 
                fontFamily: 'monospace',
                animation: isProcessing ? 'blink 2s ease-in-out infinite' : 'none'
              }}
            >
              command: {commandName}
            </Text>
          </Space>
          {isProcessing && (
            <style>{`
              @keyframes blink {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
              }
            `}</style>
          )}
        </div>
      )
    }
  }
  
  // For file operation tools (edit/write/patch), try to get file path from fileChange or toolInput
  if (toolName === 'edit' || toolName === 'write' || toolName === 'patch') {
    const filePath = fileChange?.absolutePath || fileChange?.filePath || toolInput?.filePath
    if (filePath) {
      const displayPath = fileChange?.filePath || filePath
      const isProcessing = toolStatus === 'pending' || toolStatus === 'running'
      
      return (
        <div
          onClick={() => handleFileClick(filePath)}
          style={{
            padding: '10px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #3e3e42',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2d2d30'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <Space size="small" style={{ flex: 1 }}>
            <span style={{ 
              animation: isProcessing ? 'blink 2s ease-in-out infinite' : 'none'
            }}>
              {getFileIcon(displayPath)}
            </span>
            <Text style={{ 
              color: '#cccccc', 
              fontSize: '12px', 
              fontWeight: 500,
              userSelect: 'none',
              animation: isProcessing ? 'blink 2s ease-in-out infinite' : 'none'
            }}>
              {getFileName(displayPath)}
            </Text>
            {fileChange && (fileChange.addedLines > 0 || fileChange.removedLines > 0) && (
              <Space size={4} style={{ userSelect: 'none' }}>
                {fileChange.addedLines > 0 && (
                  <span style={{ 
                    color: '#2ea043', 
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    +{fileChange.addedLines}
                  </span>
                )}
                {fileChange.removedLines > 0 && (
                  <span style={{ 
                    color: '#cf222e', 
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    -{fileChange.removedLines}
                  </span>
                )}
              </Space>
            )}
          </Space>
          {isProcessing && (
            <style>{`
              @keyframes blink {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
              }
            `}</style>
          )}
        </div>
      )
    }
  }
  
  let toolTitle = toolName
  if (toolInput) {
    if (toolName === 'read' && toolInput.filePath) {
      toolTitle = `${toolName} ${toolInput.filePath}`
    } else if (toolName === 'glob' && toolInput.pattern) {
      toolTitle = `${toolName} ${toolInput.pattern}`
    } else if (toolName === 'list' && toolInput.directory) {
      toolTitle = `${toolName} ${toolInput.directory}`
    } else if (toolName === 'bash' && toolInput.description) {
      toolTitle = `${toolName} ${toolInput.description}`
    } else if (toolName === 'edit' && toolInput.filePath) {
      toolTitle = `${toolName} ${toolInput.filePath}`
    } else {
      const keys = Object.keys(toolInput)
      if (keys.length > 0) {
        const firstKey = keys[0]
        const firstValue = toolInput[firstKey]
        if (typeof firstValue === 'string') {
          toolTitle = `${toolName} ${firstValue.substring(0, 50)}`
        }
      }
    }
  }
  
  const isProcessing = toolStatus === 'pending' || toolStatus === 'running'
  
  return (
    <div style={{
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid #3e3e42'
    }}>
      <Space size="small">
        <ToolOutlined 
          style={{ 
            color: '#52c41a', 
            fontSize: '14px',
            animation: isProcessing ? 'blink 2s ease-in-out infinite' : 'none'
          }} 
        />
        <Text 
          style={{ 
            color: '#cccccc', 
            fontSize: '12px', 
            fontFamily: 'monospace',
            animation: isProcessing ? 'blink 2s ease-in-out infinite' : 'none'
          }}
        >
          {toolTitle}
        </Text>
      </Space>
      {isProcessing && (
        <style>{`
          @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}</style>
      )}
    </div>
  )
}

