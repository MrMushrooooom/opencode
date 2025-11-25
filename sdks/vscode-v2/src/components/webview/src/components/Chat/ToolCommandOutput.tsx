import React, { useState } from 'react'

interface ToolCommandOutputProps {
  command: string
  output: string
}

export const ToolCommandOutput: React.FC<ToolCommandOutputProps> = ({ command, output }) => {
  const [expanded, setExpanded] = useState(false)
  
  const outputLines = output.split('\n')
  const hasMoreLines = outputLines.length > 5
  const displayLines = expanded ? outputLines : outputLines.slice(0, 5)
  
  return (
    <div
      onClick={() => {
        if (hasMoreLines) {
          setExpanded(!expanded)
        }
      }}
      style={{
        padding: '12px',
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#cccccc',
        background: 'rgba(0, 0, 0, 0.2)',
        cursor: hasMoreLines ? 'pointer' : 'default',
        maxHeight: expanded ? '400px' : 'none',
        overflowY: expanded ? 'auto' : 'visible',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        transition: 'max-height 0.3s ease'
      }}
    >
      <div style={{ color: '#888888', marginBottom: '8px', userSelect: 'none' }}>
        $ {command}
      </div>
      <div>
        {displayLines.join('\n')}
      </div>
    </div>
  )
}

