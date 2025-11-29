import React, { useState } from "react"
import { webViewService } from "../../services/webviewService"

interface ToolInlineDisplayProps {
  toolName: string
  toolInput: Record<string, any>
  toolOutput?: string
  toolMetadata?: any
  toolStatus: "pending" | "running" | "completed" | "error"
  toolError?: string
}

interface GrepFileInfo {
  path: string
  matchCount: number
}

export const ToolInlineDisplay: React.FC<ToolInlineDisplayProps> = ({
  toolName,
  toolInput,
  toolOutput,
  toolMetadata,
  toolStatus,
  toolError,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const handleFileClick = (filePath: string) => {
    webViewService.openFile(filePath)
  }

  const getFileName = (filePath: string) => {
    const parts = filePath.split("/")
    return parts[parts.length - 1] || filePath
  }

  const formatLineRange = (offset: number | undefined, limit: number | undefined): string => {
    const hasOffset = offset !== undefined && offset !== null
    const hasLimit = limit !== undefined && limit !== null

    if (!hasOffset && !hasLimit) {
      return ""
    }

    const startLine = hasOffset ? offset + 1 : 1
    const endLine = hasOffset && hasLimit ? offset + limit : hasLimit ? limit : undefined

    if (endLine !== undefined && endLine > startLine) {
      return ` L${startLine} - ${endLine}`
    }
    if (endLine !== undefined && endLine === startLine) {
      return ` L${startLine}`
    }
    if (hasOffset) {
      return ` L${startLine}`
    }
    return ""
  }

  const parseGrepFiles = (output: string): GrepFileInfo[] => {
    const lines = output.split("\n")
    const fileMap = new Map<string, number>()
    let currentFile = ""

    for (const line of lines) {
      const trimmed = line.trim()
      // 识别文件路径行（不以空格开头，以 : 结尾）
      if (trimmed.endsWith(":") && !line.startsWith(" ")) {
        currentFile = trimmed.slice(0, -1).trim()
        if (currentFile && !fileMap.has(currentFile)) {
          fileMap.set(currentFile, 0)
        }
      }
      // 识别匹配行（以 "  Line " 开头）
      else if (trimmed.startsWith("Line ") && currentFile) {
        const count = fileMap.get(currentFile) || 0
        fileMap.set(currentFile, count + 1)
      }
    }

    return Array.from(fileMap.entries()).map(([path, matchCount]) => ({
      path,
      matchCount,
    }))
  }

  const parseGlobFiles = (output: string): string[] => {
    const lines = output.split("\n")
    return lines
      .map((line) => line.trim())
      .filter(
        (line) =>
          line &&
          !line.startsWith("(") &&
          line !== "No files found" &&
          !line.includes("truncated") &&
          !line.includes("Results are truncated"),
      )
  }

  const formatGrepDisplay = (pattern: string, matches: number): string => {
    if (matches === 0) return `Grepped "${pattern}" (no matches)`
    return `Grepped "${pattern}" (${matches} matches)`
  }

  const formatGlobDisplay = (pattern: string, count: number): string => {
    if (count === 0) return `Globbed "${pattern}" (no files)`
    return `Globbed "${pattern}" (${count} files)`
  }

  const getShortPath = (fullPath: string): string => {
    const parts = fullPath.split("/")
    if (parts.length <= 3) return fullPath
    return `.../${parts.slice(-2).join("/")}`
  }

  const getShortUrl = (url: string): string => {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname
      const path = urlObj.pathname + urlObj.search + urlObj.hash
      if (path.length > 30) {
        return `${domain}...`
      }
      return `${domain}${path}`
    } catch {
      if (url.length > 40) {
        return `${url.slice(0, 37)}...`
      }
      return url
    }
  }

  const formatListDisplay = (path: string, count: number, truncated: boolean): string => {
    const pathDisplay = path ? getShortPath(path) : "current directory"

    if (count === 0) {
      return `List ${pathDisplay} (no files)`
    }
    const countDisplay = truncated ? `${count}+` : `${count}`
    return `List ${pathDisplay} (${countDisplay} ${count === 1 ? "file" : "files"})`
  }

  const hasDirectoryTreeContent = (output: string | undefined): boolean => {
    if (!output) return false
    const lines = output.split("\n").filter((line) => line.trim())
    return lines.length > 1 // More than just the base path line
  }

  if (toolName === "read") {
    const filePath = toolInput?.filePath
    if (filePath) {
      const offset = toolInput?.offset
      const limit = toolInput?.limit
      const lineRange = formatLineRange(offset, limit)
      const displayText = `Read ${getFileName(filePath)}${lineRange}`
      const isProcessing = toolStatus === "pending" || toolStatus === "running"
      const isError = toolStatus === "error"

      return (
        <div>
          <div
            onClick={() => {
              if (!isError) {
                handleFileClick(filePath)
              }
            }}
            style={{
              display: "inline",
              color: isError ? "#666666" : "#888888",
              fontSize: "13px",
              cursor: isError ? "default" : "pointer",
              userSelect: "none",
              transition: "color 0.2s",
              textDecoration: isError ? "line-through" : "none",
              animation: isProcessing ? "blink 2s ease-in-out infinite" : "none",
            }}
            onMouseEnter={(e) => {
              if (!isError) {
                e.currentTarget.style.color = "#cccccc"
              }
            }}
            onMouseLeave={(e) => {
              if (!isError) {
                e.currentTarget.style.color = "#888888"
              }
            }}
          >
            {displayText}
          </div>
          {isProcessing && (
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
  }

  if (toolName === "grep") {
    const pattern = toolInput?.pattern || ""
    const matches = toolMetadata?.matches || 0
    const displayText = formatGrepDisplay(pattern, matches)
    const isProcessing = toolStatus === "pending" || toolStatus === "running"
    const isError = toolStatus === "error"
    const fileList = toolOutput ? parseGrepFiles(toolOutput) : []

    return (
      <div>
        <div
          onClick={() => {
            if (!isError && fileList.length > 0) {
              setIsExpanded(!isExpanded)
            }
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            color: isError ? "#666666" : "#888888",
            fontSize: "13px",
            cursor: isError || fileList.length === 0 ? "default" : "pointer",
            userSelect: "none",
            transition: "color 0.2s",
            textDecoration: isError ? "line-through" : "none",
            animation: isProcessing ? "blink 2s ease-in-out infinite" : "none",
          }}
          onMouseEnter={(e) => {
            if (!isError && fileList.length > 0) {
              e.currentTarget.style.color = "#cccccc"
            }
          }}
          onMouseLeave={(e) => {
            if (!isError && fileList.length > 0) {
              e.currentTarget.style.color = "#888888"
            }
          }}
        >
          <span>{displayText}</span>
          {!isError && fileList.length > 0 && <span style={{ fontSize: "10px" }}>{isExpanded ? "▲" : "▼"}</span>}
        </div>
        {isProcessing && (
          <style>{`
            @keyframes blink {
              0% { opacity: 1; }
              50% { opacity: 0.5; }
              100% { opacity: 1; }
            }
          `}</style>
        )}
        {isExpanded && fileList.length > 0 && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              background: "#1e1e1e",
              borderRadius: "4px",
              border: "1px solid #3e3e42",
            }}
          >
            {fileList.map(({ path, matchCount }) => (
              <div
                key={path}
                onClick={(e) => {
                  e.stopPropagation()
                  handleFileClick(path)
                }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderRadius: "2px",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#2a2a2a"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                  <span style={{ flexShrink: 0 }}>{getFileName(path)}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#888888",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {path}
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#888888", flexShrink: 0, marginLeft: "8px" }}>
                  {matchCount} {matchCount === 1 ? "match" : "matches"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (toolName === "glob") {
    const pattern = toolInput?.pattern || ""
    const count = toolMetadata?.count || 0
    const displayText = formatGlobDisplay(pattern, count)
    const isProcessing = toolStatus === "pending" || toolStatus === "running"
    const isError = toolStatus === "error"
    const fileList = toolOutput ? parseGlobFiles(toolOutput) : []

    return (
      <div>
        <div
          onClick={() => {
            if (!isError && fileList.length > 0) {
              setIsExpanded(!isExpanded)
            }
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            color: isError ? "#666666" : "#888888",
            fontSize: "13px",
            cursor: isError || fileList.length === 0 ? "default" : "pointer",
            userSelect: "none",
            transition: "color 0.2s",
            textDecoration: isError ? "line-through" : "none",
            animation: isProcessing ? "blink 2s ease-in-out infinite" : "none",
          }}
          onMouseEnter={(e) => {
            if (!isError && fileList.length > 0) {
              e.currentTarget.style.color = "#cccccc"
            }
          }}
          onMouseLeave={(e) => {
            if (!isError && fileList.length > 0) {
              e.currentTarget.style.color = "#888888"
            }
          }}
        >
          <span>{displayText}</span>
          {!isError && fileList.length > 0 && <span style={{ fontSize: "10px" }}>{isExpanded ? "▲" : "▼"}</span>}
        </div>
        {isProcessing && (
          <style>{`
            @keyframes blink {
              0% { opacity: 1; }
              50% { opacity: 0.5; }
              100% { opacity: 1; }
            }
          `}</style>
        )}
        {isExpanded && fileList.length > 0 && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              background: "#1e1e1e",
              borderRadius: "4px",
              border: "1px solid #3e3e42",
            }}
          >
            {fileList.map((path) => (
              <div
                key={path}
                onClick={(e) => {
                  e.stopPropagation()
                  handleFileClick(path)
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderRadius: "2px",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#2a2a2a"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent"
                }}
              >
                <span style={{ flexShrink: 0 }}>{getFileName(path)}</span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#888888",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {path}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (toolName === "list") {
    const directory = toolInput?.path || toolInput?.directory || ""
    const count = toolMetadata?.count || 0
    const truncated = toolMetadata?.truncated || false
    const displayText = formatListDisplay(directory, count, truncated)
    const isProcessing = toolStatus === "pending" || toolStatus === "running"
    const isError = toolStatus === "error"
    const hasContent = hasDirectoryTreeContent(toolOutput)

    return (
      <div>
        <div
          onClick={() => {
            if (!isError && hasContent) {
              setIsExpanded(!isExpanded)
            }
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            color: isError ? "#666666" : "#888888",
            fontSize: "13px",
            cursor: isError || !hasContent ? "default" : "pointer",
            userSelect: "none",
            transition: "color 0.2s",
            textDecoration: isError ? "line-through" : "none",
            animation: isProcessing ? "blink 2s ease-in-out infinite" : "none",
          }}
          onMouseEnter={(e) => {
            if (!isError && hasContent) {
              e.currentTarget.style.color = "#cccccc"
            }
          }}
          onMouseLeave={(e) => {
            if (!isError && hasContent) {
              e.currentTarget.style.color = "#888888"
            }
          }}
        >
          <span>{displayText}</span>
          {!isError && hasContent && <span style={{ fontSize: "10px" }}>{isExpanded ? "▲" : "▼"}</span>}
        </div>
        {isProcessing && (
          <style>{`
            @keyframes blink {
              0% { opacity: 1; }
              50% { opacity: 0.5; }
              100% { opacity: 1; }
            }
          `}</style>
        )}
        {isExpanded && hasContent && toolOutput && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              background: "#1e1e1e",
              borderRadius: "4px",
              border: "1px solid #3e3e42",
              fontFamily: "monospace",
              fontSize: "12px",
              color: "#cccccc",
              whiteSpace: "pre",
              overflowX: "auto",
              maxHeight: "400px",
              overflowY: "auto",
            }}
          >
            {toolOutput}
          </div>
        )}
      </div>
    )
  }

  if (toolName === "webfetch") {
    const url = toolInput?.url || ""
    const displayText = url ? `Fetch ${getShortUrl(url)}` : "Fetch"
    const isProcessing = toolStatus === "pending" || toolStatus === "running"
    const isError = toolStatus === "error"

    return (
      <div>
        <div
          onClick={() => {
            if (!isError && url) {
              webViewService.openExternal(url)
            }
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            color: isError ? "#666666" : "#888888",
            fontSize: "13px",
            cursor: isError || !url ? "default" : "pointer",
            userSelect: "none",
            transition: "color 0.2s",
            textDecoration: isError ? "line-through" : "none",
            animation: isProcessing ? "blink 2s ease-in-out infinite" : "none",
          }}
          onMouseEnter={(e) => {
            if (!isError && url) {
              e.currentTarget.style.color = "#cccccc"
            }
          }}
          onMouseLeave={(e) => {
            if (!isError && url) {
              e.currentTarget.style.color = "#888888"
            }
          }}
        >
          <span>{displayText}</span>
        </div>
        {isProcessing && (
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

  return null
}
