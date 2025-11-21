import * as vscode from 'vscode'
import * as path from 'path'

/**
 * File change information extracted from tool metadata
 */
export interface ExtractedFileChange {
  filePath: string
  type: 'create' | 'modify' | 'delete'
  addedLines: number
  removedLines: number
  diff?: string
  originalContent?: string
  modifiedContent?: string
  toolName: string
  messageId: string
  partId: string
}

/**
 * Extracts file change information from tool execution metadata
 * Handles edit, patch, and write tools
 */
export class FileChangeExtractor {
  constructor(
    private outputChannel: vscode.OutputChannel,
    private sendToWebView: (type: string, data: any) => void
  ) {}

  /**
   * Extract file changes from a completed tool part
   * Returns array of file changes or null if no changes found
   */
  extractFromTool(part: any, messageId: string): ExtractedFileChange[] | null {
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
        return this.extractFromEditTool(part, messageId, metadata)
      case 'patch':
        return this.extractFromPatchTool(part, messageId, metadata)
      case 'write':
        return this.extractFromWriteTool(part, messageId, metadata)
      default:
        return null
    }
  }

  /**
   * Extract file changes from edit tool metadata
   * Edit tool provides: metadata.filediff and metadata.diff
   */
  private extractFromEditTool(
    part: any,
    messageId: string,
    metadata: any
  ): ExtractedFileChange[] | null {
    const filediff = metadata.filediff
    const diff = metadata.diff

    if (!filediff) {
      return null
    }

    const filePath = filediff.file
    if (!filePath) {
      return null
    }

    const changeType = this.determineChangeType(filediff.before, filediff.after)
    const normalizedPath = this.normalizePath(filePath)
    const addedLines = filediff.additions || 0
    const removedLines = filediff.deletions || 0

    this.outputChannel.appendLine(
      `📝 Extracted file change: ${normalizedPath} (${changeType}, +${addedLines}/-${removedLines})`
    )

    return [
      {
        filePath: normalizedPath,
        type: changeType,
        addedLines,
        removedLines,
        diff: diff || undefined,
        originalContent: filediff.before || undefined,
        modifiedContent: filediff.after || undefined,
        toolName: 'edit',
        messageId,
        partId: part.id
      }
    ]
  }

  /**
   * Extract file changes from patch tool metadata
   * Patch tool provides: metadata.diff (unified diff format, may contain multiple files)
   * TODO: Parse unified diff to extract individual file changes
   */
  private extractFromPatchTool(
    part: any,
    messageId: string,
    metadata: any
  ): ExtractedFileChange[] | null {
    const diff = metadata.diff

    if (!diff || typeof diff !== 'string') {
      return null
    }

    this.outputChannel.appendLine(`⚠️ Patch tool diff parsing not yet implemented`)
    return null
  }

  /**
   * Extract file changes from write tool metadata
   * Write tool provides: metadata.exists (file existed before) and metadata.filepath
   * TODO: Calculate diff by reading file content
   */
  private extractFromWriteTool(
    part: any,
    messageId: string,
    metadata: any
  ): ExtractedFileChange[] | null {
    const filePath = metadata.filepath
    const exists = metadata.exists

    if (!filePath) {
      return null
    }

    this.outputChannel.appendLine(`⚠️ Write tool diff calculation not yet implemented`)
    return null
  }

  /**
   * Determine change type based on before/after content
   */
  private determineChangeType(before: string | undefined, after: string | undefined): 'create' | 'modify' | 'delete' {
    if (!before || before.trim() === '') {
      return 'create'
    }
    if (!after || after.trim() === '') {
      return 'delete'
    }
    return 'modify'
  }

  /**
   * Normalize file path (convert to relative if needed)
   */
  private normalizePath(filePath: string): string {
    return path.normalize(filePath)
  }
}

