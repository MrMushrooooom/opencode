/**
 * Frontend utility for extracting file changes from tool part metadata
 * Similar to TUI's approach: extract on-demand during rendering
 */

export interface FileChangeInfo {
  filePath: string // Display path (may be normalized)
  absolutePath: string // Absolute path for opening file
  type: 'create' | 'modify' | 'delete'
  addedLines: number
  removedLines: number
  diff?: string
  originalContent?: string
  modifiedContent?: string
}

/**
 * Extract file change information from a completed tool part
 * Returns null if no file changes found
 */
export function extractFileChangeFromToolPart(part: any): FileChangeInfo | null {
  if (part.type !== 'tool') {
    return null
  }

  const toolPart = part as any
  const state = toolPart.state

  if (!state || state.status !== 'completed') {
    return null
  }

  const toolName = toolPart.tool
  const metadata = state.metadata as any

  if (!metadata) {
    return null
  }

  switch (toolName) {
    case 'edit':
      return extractFromEditTool(part, metadata)
    case 'patch':
      // TODO: Parse unified diff for patch tool
      return null
    case 'write':
      return extractFromWriteTool(part, metadata, state.input)
    default:
      return null
  }
}

/**
 * Extract file change from edit tool metadata
 * Edit tool provides: metadata.filediff and metadata.diff
 */
function extractFromEditTool(part: any, metadata: any): FileChangeInfo | null {
  const filediff = metadata.filediff
  const diff = metadata.diff

  if (!filediff) {
    return null
  }

  const filePath = filediff.file
  if (!filePath) {
    return null
  }

  const changeType = determineChangeType(filediff.before, filediff.after)
  const normalizedPath = normalizePath(filePath)
  const addedLines = filediff.additions || 0
  const removedLines = filediff.deletions || 0

  return {
    filePath: normalizedPath, // For display
    absolutePath: filePath, // Original absolute path for opening file
    type: changeType,
    addedLines,
    removedLines,
    diff: diff || undefined,
    originalContent: filediff.before || undefined,
    modifiedContent: filediff.after || undefined
  }
}

/**
 * Determine change type based on before/after content
 */
function determineChangeType(before: string | undefined, after: string | undefined): 'create' | 'modify' | 'delete' {
  if (!before || before.trim() === '') {
    return 'create'
  }
  if (!after || after.trim() === '') {
    return 'delete'
  }
  return 'modify'
}

/**
 * Extract file change from write tool metadata
 * Write tool provides: metadata.filepath, metadata.exists, and toolInput.content
 */
function extractFromWriteTool(part: any, metadata: any, input: any): FileChangeInfo | null {
  const filepath = metadata.filepath
  if (!filepath) {
    return null
  }

  const exists = metadata.exists === true
  const content = input?.content
  if (typeof content !== 'string') {
    return null
  }

  const normalizedPath = normalizePath(filepath)
  const lines = content.split('\n')
  const addedLines = lines.length
  const removedLines = 0

  // Generate unified diff format (all additions, green background)
  // For new files: all lines are additions
  // For overwritten files: also show all lines as additions (since we don't have original content)
  const diff = generateWriteDiff(filepath, content)

  return {
    filePath: normalizedPath, // For display
    absolutePath: filepath, // Original absolute path for opening file
    type: exists ? 'modify' : 'create',
    addedLines,
    removedLines,
    diff,
    originalContent: undefined, // Write tool doesn't provide original content
    modifiedContent: content
  }
}

/**
 * Generate unified diff format for write tool
 * All content is shown as additions (green background)
 */
function generateWriteDiff(filePath: string, content: string): string {
  const lines = content.split('\n')
  const lineCount = lines.length
  
  // Generate unified diff header
  // Format: @@ -start,count +start,count @@
  // For write tool: all lines are additions, so old start is 0,0 and new start is 1,lineCount
  const hunkHeader = `@@ -0,0 +1,${lineCount} @@`
  
  // Format each line with + prefix (addition)
  const diffLines = lines.map(line => `+${line}`)
  
  // Combine into unified diff format
  const relativePath = normalizePath(filePath)
  return `--- a/${relativePath}\n+++ b/${relativePath}\n${hunkHeader}\n${diffLines.join('\n')}`
}

/**
 * Normalize file path (convert to relative if needed)
 */
function normalizePath(filePath: string): string {
  // Remove leading slash if present
  if (filePath.startsWith('/')) {
    return filePath.substring(1)
  }
  return filePath
}

