import React from "react"
import ReactDOM from "react-dom/client"
import { ConfigProvider, theme } from "antd"
import { App } from "./App"
import "./index.css"

/**
 * Application entry point
 * Initializes React application with Ant Design theme
 */
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement)

root.render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorBgBase: "#1e1e1e",
          colorBgContainer: "#252526",
          colorBorder: "#3e3e42",
          colorText: "#cccccc",
          colorTextSecondary: "#888888",
          colorPrimary: "#1890ff",
          borderRadius: 6,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)
