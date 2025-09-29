# OpenCode VSCode Extension Architecture

## 📁 **项目结构**

```
src/
├── core/                    # 核心业务逻辑层
│   ├── api.ts              # OpenCode API 客户端 (类似 TUI 的 internal/api)
│   ├── app.ts              # 应用主控制器 (类似 TUI 的 internal/app)
│   ├── config.ts           # 配置管理 (新增)
│   ├── message.ts          # 消息管理 (类似 TUI 的 components/chat)
│   ├── network.ts          # 网络管理 (新增)
│   └── session.ts          # 会话管理
├── services/               # 服务层
│   └── server.ts           # OpenCode 服务器管理
├── components/             # UI 组件层
│   └── webview/            # Webview 面板组件
├── types/                  # 类型定义
└── utils/                  # 工具函数
```

## 🏗️ **架构设计原则**

### 1. **分层架构**
- **Core Layer**: 核心业务逻辑，不依赖 VSCode API
- **Services Layer**: 外部服务集成 (OpenCode Server)
- **Components Layer**: VSCode 特定的 UI 组件
- **Types Layer**: 共享类型定义

### 2. **单一职责**
- `OpenCodeAPI`: 纯 API 通信，无业务逻辑
- `ConfigManager`: 配置加载和转换
- `NetworkManager`: 网络连接测试
- `MessageManager`: 消息处理
- `SessionManager`: 会话管理
- `ServerManager`: 服务器生命周期

### 3. **依赖注入**
- 所有组件通过构造函数注入依赖
- 便于测试和模块化

## 🔧 **核心组件说明**

### **OpenCodeAPI** (`core/api.ts`)
```typescript
// 纯 API 客户端，类似 TUI 的 internal/api
class OpenCodeAPI {
  async createSession(): Promise<Session>
  async getSessionMessages(sessionId: string): Promise<Message[]>
  async sendPrompt(sessionId: string, params: any): Promise<Response>
  async getConfig(): Promise<Config>
}
```

### **ConfigManager** (`core/config.ts`)
```typescript
// 配置管理，支持代理设置
class ConfigManager {
  async loadOpenCodeConfig(): Promise<Config>
  getProxyConfiguration(): ProxyConfig | null  // 可轻松禁用
  async testNetworkConnectivity(proxyEnv: ProxyConfig): Promise<void>
}
```

### **NetworkManager** (`core/network.ts`)
```typescript
// 网络连接测试
class NetworkManager {
  async getPluginExternalIP(): Promise<string>
  async testServerHealth(serverURL: string): Promise<boolean>
  async testAnthropicAPI(): Promise<boolean>
  checkProxyEnvironment(): ProxyStatus
}
```

### **MessageManager** (`core/message.ts`)
```typescript
// 消息处理，使用 SDK 的持久化存储
class MessageManager {
  async getMessagesForSession(sessionId: string): Promise<Message[]>
  async sendMessage(params: PromptParams): Promise<PromptResponse>
  private async buildConversationHistory(sessionId: string): Promise<Context[]>
}
```

### **SessionManager** (`core/session.ts`)
```typescript
// 会话管理
class SessionManager {
  async loadSessions(): Promise<Session[]>
  async createSession(): Promise<Session>
  getSessionById(sessionId: string): Session | null
  updateSession(sessionId: string, updates: Partial<Session>): void
}
```

### **ServerManager** (`services/server.ts`)
```typescript
// 服务器生命周期管理
class ServerManager {
  async startServer(): Promise<string>
  async stopServer(): Promise<void>
  getServerPort(): number | null
  isServerRunning(): boolean
}
```

## 🌐 **代理配置管理**

### **可配置的代理设置**
```typescript
// ConfigManager.getProxyConfiguration()
// 发布时只需注释掉这个方法即可禁用代理
getProxyConfiguration(): Record<string, string> | null {
  // TODO: Comment out this method when releasing to international users
  return {
    HTTP_PROXY: 'http://127.0.0.1:1087',
    HTTPS_PROXY: 'http://127.0.0.1:1087',
    // ...
  }
  
  // For international users, return null (no proxy needed)
  // return null
}
```

## 🔄 **数据流**

```
User Input → Webview → OpenCodeApp → MessageManager → OpenCodeAPI → OpenCode Server
                ↓
OpenCode Server → OpenCodeAPI → MessageManager → OpenCodeApp → Webview → User
```

## 📊 **与 TUI 的对比**

| 组件 | TUI | VSCode Extension |
|------|-----|------------------|
| API Client | `internal/api` | `core/api.ts` |
| App Controller | `internal/app` | `core/app.ts` |
| Message Handling | `components/chat` | `core/message.ts` |
| Session Management | Built-in | `core/session.ts` |
| Configuration | Built-in | `core/config.ts` |
| Network Testing | Built-in | `core/network.ts` |

## ✅ **优势**

1. **模块化**: 每个组件职责单一，易于维护
2. **可测试**: 依赖注入便于单元测试
3. **可扩展**: 新功能可以独立添加
4. **国际化友好**: 代理配置可轻松禁用
5. **与 TUI 一致**: 使用相同的 OpenCode SDK API
6. **持久化**: 使用 OpenCode 服务器的存储机制

## 🚀 **使用方式**

```typescript
// 初始化应用
const app = new OpenCodeApp(outputChannel)
await app.initialize()

// 发送消息
const response = await app.sendMessage("Hello", "plan")

// 获取会话消息
const messages = await app.getCurrentSessionMessages()
```
