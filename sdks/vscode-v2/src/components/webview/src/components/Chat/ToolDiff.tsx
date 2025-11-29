import React, { useState, useMemo } from "react"
import { DownOutlined, UpOutlined } from "@ant-design/icons"
import { FileChangeInfo } from "../../utils/fileChangeExtractor"

interface ToolDiffProps {
  fileChange: FileChangeInfo
}

interface DiffLine {
  type: "added" | "removed" | "context" | "hunk"
  content: string
  lineNumber?: number
}

export const ToolDiff: React.FC<ToolDiffProps> = ({ fileChange }) => {
  const [expanded, setExpanded] = useState(false)

  const diffLines = useMemo(() => {
    if (!fileChange.diff) return []

    const lines: DiffLine[] = []
    const rawLines = fileChange.diff.split("\n")

    for (const line of rawLines) {
      if (line.startsWith("---") || line.startsWith("+++")) {
        continue
      }
      if (line.startsWith("Index:") || (line.trim() === "" && line.includes("="))) {
        continue
      }
      if (/^[=\-]+$/.test(line.trim())) {
        continue
      }
      if (line.startsWith("\\")) {
        continue
      }
      if (line.startsWith("@@")) {
        lines.push({ type: "hunk", content: line })
      } else if (line.startsWith("+")) {
        const content = line.substring(1)
        lines.push({ type: "added", content })
      } else if (line.startsWith("-")) {
        const content = line.substring(1)
        lines.push({ type: "removed", content })
      } else {
        const content = line.startsWith(" ") ? line.substring(1) : line
        lines.push({ type: "context", content })
      }
    }

    return lines
  }, [fileChange.diff])

  const displayLines = useMemo(() => {
    const allLines = diffLines.filter(
      (line) => line.type === "added" || line.type === "removed" || line.type === "context",
    )

    const firstChangeIndex = allLines.findIndex((line) => line.type === "added" || line.type === "removed")

    if (firstChangeIndex === -1) {
      return allLines
    }

    const startIndex = Math.max(0, firstChangeIndex - 1)
    return allLines.slice(startIndex)
  }, [diffLines])

  const shouldShowExpand = displayLines.length > 5
  const visibleLines = expanded ? displayLines : displayLines.slice(0, 5)

  if (displayLines.length === 0) {
    return null
  }

  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: "12px",
        lineHeight: "1.6",
      }}
    >
      {visibleLines.map((line, idx) => {
        const isAdded = line.type === "added"
        const isRemoved = line.type === "removed"
        const isContext = line.type === "context"

        return (
          <div
            key={idx}
            style={{
              padding: "2px 12px",
              backgroundColor: isAdded
                ? "rgba(46, 160, 67, 0.15)"
                : isRemoved
                  ? "rgba(231, 76, 60, 0.15)"
                  : "transparent",
              color: isContext ? "#888888" : "#cccccc",
              whiteSpace: "pre",
              fontFamily: "monospace",
              fontSize: "12px",
              lineHeight: "1.6",
              minHeight: "20px",
            }}
          >
            {line.content || " "}
          </div>
        )
      })}

      {shouldShowExpand && (
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            textAlign: "center",
            borderTop: "1px solid #3e3e42",
            color: "#888888",
            fontSize: "11px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            transition: "background-color 0.2s",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#2d2d30"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent"
          }}
        >
          {expanded ? (
            <>
              <UpOutlined style={{ fontSize: "10px" }} />
              <span>Show less</span>
            </>
          ) : (
            <>
              <DownOutlined style={{ fontSize: "10px" }} />
              <span>Show more ({displayLines.length - 5} more lines)</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
