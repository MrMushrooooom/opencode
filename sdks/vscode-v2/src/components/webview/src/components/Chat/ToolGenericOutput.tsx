import React, { useState } from "react"

interface ToolGenericOutputProps {
  toolName: string
  toolOutput: string
  toolMetadata?: any
}

export const ToolGenericOutput: React.FC<ToolGenericOutputProps> = ({ toolName, toolOutput, toolMetadata }) => {
  const [expanded, setExpanded] = useState(false)

  const outputLines = toolOutput.split("\n")
  const hasMoreLines = outputLines.length > 10
  const displayLines = expanded ? outputLines : outputLines.slice(0, 10)

  return (
    <div
      onClick={() => {
        if (hasMoreLines) {
          setExpanded(!expanded)
        }
      }}
      style={{
        padding: "12px",
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#cccccc",
        background: "rgba(0, 0, 0, 0.2)",
        cursor: hasMoreLines ? "pointer" : "default",
        maxHeight: expanded ? "400px" : "none",
        overflowY: expanded ? "auto" : "visible",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        transition: "max-height 0.3s ease",
      }}
    >
      <div>{displayLines.join("\n")}</div>
    </div>
  )
}
