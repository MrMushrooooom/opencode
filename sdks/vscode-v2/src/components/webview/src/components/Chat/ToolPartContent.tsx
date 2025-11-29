import React from "react"
import { Typography, Space, Button } from "antd"
import { ToolDiff } from "./ToolDiff"
import { ToolCommandOutput } from "./ToolCommandOutput"
import { ToolTodoList } from "./ToolTodoList"
import { ToolGenericOutput } from "./ToolGenericOutput"
import { ToolTaskOutput } from "./ToolTaskOutput"
import { extractFileChangeFromToolPart } from "../../utils/fileChangeExtractor"

const { Text } = Typography

interface ToolPartContentProps {
  toolName: string
  toolInput?: Record<string, any>
  toolOutput?: string
  toolMetadata?: any
  toolStatus: "pending" | "running" | "completed" | "error"
  toolError?: string
  toolPart: any
  currentPermission?: any
  currentSessionId?: string
  onPermissionRespond?: (response: "once" | "always" | "reject") => void
}

export const ToolPartContent: React.FC<ToolPartContentProps> = ({
  toolName,
  toolInput,
  toolOutput,
  toolMetadata,
  toolStatus,
  toolError,
  toolPart,
  currentPermission,
  currentSessionId,
  onPermissionRespond,
}) => {
  if (toolStatus === "error" && toolError && !toolError.includes("rejected")) {
    return (
      <div
        style={{
          padding: "12px",
          color: "#888888",
          fontSize: "11px",
        }}
      >
        {toolError}
      </div>
    )
  }

  // For todo tools, show todo list in all states (pending/running/completed)
  if (toolName === "todowrite" || toolName === "todoread") {
    const todos = toolInput?.todos || []
    if (todos.length > 0) {
      return <ToolTodoList todos={todos} toolStatus={toolStatus} />
    }
  }

  // For task tool, show task output with summary
  if (toolName === "task") {
    return <ToolTaskOutput toolMetadata={toolMetadata} toolOutput={toolOutput} toolStatus={toolStatus} />
  }

  if (toolStatus === "completed") {
    const fileChange = extractFileChangeFromToolPart(toolPart)

    if (fileChange && (toolName === "edit" || toolName === "write" || toolName === "patch")) {
      return <ToolDiff fileChange={fileChange} />
    }

    if (toolName === "bash") {
      const command = toolPart?.state?.input?.command
      const output = toolOutput || toolMetadata?.output || ""
      if (command && typeof command === "string") {
        return <ToolCommandOutput command={command} output={output} />
      }
    }

    if (toolOutput) {
      if (typeof toolOutput === "string") {
        return <ToolGenericOutput toolName={toolName} toolOutput={toolOutput} toolMetadata={toolMetadata} />
      }

      // Handle non-string output (e.g., JSON objects)
      const jsonOutput = JSON.stringify(toolOutput, null, 2)
      if (jsonOutput) {
        return <ToolGenericOutput toolName={toolName} toolOutput={jsonOutput} toolMetadata={toolMetadata} />
      }
    }
  }

  if (toolStatus === "running" && currentPermission && toolName === "bash" && onPermissionRespond) {
    return (
      <div
        style={{
          padding: "12px",
          background: "rgba(0, 0, 0, 0.2)",
        }}
      >
        <Text style={{ color: "#cccccc", fontSize: "11px", display: "block", marginBottom: "6px" }}>
          {currentPermission.title || "Permission required"}
        </Text>
        <Space size={4}>
          <Button
            size="small"
            style={{ fontSize: "11px", height: "22px", padding: "0 8px" }}
            onClick={() => onPermissionRespond("once")}
          >
            Run Once
          </Button>
          <Button
            size="small"
            style={{ fontSize: "11px", height: "22px", padding: "0 8px" }}
            onClick={() => onPermissionRespond("always")}
          >
            Always Allow
          </Button>
          <Button
            size="small"
            style={{ fontSize: "11px", height: "22px", padding: "0 8px" }}
            onClick={() => onPermissionRespond("reject")}
          >
            Reject
          </Button>
        </Space>
      </div>
    )
  }

  return null
}
