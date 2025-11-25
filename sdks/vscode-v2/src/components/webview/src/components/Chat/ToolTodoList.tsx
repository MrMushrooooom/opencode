import React from 'react'

interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority?: string
}

interface ToolTodoListProps {
  todos: Todo[]
  toolStatus: 'pending' | 'running' | 'completed' | 'error'
}

export const ToolTodoList: React.FC<ToolTodoListProps> = ({ todos, toolStatus }) => {
  if (!todos || todos.length === 0) {
    return (
      <div style={{
        padding: '12px',
        color: '#888888',
        fontSize: '12px'
      }}>
        No tasks
      </div>
    )
  }

  const shouldShowBlink = (todoStatus: string): boolean => {
    return todoStatus === 'in_progress' && 
           (toolStatus === 'pending' || toolStatus === 'running')
  }

  const hasBlinkingTodo = todos.some(todo => shouldShowBlink(todo.status))

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      case 'completed':
        return '✓'
      case 'in_progress':
        // Use CSS to create circle with inner dot
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '12px',
            height: '12px',
            border: '1px solid #cccccc',
            borderRadius: '50%',
            position: 'relative'
          }}>
            <span style={{
              width: '4px',
              height: '4px',
              backgroundColor: '#cccccc',
              borderRadius: '50%',
              display: 'block'
            }} />
          </span>
        )
      case 'cancelled':
        return '⊘'
      default:
        return '○'
    }
  }

  const getStatusStyle = (status: string) => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 8px',
      marginBottom: '4px',
      borderRadius: '2px',
      fontSize: '12px',
      lineHeight: '20px'
    }

    switch (status) {
      case 'completed':
        return {
          ...baseStyle,
          color: '#666666',
          textDecoration: 'line-through'
        }
      case 'in_progress':
        return {
          ...baseStyle,
          color: '#cccccc',
          backgroundColor: 'transparent'
        }
      case 'cancelled':
        return {
          ...baseStyle,
          color: '#666666',
          textDecoration: 'line-through'
        }
      default:
        return {
          ...baseStyle,
          color: '#666666'
        }
    }
  }

  const getIconColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#52c41a'
      case 'in_progress':
        return '#cccccc'
      case 'cancelled':
        return '#888888'
      default:
        return '#888888'
    }
  }

  return (
    <div style={{
      padding: '12px'
    }}>
      {todos.map((todo) => {
        const statusStyle = getStatusStyle(todo.status)
        const iconColor = getIconColor(todo.status)
        const shouldBlink = shouldShowBlink(todo.status)

        return (
          <div
            key={todo.id}
            style={{
              ...statusStyle,
              animation: shouldBlink ? 'blink 2s ease-in-out infinite' : 'none'
            }}
          >
            <span style={{
              color: iconColor,
              fontSize: '14px',
              fontWeight: 'bold',
              minWidth: '16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: shouldBlink ? 'blink 2s ease-in-out infinite' : 'none'
            }}>
              {getStatusIcon(todo.status)}
            </span>
            <span style={{
              flex: 1,
              wordBreak: 'break-word'
            }}>
              {todo.content}
            </span>
          </div>
        )
      })}
      {hasBlinkingTodo && (
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

