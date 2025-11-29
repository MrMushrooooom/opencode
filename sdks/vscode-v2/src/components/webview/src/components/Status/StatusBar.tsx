import React from "react"
import { Typography, Space, Tag } from "antd"
import { ClockCircleOutlined, RobotOutlined, BuildOutlined, BulbOutlined } from "@ant-design/icons"
import { FrontendSession } from "../../types"

const { Text } = Typography

interface StatusBarProps {
  status: "ready" | "sending" | "generating" | "error"
  currentSession: FrontendSession | null
  mode: "plan" | "build"
}

/**
 * Status bar component
 * Displays current application status and session information
 */
export const StatusBar: React.FC<StatusBarProps> = ({ status, currentSession, mode }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "#52c41a"
      case "sending":
        return "#1890ff"
      case "generating":
        return "#faad14"
      case "error":
        return "#ff4d4f"
      default:
        return "#888888"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "ready":
        return "Ready"
      case "sending":
        return "Sending..."
      case "generating":
        return "Generating..."
      case "error":
        return "Error"
      default:
        return "Unknown"
    }
  }

  return (
    <Space split="|" style={{ color: "#888888", fontSize: "12px" }}>
      <Space>
        <ClockCircleOutlined />
        <Text style={{ color: getStatusColor(status) }}>{getStatusText(status)}</Text>
      </Space>

      {currentSession && (
        <Space>
          <RobotOutlined />
          <Text>{currentSession.title || `Session ${currentSession.id.slice(0, 8)}`}</Text>
        </Space>
      )}

      <Space>
        {mode === "plan" ? (
          <BulbOutlined style={{ color: "#1890ff" }} />
        ) : (
          <BuildOutlined style={{ color: "#52c41a" }} />
        )}
        <Tag color={mode === "plan" ? "blue" : "green"}>{mode === "plan" ? "Plan" : "Build"}</Tag>
      </Space>
    </Space>
  )
}
