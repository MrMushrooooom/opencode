# OpenCode VS Code Extension (Beta)

A Visual Studio Code extension that integrates [opencode](https://opencode.ai) directly into your development workflow with an enhanced chat interface.

> **Note**: This is a Beta release. We're actively improving the extension based on user feedback.

## Prerequisites

This extension requires the [opencode CLI](https://opencode.ai) to be installed on your system. Visit [opencode.ai](https://opencode.ai) for installation instructions.

## Features

- **Chat Interface**: Interactive chat panel in the sidebar for seamless AI assistance
- **Quick Launch**: Use `Cmd+Shift+Esc` (Mac) or `Ctrl+Esc` (Windows/Linux) to open the OpenCode panel
- **Session Management**: Create and switch between multiple conversation sessions
- **Model Selection**: Choose from available AI models and providers
- **Tool Integration**: View and interact with tool executions including file operations, web fetching, and task management
- **Build Mode**: Track file changes as they are automatically applied
- **Image Support**: Upload images directly in conversations

## Support

This is a Beta release. We're actively working on improvements and new features. If you encounter issues or have feedback, please create an issue at https://github.com/sst/opencode/issues.

## Development

1. `code sdks/vscode-v2` - Open the `sdks/vscode-v2` directory in VS Code. **Do not open from repo root.**
2. `bun install` - Run inside the `sdks/vscode-v2` directory.
3. Press `F5` to start debugging - This launches a new VS Code window with the extension loaded.
