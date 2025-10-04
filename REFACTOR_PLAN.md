# OpenCode VSCode Extension V2

## 🎯 重构目标

这是OpenCode VSCode扩展的V2版本，基于TUI的成熟架构进行完全重构。

## 📋 重构计划

### Phase 1: 消息渲染系统重构
- [ ] 移植TUI的`Message`结构（`Info` + `Parts`）
- [ ] 实现TUI的`renderText`、`renderToolDetails`函数
- [ ] 对齐TUI的消息显示逻辑

### Phase 2: 工具调用系统重构  
- [ ] 移植TUI的工具显示机制
- [ ] 实现TUI的权限管理系统
- [ ] 对齐TUI的工具执行流程

### Phase 3: 状态管理重构
- [ ] 实现TUI的`HasAnimatingWork`、`IsBusy`逻辑
- [ ] 移植TUI的会话状态管理
- [ ] 对齐TUI的事件处理流程

### Phase 4: 用户体验优化
- [ ] 实现TUI的撤销/重做功能
- [ ] 移植TUI的代码对比显示
- [ ] 对齐TUI的交互体验

## 🔧 技术架构

### 核心组件
- **MessageRenderer**: 基于TUI的消息渲染引擎
- **ToolManager**: 基于TUI的工具调用管理
- **StateManager**: 基于TUI的状态管理
- **EventProcessor**: 基于TUI的事件处理

### 与TUI对齐
- ✅ 消息模型完全一致
- ✅ 渲染逻辑完全一致  
- ✅ 状态管理完全一致
- ✅ 事件处理完全一致

## 📁 目录结构

```
src/
├── core/           # 核心业务逻辑
├── components/     # UI组件
├── services/       # 服务层
├── types/          # 类型定义
└── utils/          # 工具函数
```

## 🚀 开发指南

1. **参考TUI实现**: 所有功能都基于TUI的成熟实现
2. **保持架构一致**: 确保与TUI的架构完全对齐
3. **渐进式重构**: 按Phase逐步完成重构
4. **充分测试**: 每个Phase完成后进行完整测试

## 📝 开发日志

- **2024-10-04**: 创建vscode-v2项目，开始Phase 1重构
