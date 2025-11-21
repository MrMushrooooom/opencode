import React from 'react'
import { ToolPartHeader } from './ToolPartHeader'
import { ToolPartContent } from './ToolPartContent'

interface ToolPartCardProps {
  toolPart: any
  toolName: string
  toolInput: Record<string, any>
  toolStatus: 'pending' | 'running' | 'completed' | 'error'
  toolOutput?: string
  toolMetadata?: any
  toolError?: string
  currentPermission?: any
  currentSessionId?: string
  onPermissionRespond?: (response: 'once' | 'always' | 'reject') => void
}

export const ToolPartCard: React.FC<ToolPartCardProps> = ({
  toolPart,
  toolName,
  toolInput,
  toolStatus,
  toolOutput,
  toolMetadata,
  toolError,
  currentPermission,
  currentSessionId,
  onPermissionRespond
}) => {
  return (
    <div style={{
      margin: '8px 0',
      background: '#252526',
      border: '1px solid #3e3e42',
      borderRadius: '6px',
      overflow: 'hidden'
    }}>
      <ToolPartHeader
        toolName={toolName}
        toolInput={toolInput}
        toolStatus={toolStatus}
        toolMetadata={toolMetadata}
        toolPart={toolPart}
      />
      <ToolPartContent
        toolName={toolName}
        toolOutput={toolOutput}
        toolMetadata={toolMetadata}
        toolStatus={toolStatus}
        toolError={toolError}
        toolPart={toolPart}
        currentPermission={currentPermission}
        currentSessionId={currentSessionId}
        onPermissionRespond={onPermissionRespond}
      />
    </div>
  )
}

