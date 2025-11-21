import React from 'react'
import {
  FileTextOutlined,
  CodeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileMarkdownOutlined,
  FileOutlined
} from '@ant-design/icons'

/**
 * Get file type icon based on file extension
 * Returns appropriate Ant Design icon component
 */
export function getFileIcon(filePath: string): React.ReactNode {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  
  const iconMap: Record<string, React.ReactNode> = {
    // Code files
    'ts': <CodeOutlined style={{ fontSize: '14px' }} />,
    'tsx': <CodeOutlined style={{ fontSize: '14px' }} />,
    'js': <CodeOutlined style={{ fontSize: '14px' }} />,
    'jsx': <CodeOutlined style={{ fontSize: '14px' }} />,
    'py': <CodeOutlined style={{ fontSize: '14px' }} />,
    'go': <CodeOutlined style={{ fontSize: '14px' }} />,
    'rs': <CodeOutlined style={{ fontSize: '14px' }} />,
    'java': <CodeOutlined style={{ fontSize: '14px' }} />,
    'cpp': <CodeOutlined style={{ fontSize: '14px' }} />,
    'c': <CodeOutlined style={{ fontSize: '14px' }} />,
    'cs': <CodeOutlined style={{ fontSize: '14px' }} />,
    'php': <CodeOutlined style={{ fontSize: '14px' }} />,
    'rb': <CodeOutlined style={{ fontSize: '14px' }} />,
    'swift': <CodeOutlined style={{ fontSize: '14px' }} />,
    'kt': <CodeOutlined style={{ fontSize: '14px' }} />,
    'scala': <CodeOutlined style={{ fontSize: '14px' }} />,
    'vue': <CodeOutlined style={{ fontSize: '14px' }} />,
    'svelte': <CodeOutlined style={{ fontSize: '14px' }} />,
    'html': <CodeOutlined style={{ fontSize: '14px' }} />,
    'css': <CodeOutlined style={{ fontSize: '14px' }} />,
    'scss': <CodeOutlined style={{ fontSize: '14px' }} />,
    'less': <CodeOutlined style={{ fontSize: '14px' }} />,
    'json': <CodeOutlined style={{ fontSize: '14px' }} />,
    'xml': <CodeOutlined style={{ fontSize: '14px' }} />,
    'yaml': <CodeOutlined style={{ fontSize: '14px' }} />,
    'yml': <CodeOutlined style={{ fontSize: '14px' }} />,
    'toml': <CodeOutlined style={{ fontSize: '14px' }} />,
    'ini': <CodeOutlined style={{ fontSize: '14px' }} />,
    'sh': <CodeOutlined style={{ fontSize: '14px' }} />,
    'bash': <CodeOutlined style={{ fontSize: '14px' }} />,
    'zsh': <CodeOutlined style={{ fontSize: '14px' }} />,
    'fish': <CodeOutlined style={{ fontSize: '14px' }} />,
    'ps1': <CodeOutlined style={{ fontSize: '14px' }} />,
    'sql': <CodeOutlined style={{ fontSize: '14px' }} />,
    'graphql': <CodeOutlined style={{ fontSize: '14px' }} />,
    'dockerfile': <CodeOutlined style={{ fontSize: '14px' }} />,
    'makefile': <CodeOutlined style={{ fontSize: '14px' }} />,
    'cmake': <CodeOutlined style={{ fontSize: '14px' }} />,
    
    // Markdown
    'md': <FileMarkdownOutlined style={{ fontSize: '14px' }} />,
    'markdown': <FileMarkdownOutlined style={{ fontSize: '14px' }} />,
    
    // Images
    'png': <FileImageOutlined style={{ fontSize: '14px' }} />,
    'jpg': <FileImageOutlined style={{ fontSize: '14px' }} />,
    'jpeg': <FileImageOutlined style={{ fontSize: '14px' }} />,
    'gif': <FileImageOutlined style={{ fontSize: '14px' }} />,
    'svg': <FileImageOutlined style={{ fontSize: '14px' }} />,
    'webp': <FileImageOutlined style={{ fontSize: '14px' }} />,
    'ico': <FileImageOutlined style={{ fontSize: '14px' }} />,
    'bmp': <FileImageOutlined style={{ fontSize: '14px' }} />,
    
    // Documents
    'pdf': <FilePdfOutlined style={{ fontSize: '14px' }} />,
  }
  
  return iconMap[ext] || <FileTextOutlined style={{ fontSize: '14px' }} />
}

