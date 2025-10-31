import React, { useState } from 'react'
import { Input, Dropdown, Button, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, MenuOutlined } from '@ant-design/icons'
import { useSessions, useCurrentSession } from '../../store'
import { webViewService } from '../../services/webviewService'

interface SessionItemProps {
  session: any
  isCurrent: boolean
  isHovered: boolean
  isEditing: boolean
  editingTitle: string
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onTitleChange: (title: string) => void
  onDelete: () => void
  onSelect: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isCurrent,
  isHovered,
  isEditing,
  editingTitle,
  onEdit,
  onSave,
  onCancel,
  onTitleChange,
  onDelete,
  onSelect,
  onMouseEnter,
  onMouseLeave
}) => {
  const displayTitle = session.title || (session.id ? `Session ${session.id.slice(0, 8)}` : 'Untitled Session')

  if (isEditing) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 8px',
        background: isCurrent ? '#2d4a8a' : 'transparent'
      }}>
        <Input
          value={editingTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          onPressEnter={onSave}
          autoFocus
          style={{
            background: '#1e1e1e',
            border: '1px solid #3e3e42',
            color: '#cccccc',
            fontSize: '12px',
            height: '22px',
            padding: '0 6px'
          }}
        />
        <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
          <Button
            type="text"
            size="small"
            icon={<CheckOutlined />}
            onClick={onSave}
            style={{ color: '#52c41a', padding: '0 4px' }}
          />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={onCancel}
            style={{ color: '#888888', padding: '0 4px' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div 
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '4px 8px',
      background: isHovered ? '#3e3e42' : 'transparent',
      cursor: 'pointer'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: '8px' }}>
        <span style={{
          fontSize: '12px',
          color: '#cccccc',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1,
          minWidth: 0
        }}>
          {displayTitle}
        </span>
        {isCurrent && (
          <span style={{
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '3px',
            background: '#2d2d30',
            border: '1px solid #3e3e42',
            color: '#888888',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>
            Current
          </span>
        )}
      </div>
      {isHovered && (
        <div style={{ display: 'flex', gap: '4px', opacity: 0.7, flexShrink: 0 }}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            style={{ color: '#cccccc', padding: '0 4px' }}
          />
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ color: '#ff4d4f', padding: '0 4px' }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Session selector component with advanced management features
 * Implements session editing, deletion, and current session indication
 */
export const SessionSelector: React.FC = () => {
  const sessions = useSessions() || []
  const currentSession = useCurrentSession()
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)
  const [dropdownVisible, setDropdownVisible] = useState(false)

  const handleEdit = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId)
    setEditingTitle(currentTitle || '')
  }

  const handleSave = (sessionId: string) => {
    if (editingTitle.trim()) {
      webViewService.updateSession(sessionId, editingTitle.trim())
    }
    setEditingSessionId(null)
    setEditingTitle('')
  }

  const handleCancel = () => {
    setEditingSessionId(null)
    setEditingTitle('')
  }

  const handleDelete = (sessionId: string) => {
    webViewService.deleteSession(sessionId)
  }

  const handleSelectSession = (sessionId: string) => {
    setDropdownVisible(false)
    if (sessionId === 'new') {
      webViewService.createSession()
    } else {
      webViewService.switchSession(sessionId)
    }
  }

  const dropdownContent = (
    <div style={{ 
      background: '#252526',
      border: '1px solid #3e3e42',
      borderRadius: '4px',
      width: '320px',
      maxHeight: '400px',
      overflowY: 'auto'
    }}>
      {/* New Session option */}
      <div
        onClick={() => handleSelectSession('new')}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          cursor: 'pointer',
          borderBottom: '1px solid #3e3e42'
        }}
      >
        <PlusOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
        <span style={{ fontSize: '12px', color: '#cccccc' }}>New Session</span>
      </div>

      {/* Existing sessions */}
      {sessions.map(session => session && session.id ? (
        <SessionItem
          key={session.id}
          session={session}
          isCurrent={currentSession?.id === session.id}
          isHovered={hoveredSessionId === session.id}
          isEditing={editingSessionId === session.id}
          editingTitle={editingTitle}
          onEdit={() => handleEdit(session.id, session.title)}
          onSave={() => handleSave(session.id)}
          onCancel={handleCancel}
          onTitleChange={setEditingTitle}
          onDelete={() => handleDelete(session.id)}
          onSelect={() => handleSelectSession(session.id)}
          onMouseEnter={() => setHoveredSessionId(session.id)}
          onMouseLeave={() => setHoveredSessionId(null)}
        />
      ) : null)}

      {sessions.length === 0 && (
        <div style={{
          padding: '16px',
          textAlign: 'center',
          color: '#888888',
          fontSize: '12px'
        }}>
          No sessions yet
        </div>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Dropdown
        open={dropdownVisible}
        onOpenChange={setDropdownVisible}
        trigger={['click']}
        placement="bottomLeft"
        dropdownRender={() => dropdownContent}
        overlayStyle={{
          maxHeight: '400px',
          overflowY: 'auto'
        }}
      >
        <Button 
          icon={<MenuOutlined />}
          style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#2d2d30',
          border: '1px solid #3e3e42',
          color: '#cccccc',
          fontSize: '12px',
          height: '28px',
          padding: '0 8px'
        }}>
        </Button>
      </Dropdown>
    </div>
  )
}
