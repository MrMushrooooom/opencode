/**
 * Tool Renderer - Handles rendering of different tool execution results
 * Provides consistent display logic for various tool types
 */

/**
 * Render tool output based on tool type
 * Different tools have different display strategies
 */
export function renderToolOutput(
  toolName: string,
  output: string,
  metadata?: any
): string {
  // Helper function to truncate lines
  const truncateLines = (text: string, maxLines: number) => {
    const lines = text.split('\n')
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n')
    }
    return text
  }

  // Strip unwanted markers (like line numbers and <file>)
  const stripMarkers = (text: string) => {
    return text
      .replace(/<file>/g, '')
      .replace(/^\d{5}\|/gm, '')  // Remove line numbers like "00001|"
  }

  switch (toolName) {
    case 'read':
      // File read: show only first 6 lines for preview
      return stripMarkers(truncateLines(output, 6))

    case 'edit':
      // File edit: show full content (for diff display)
      return stripMarkers(output)

    case 'write':
      // File write: show full content
      return stripMarkers(output)

    case 'bash':
      // Bash commands: show full output
      return output

    case 'list':
      // Directory listing: show full output
      return output

    case 'glob':
      // File search: show full output (usually short)
      return output

    case 'webfetch':
      // Web fetch: show first 10 lines
      return truncateLines(output, 10)

    case 'todowrite':
      // Todo write: show full output
      return output

    case 'task':
      // Task: show summary
      return output

    default:
      // Other tools: show first 10 lines
      return stripMarkers(truncateLines(output, 10))
  }
}

/**
 * Get tool icon color based on tool name
 */
export function getToolIconColor(toolName: string): string {
  const colorMap: Record<string, string> = {
    read: '#52c41a',    // Green
    edit: '#1890ff',    // Blue
    write: '#1890ff',   // Blue
    bash: '#faad14',    // Orange
    list: '#52c41a',    // Green
    glob: '#722ed1',    // Purple
    webfetch: '#13c2c2', // Cyan
  }
  return colorMap[toolName] || '#52c41a'
}

/**
 * Get display title for tool
 */
export function getToolDisplayTitle(toolName: string): string {
  const titleMap: Record<string, string> = {
    read: 'Read',
    edit: 'Edit',
    write: 'Write',
    bash: 'Bash',
    list: 'List',
    glob: 'Search',
    webfetch: 'Fetch',
    todowrite: 'Todo',
    task: 'Task',
  }
  return titleMap[toolName] || toolName
}

