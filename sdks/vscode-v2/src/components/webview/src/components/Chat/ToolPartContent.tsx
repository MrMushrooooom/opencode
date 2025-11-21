import React from 'react'
import { Typography, Space, Button } from 'antd'
import { ToolDiff } from './ToolDiff'
import { CommandOutput } from './CommandOutput'
import { extractFileChangeFromToolPart } from '../../utils/fileChangeExtractor'
import { renderToolOutput } from './toolRenderer'

const { Text } = Typography

interface ToolPartContentProps {
  toolName: string
  toolOutput?: string
  toolMetadata?: any
  toolStatus: 'pending' | 'running' | 'completed' | 'error'
  toolError?: string
  toolPart: any
  currentPermission?: any
  currentSessionId?: string
  onPermissionRespond?: (response: 'once' | 'always' | 'reject') => void
}

export const ToolPartContent: React.FC<ToolPartContentProps> = ({
  toolName,
  toolOutput,
  toolMetadata,
  toolStatus,
  toolError,
  toolPart,
  currentPermission,
  currentSessionId,
  onPermissionRespond
}) => {
  if (toolStatus === 'error' && toolError && !toolError.includes('rejected')) {
    return (
      <div style={{
        padding: '12px',
        color: '#888888',
        fontSize: '11px'
      }}>
        {toolError}
      </div>
    )
  }
  
  if (toolStatus === 'completed') {
    const fileChange = extractFileChangeFromToolPart(toolPart)
    
    if (fileChange && (toolName === 'edit' || toolName === 'write' || toolName === 'patch')) {
      return <ToolDiff fileChange={fileChange} />
    }
    
    if (toolName === 'bash') {
      const command = toolPart?.state?.input?.command
      const output = toolOutput || toolMetadata?.output || ''
      if (command && typeof command === 'string') {
        return <CommandOutput command={command} output={output} />
      }
    }
    
    if (toolOutput) {
      const outputPreview = typeof toolOutput === 'string' 
        ? renderToolOutput(toolName, toolOutput, toolMetadata)
        : JSON.stringify(toolOutput, null, 2)
      
      if (outputPreview) {
        return (
          <div style={{
            padding: '12px',
            color: '#888888',
            fontSize: '12px',
            fontFamily: 'monospace',
            background: 'rgba(0, 0, 0, 0.2)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {outputPreview}
          </div>
        )
      }
    }
  }
  
  if (toolStatus === 'running' && currentPermission && toolName === 'bash' && onPermissionRespond) {
    return (
      <div style={{
        padding: '12px',
        background: 'rgba(0, 0, 0, 0.2)'
      }}>
        <Text style={{ color: '#cccccc', fontSize: '11px', display: 'block', marginBottom: '6px' }}>
          {currentPermission.title || 'Permission required'}
        </Text>
        <Space size={4}>
          <Button
            size="small"
            style={{ fontSize: '11px', height: '22px', padding: '0 8px' }}
            onClick={() => onPermissionRespond('once')}
          >
            Run Once
          </Button>
          <Button
            size="small"
            style={{ fontSize: '11px', height: '22px', padding: '0 8px' }}
            onClick={() => onPermissionRespond('always')}
          >
            Always Allow
          </Button>
          <Button
            size="small"
            style={{ fontSize: '11px', height: '22px', padding: '0 8px' }}
            onClick={() => onPermissionRespond('reject')}
          >
            Reject
          </Button>
        </Space>
      </div>
    )
  }
  
  return null
}

