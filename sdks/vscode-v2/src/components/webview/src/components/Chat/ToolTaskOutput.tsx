import React, { useState } from "react"
import { ToolInlineDisplay } from "./ToolInlineDisplay"
import { ToolPartCard } from "./ToolPartCard"
import { ToolGenericOutput } from "./ToolGenericOutput"

interface ToolTaskOutputProps {
  toolMetadata?: any
  toolOutput?: string
  toolStatus: "pending" | "running" | "completed" | "error"
}

const LIGHTWEIGHT_TOOLS = ["read", "grep", "glob", "list", "webfetch"]

const getToolTitle = (toolPart: any): string => {
  const toolName = toolPart.tool || "unknown"
  const input = toolPart.state?.input || {}
  const title = toolPart.state?.title || ""

  if (title) return title

  if (toolName === "read" && input.filePath) {
    return `Read ${input.filePath}`
  }
  if (toolName === "grep" && input.pattern) {
    return `Grep "${input.pattern}"`
  }
  if (toolName === "glob" && input.pattern) {
    return `Glob "${input.pattern}"`
  }
  if (toolName === "list" && (input.path || input.directory)) {
    return `List ${input.path || input.directory}`
  }
  if (toolName === "webfetch" && input.url) {
    return `Fetch ${input.url}`
  }
  if (toolName === "edit" && input.filePath) {
    return `Edit ${input.filePath}`
  }
  if (toolName === "write" && input.filePath) {
    return `Write ${input.filePath}`
  }
  if (toolName === "bash" && input.command) {
    const commandName = input.command.split(/\s+/)[0]
    return `Bash: ${commandName}`
  }

  return toolName
}

const getToolSummary = (toolPart: any): string => {
  const toolName = toolPart.tool || "unknown"
  const metadata = toolPart.state?.metadata || {}
  const fileChange = metadata.filediff || metadata.diff

  if (toolName === "edit" || toolName === "write" || toolName === "patch") {
    if (fileChange) {
      const added = fileChange.addedLines || 0
      const removed = fileChange.removedLines || 0
      if (added > 0 || removed > 0) {
        return `[+${added} -${removed} lines]`
      }
    }
  }

  if (toolName === "grep" && metadata.count !== undefined) {
    return `(${metadata.count} matches)`
  }

  if (toolName === "glob" && metadata.count !== undefined) {
    return `(${metadata.count} files)`
  }

  if (toolName === "list" && metadata.count !== undefined) {
    const truncated = metadata.truncated ? "+" : ""
    return `(${metadata.count}${truncated} files)`
  }

  return ""
}

const renderToolPart = (toolPart: any, index: number): React.ReactNode => {
  if (!toolPart || !toolPart.tool) {
    return null
  }

  const toolName = toolPart.tool
  const state = toolPart.state || {}
  const toolInput = state.input && typeof state.input === "object" ? state.input : {}
  const toolOutput = state.output
  const toolMetadata = state.metadata
  const toolError = state.error
  const toolStatus = state.status || "completed"

  if (LIGHTWEIGHT_TOOLS.includes(toolName)) {
    return (
      <div key={index} onClick={(e) => e.stopPropagation()}>
        <ToolInlineDisplay
          toolName={toolName}
          toolInput={toolInput}
          toolOutput={toolOutput}
          toolMetadata={toolMetadata}
          toolStatus={toolStatus as "pending" | "running" | "completed" | "error"}
          toolError={toolError}
        />
      </div>
    )
  }

  return (
    <div key={index} onClick={(e) => e.stopPropagation()} style={{ margin: "4px 0" }}>
      <ToolPartCard
        toolPart={toolPart}
        toolName={toolName}
        toolInput={toolInput}
        toolStatus={toolStatus as "pending" | "running" | "completed" | "error"}
        toolOutput={typeof toolOutput === "string" ? toolOutput : undefined}
        toolMetadata={toolMetadata}
        toolError={toolError}
      />
    </div>
  )
}

export const ToolTaskOutput: React.FC<ToolTaskOutputProps> = ({ toolMetadata, toolOutput, toolStatus }) => {
  const summary = toolMetadata?.summary || []
  const [expandedTools, setExpandedTools] = useState<Set<number>>(() => {
    const expanded = new Set<number>()
    summary.forEach((toolPart: any, index: number) => {
      const toolName = toolPart.tool || "unknown"
      if (LIGHTWEIGHT_TOOLS.includes(toolName)) {
        expanded.add(index)
      }
    })
    return expanded
  })

  const toggleTool = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedTools((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const hasOutput = toolOutput && toolOutput.trim().length > 0
  const [outputExpanded, setOutputExpanded] = useState(false)

  const outputLines = toolOutput ? toolOutput.split("\n") : []
  const outputHasMoreLines = outputLines.length > 10
  const displayOutputLines = outputExpanded ? outputLines : outputLines.slice(0, 10)

  const isProcessing = toolStatus === "pending" || toolStatus === "running"

  return (
    <div style={{ padding: "12px" }}>
      {isProcessing && summary.length === 0 && (
        <div
          style={{
            color: "#888888",
            fontSize: "12px",
            fontStyle: "italic",
          }}
        >
          Executing task...
        </div>
      )}

      {summary.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              color: "#888888",
              fontSize: "12px",
              marginBottom: "8px",
            }}
          >
            Tools executed ({summary.length}):
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {summary.map((toolPart: any, index: number) => {
              if (!toolPart || !toolPart.tool) {
                return null
              }

              const toolName = toolPart.tool
              const isLightweight = LIGHTWEIGHT_TOOLS.includes(toolName)
              const isExpanded = expandedTools.has(index)
              const title = getToolTitle(toolPart)
              const summaryText = getToolSummary(toolPart)

              if (isLightweight || isExpanded) {
                return renderToolPart(toolPart, index)
              }

              return (
                <div
                  key={index}
                  onClick={(e) => toggleTool(index, e)}
                  style={{
                    padding: "8px 12px",
                    background: "#1e1e1e",
                    border: "1px solid #3e3e42",
                    borderRadius: "4px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#252526"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#1e1e1e"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#cccccc",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#888888" }}>✓</span>
                    <span>{title}</span>
                    {summaryText && <span style={{ color: "#888888" }}>{summaryText}</span>}
                  </div>
                  <span
                    style={{
                      color: "#888888",
                      fontSize: "11px",
                    }}
                  >
                    [点击展开]
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {hasOutput && (
        <div>
          <div
            onClick={() => {
              if (outputHasMoreLines) {
                setOutputExpanded(!outputExpanded)
              }
            }}
            style={{
              color: "#888888",
              fontSize: "12px",
              marginBottom: "8px",
              cursor: outputHasMoreLines ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>Final output:</span>
            {outputHasMoreLines && <span style={{ fontSize: "10px" }}>{outputExpanded ? "▲" : "▼"}</span>}
          </div>
          <div
            style={{
              padding: "8px 12px",
              background: "#1e1e1e",
              border: "1px solid #3e3e42",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "12px",
              color: "#cccccc",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: outputExpanded ? "400px" : "none",
              overflowY: outputExpanded ? "auto" : "visible",
            }}
          >
            {displayOutputLines.join("\n")}
          </div>
        </div>
      )}
    </div>
  )
}
