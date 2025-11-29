import React from "react"
import { Card, Typography, Space, Tag, Spin, Empty } from "antd"
import { UserOutlined, RobotOutlined, ClockCircleOutlined } from "@ant-design/icons"
import { Message, Session } from "../../types"
import { MessageItem } from "./MessageItem"
import { useSettings } from "../../store"
import { webViewService } from "../../services/webviewService"

const { Text } = Typography

interface ChatAreaProps {
  messages: readonly Message[]
  isStreaming: boolean
  currentSession: Session | null
  queuedMessages: readonly string[]
}

/**
 * Chat area component for displaying conversation messages
 * Handles message rendering and streaming updates
 */
export const ChatArea: React.FC<ChatAreaProps> = ({ messages, isStreaming, currentSession, queuedMessages }) => {
  const { showThinkingBlocks, showToolDetails } = useSettings()

  // Auto-scroll functionality
  const chatContainerRef = React.useRef<HTMLDivElement>(null)
  const [isUserAtBottom, setIsUserAtBottom] = React.useState(true)
  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true)

  // Check if user is at bottom of chat
  const checkIfAtBottom = React.useCallback(() => {
    if (!chatContainerRef.current) return false

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    const threshold = 50 // Allow 50px threshold for "at bottom"
    return scrollHeight - scrollTop - clientHeight <= threshold
  }, [])

  // Handle scroll events
  const handleScroll = React.useCallback(() => {
    const atBottom = checkIfAtBottom()
    setIsUserAtBottom(atBottom)
    setShouldAutoScroll(atBottom)
  }, [checkIfAtBottom])

  // Auto-scroll to bottom when new messages arrive (only if user was at bottom)
  React.useEffect(() => {
    if (shouldAutoScroll && chatContainerRef.current) {
      // Use immediate scrolling to ensure we reach the exact bottom
      // This prevents the async smooth scroll from interfering with bottom detection
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, shouldAutoScroll])

  // Force scroll to bottom when user sends a message (to ensure they see their message)
  React.useEffect(() => {
    if (messages.length > 0 && chatContainerRef.current) {
      const lastMessage = messages[messages.length - 1]
      // If the last message is from user, force scroll to bottom
      if (lastMessage.info.role === "user") {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
        setShouldAutoScroll(true) // Ensure auto-scroll is enabled for AI response
        setIsUserAtBottom(true)
      }
    }
  }, [messages])

  // Reset auto-scroll when user manually scrolls away from bottom
  React.useEffect(() => {
    if (!isUserAtBottom) {
      setShouldAutoScroll(false)
    }
  }, [isUserAtBottom])

  // Show welcome message when no session is active
  if (!currentSession) {
    return (
      <Card
        style={{
          height: "100%",
          background: "#252526",
          border: "1px solid #3e3e42",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" align="center">
              <Text style={{ color: "#cccccc", fontSize: "16px" }}>Welcome to OpenCode Assistant</Text>
              <Text style={{ color: "#888888", fontSize: "14px" }}>Start a new session to begin coding with AI</Text>
            </Space>
          }
        />
      </Card>
    )
  }

  // Show empty state when no messages
  if (messages.length === 0) {
    return (
      <Card
        style={{
          height: "100%",
          background: "#252526",
          border: "1px solid #3e3e42",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" align="center">
              <Text style={{ color: "#cccccc", fontSize: "16px" }}>Start a conversation</Text>
              <Text style={{ color: "#888888", fontSize: "14px" }}>Ask me anything about your code or project</Text>
            </Space>
          }
        />
      </Card>
    )
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          background: "#252526",
          border: "1px solid #3e3e42",
          overflow: "auto",
          padding: "16px",
        }}
      >
        {messages.map((message, index) => {
          const isQueued = queuedMessages.includes(message.info.id)
          const isFirst = index === 0

          // Add extra spacing when user message follows assistant message (new turn)
          let needsExtraSpacing = false
          if (!isFirst && message.info.role === "user") {
            const previousMessage = messages[index - 1]
            // Only when previous message was from assistant
            if (previousMessage.info.role === "assistant") {
              needsExtraSpacing = true
            }
          }

          // Check if this assistant message is completed
          let isCompletedAssistant = false
          if (message.info.role === "assistant") {
            const assistantMsg = message.info as any
            // Completed if it has completed timestamp
            if (assistantMsg.time?.completed && assistantMsg.time.completed > 0) {
              isCompletedAssistant = true
            }
          }

          // Show metadata for all completed assistant messages
          const shouldShowMetadata = isCompletedAssistant

          return (
            <MessageItem
              key={message.info.id}
              message={message}
              showThinkingBlocks={showThinkingBlocks}
              showToolDetails={showToolDetails}
              isQueued={isQueued}
              needsExtraSpacing={needsExtraSpacing}
              currentSessionId={currentSession?.id}
              isLastCompletedMessage={shouldShowMetadata}
            />
          )
        })}

        {/* No more separate generating indicator - handled by MessageItem */}
      </div>
    </div>
  )
}
