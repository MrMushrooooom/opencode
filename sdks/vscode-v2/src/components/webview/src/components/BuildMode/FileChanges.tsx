import React from 'react'
import { List, Typography, Tag, Space } from 'antd'
import { FileTextOutlined, PlusOutlined, MinusOutlined, EditOutlined } from '@ant-design/icons'
import { FrontendFileChange } from '../../types'

const { Text } = Typography

interface FileChangesProps {
  fileChanges: readonly FrontendFileChange[]
}

/**
 * File changes component for build mode
 * Displays list of file modifications
 */
export const FileChanges: React.FC<FileChangesProps> = ({ fileChanges }) => {
  if (fileChanges.length === 0) {
    return (
      <div style={{ color: '#888888', fontSize: '12px' }}>
        No file changes
      </div>
    )
  }

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'create':
        return <PlusOutlined style={{ color: '#52c41a' }} />
      case 'modify':
        return <EditOutlined style={{ color: '#1890ff' }} />
      case 'delete':
        return <MinusOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <FileTextOutlined />
    }
  }

  const getChangeColor = (type: string) => {
    switch (type) {
      case 'create':
        return 'green'
      case 'modify':
        return 'blue'
      case 'delete':
        return 'red'
      default:
        return 'default'
    }
  }

  return (
    <div style={{ minWidth: '200px' }}>
      <Text style={{ color: '#cccccc', fontSize: '12px', fontWeight: 'bold' }}>
        File Changes ({fileChanges.length})
      </Text>
      <List
        size="small"
        dataSource={[...fileChanges]}
        renderItem={(change) => (
          <List.Item style={{ padding: '4px 0' }}>
            <Space>
              {getChangeIcon(change.type)}
              <Text style={{ color: '#cccccc', fontSize: '12px' }}>
                {change.filePath}
              </Text>
              <Tag color={getChangeColor(change.type)}>
                {change.type}
              </Tag>
              {(change.addedLines > 0 || change.removedLines > 0) && (
                <Text style={{ color: '#888888', fontSize: '11px' }}>
                  +{change.addedLines} -{change.removedLines}
                </Text>
              )}
            </Space>
          </List.Item>
        )}
      />
    </div>
  )
}
