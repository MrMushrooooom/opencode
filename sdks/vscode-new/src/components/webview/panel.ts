import * as vscode from 'vscode'
import { OpenCodeApp } from '../../core/app'
import { Session } from '../../types/app'

/**
 * OpenCode Webview Panel
 * Manages the main UI interface
 */
export class OpenCodePanel {
  private app: OpenCodeApp
  private webview: vscode.WebviewPanel
  private outputChannel: vscode.OutputChannel
  private disposed: boolean = false

  constructor(app: OpenCodeApp, outputChannel: vscode.OutputChannel) {
    this.app = app
    this.outputChannel = outputChannel

    // Create webview panel
    this.webview = vscode.window.createWebviewPanel(
      'opencode-assistant',
      'OpenCode Assistant',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    )

    // Set initial HTML
    this.webview.webview.html = this.getHtmlForWebview()

    // Handle messages from webview
    this.webview.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      []
    )

    // Handle panel disposal
    this.webview.onDidDispose(() => {
      this.disposed = true
      // Clear the webview panel reference in app
      this.app.clearWebviewPanel()
    })

    // Set webview panel reference in app for streaming updates
    this.app.setWebviewPanel(this)
    
    // Initialize UI with current state (async)
    this.updateUI().catch(error => {
      this.outputChannel.appendLine(`❌ Failed to initialize UI: ${error.message}`)
    })
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'sendMessage':
          await this.handleSendMessage(message.text, message.mode)
          break
        case 'createSession':
          await this.handleCreateSession()
          break
        case 'switchSession':
          await this.handleSwitchSession(message.sessionId)
          break
        case 'getState':
          await this.handleGetState()
          break
        case 'getModels':
          await this.handleGetModels()
          break
        case 'getSessions':
          await this.handleGetSessions()
          break
        case 'switchModel':
          await this.handleSwitchModel(message.providerId, message.modelId)
          break
        case 'debug':
          // Only log errors and important debug info
          if (message.message.includes('ERROR') || message.message.includes('WARNING')) {
            this.outputChannel.appendLine(`🐛 [Frontend Debug] ${message.message}`)
          }
          break
        default:
          this.outputChannel.appendLine(`⚠️ Unknown message type: ${message.type}`)
      }
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Error handling message: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        message: error.message
      })
    }
  }

  /**
   * Handle send message request
   * Following TUI approach: send message and rely entirely on SSE for response
   */
  private async handleSendMessage(text: string, mode: 'plan' | 'build' = 'plan'): Promise<void> {
    try {
      // Get current state for generating message
      const state = this.app.getState()
      const currentModel = state.currentModel
      const timestamp = new Date().toLocaleTimeString()

      // Show loading state with mode, model, and timestamp
      this.sendMessageToWebview({
        type: 'messageSent',
        text: text,
        mode: mode,
        model: currentModel?.name || 'Unknown',
        timestamp: timestamp
      })

      // Send message to OpenCode (following TUI approach)
      // The actual response will come through SSE, not from this call
      await this.app.sendMessage(text, mode)

      // Update UI with current state
      await this.updateUI()

    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to send message: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        message: `Failed to send message: ${error.message}`
      })
    }
  }

  /**
   * Handle create session request
   */
  private async handleCreateSession(): Promise<void> {
    try {
      const session = await this.app.createNewSession()
      
      this.sendMessageToWebview({
        type: 'sessionCreated',
        session: session
      })

      await this.updateUI()
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to create session: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        message: `Failed to create session: ${error.message}`
      })
    }
  }

  /**
   * Handle switch session request
   */
  private async handleSwitchSession(sessionId: string): Promise<void> {
    try {
      await this.app.switchToSession(sessionId)
      
      this.sendMessageToWebview({
        type: 'sessionSwitched',
        sessionId: sessionId
      })

      await this.updateUI()
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to switch session: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        message: `Failed to switch session: ${error.message}`
      })
    }
  }

  /**
   * Handle get state request
   */
  private async handleGetState(): Promise<void> {
    try {
      const state = this.app.getState()
      this.sendMessageToWebview({
        type: 'stateUpdate',
        state: state
      })
      
      // Also send models information
      await this.handleGetModels()
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get state: ${error.message}`)
    }
  }

  /**
   * Update UI with current state
   */
  private async updateUI(): Promise<void> {
    try {
      const state = this.app.getState()
      
      this.sendMessageToWebview({
        type: 'stateUpdate',
        state: state
      })
      
      // If we have a current session, also load its messages
      if (state.currentSession) {
        const messages = await this.app.getMessageManager().getMessagesForSession(state.currentSession.id)
        this.sendMessageToWebview({
          type: 'messagesLoaded',
          messages: messages
        })
      }
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to update UI: ${error.message}`)
    }
  }

  /**
   * Handle get models request
   */
  private async handleGetModels(): Promise<void> {
    try {
      const models = this.app.getAvailableModels()
      const providers = this.app.getProviders()
      const recentlyUsed = this.app.getRecentlyUsedModels()
      
      // Mark recent models
      const modelsWithRecent = models.map(model => ({
        ...model,
        isRecent: recentlyUsed.some(recent => 
          recent.providerId === model.providerId && recent.modelId === model.id
        )
      }))
      
      this.sendMessageToWebview({
        type: 'modelsLoaded',
        models: modelsWithRecent
      })
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get models: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        message: `Failed to load models: ${error.message}`
      })
    }
  }

  /**
   * Handle get sessions request
   */
  private async handleGetSessions(): Promise<void> {
    try {
      const sessions = this.app.getSessions()
      
      this.sendMessageToWebview({
        type: 'sessionsUpdate',
        sessions: sessions
      })
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to get sessions: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        message: `Failed to load sessions: ${error.message}`
      })
    }
  }

  /**
   * Handle model switch request
   */
  private async handleSwitchModel(providerId: string, modelId: string): Promise<void> {
    try {
      await this.app.switchModel(providerId, modelId)
      
      const currentModel = this.app.getCurrentModel()
      this.sendMessageToWebview({
        type: 'modelSwitched',
        modelName: currentModel?.name || 'Unknown'
      })
      
      // Update UI with new state
      await this.updateUI()
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to switch model: ${error.message}`)
      this.sendMessageToWebview({
        type: 'error',
        message: `Failed to switch model: ${error.message}`
      })
    }
  }

  /**
   * Send message to webview
   */
  private sendMessageToWebview(message: any): void {
    this.webview.webview.postMessage(message)
  }

  /**
   * Send streaming update to webview
   */
  sendStreamingUpdate(messageId: string, content: string, partType: string, role?: string): void {
    this.sendMessageToWebview({
      type: 'streamingUpdate',
      messageId: messageId,
      content: content,
      partType: partType,
      role: role
    })
  }

  /**
   * Get HTML content for webview
   */
  private getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenCode Assistant</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        }
        
        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            padding: 20px;
            box-sizing: border-box;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            flex-shrink: 0;
        }
        
        .title {
            font-size: 18px;
            font-weight: bold;
        }
        
        .status {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .chat-area {
            flex: 1;
            overflow-y: auto;
            margin-bottom: 20px;
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background-color: var(--vscode-editor-background);
        }
        
        .message {
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 4px;
        }
        
        .message.user {
            background-color: var(--vscode-input-background);
            margin-left: 20px;
        }
        
        .message.assistant {
            background-color: var(--vscode-textBlockQuote-background);
            margin-right: 20px;
        }
        
        .message.streaming {
            border-left: 3px solid var(--vscode-textLink-foreground);
            animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .message-header {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 5px;
        }
        
        .message-content {
            white-space: pre-wrap;
        }
        
        .input-area {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-shrink: 0;
            margin-bottom: 10px;
        }
        
        .input-field {
            flex: 1;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        
        .mode-selector {
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        
        .send-button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .send-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .send-button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }
        
        .session-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            flex-shrink: 0;
            padding-top: 10px;
            border-top: 1px solid var(--vscode-panel-border);
            position: relative;
        }
        
        .model-selector, .session-selector {
            cursor: pointer;
            color: var(--vscode-textLink-foreground);
            text-decoration: underline;
        }
        
        .model-selector:hover, .session-selector:hover {
            color: var(--vscode-textLink-activeForeground);
        }
        
            .model-dropdown, .session-dropdown {
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                margin-bottom: 5px;
                background-color: var(--vscode-dropdown-background);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 4px;
                box-shadow: 0 -2px 8px rgba(0,0,0,0.1);
                z-index: 1000;
                max-height: 200px;
                overflow-y: auto;
                min-width: 200px;
            }
        
        .model-option, .session-option {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-dropdown-border);
        }
        
        .model-option:hover, .session-option:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .model-option:last-child, .session-option:last-child {
            border-bottom: none;
        }
        
        .session-separator {
            height: 1px;
            background-color: var(--vscode-dropdown-border);
            margin: 4px 0;
        }
        
        .session-type {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
            margin-left: 8px;
        }
        
        .new-session {
            font-style: italic;
            color: var(--vscode-textLink-foreground);
        }
        
        .model-provider {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-left: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">OpenCode Assistant</div>
            <div class="status" id="status">Ready</div>
        </div>
        
        <div class="chat-area" id="chatArea">
            <div class="message assistant">
                <div class="message-header">OpenCode</div>
                <div class="message-content">Hello! I'm OpenCode Assistant. How can I help you today?</div>
            </div>
        </div>
        
        <div class="input-area">
            <select class="mode-selector" id="modeSelector">
                <option value="plan">Plan Mode</option>
                <option value="build">Build Mode</option>
            </select>
            <input type="text" class="input-field" id="messageInput" placeholder="Enter your question..." />
            <button class="send-button" id="sendButton">Send</button>
        </div>
        
        <div class="session-info" id="sessionInfo">
            <span>Mode: <span id="currentMode">Plan</span></span>
            <span> | </span>
            <span>Model: <span id="currentModel" class="model-selector">Loading...</span></span>
            <span> | </span>
            <span>Session: <span id="currentSession" class="session-selector">Default</span></span>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const chatArea = document.getElementById('chatArea');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const modeSelector = document.getElementById('modeSelector');
        const status = document.getElementById('status');
        const sessionInfo = document.getElementById('sessionInfo');
        const currentModel = document.getElementById('currentModel');
        const currentMode = document.getElementById('currentMode');
        const currentSession = document.getElementById('currentSession');
        
        // Available sessions data
        let availableSessions = [];
        let currentSessionData = null;

        // Handle send button click
        sendButton.addEventListener('click', () => {
            const text = messageInput.value.trim();
            if (text) {
                sendMessage(text);
            }
        });

        // Handle Enter key
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = messageInput.value.trim();
                if (text) {
                    sendMessage(text);
                }
            }
        });

        function sendMessage(text) {
            const mode = modeSelector.value;

            // Add user message to chat
            addMessage('user', text, mode);

            // Clear input immediately
            messageInput.value = '';
            sendButton.disabled = true;
            status.textContent = 'Sending...';

            // Send to extension
            vscode.postMessage({
                type: 'sendMessage',
                text: text,
                mode: mode
            });
        }

        function addMessage(role, content, mode) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role}\`;
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'message-header';
            headerDiv.textContent = role === 'user' ? 'You' : 'OpenCode';
            if (mode) {
                headerDiv.textContent += \` (\${mode})\`;
            }
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = content;
            
            messageDiv.appendChild(headerDiv);
            messageDiv.appendChild(contentDiv);
            chatArea.appendChild(messageDiv);
            
            // Smart scroll - only scroll if user is at bottom
            smartScrollToBottom();
        }

        // Model selection functionality
        let availableModels = [];
        let currentModelData = null;
        let currentDropdownCloseHandler = null;
        let currentSessionCloseHandler = null;
        
        // Handle model selector click
        currentModel.addEventListener('click', (e) => {
            e.stopPropagation();
            // Toggle dropdown - if already open, close it; if closed, open it
            const existingDropdown = document.querySelector('.model-dropdown');
            if (existingDropdown) {
                closeModelDropdown();
            } else {
                showModelDropdown();
            }
        });
        
        // Handle session selector click
        currentSession.addEventListener('click', (e) => {
            e.stopPropagation();
            // Toggle dropdown - if already open, close it; if closed, open it
            const existingDropdown = document.querySelector('.session-dropdown');
            if (existingDropdown) {
                closeSessionDropdown();
            } else {
                showSessionDropdown();
            }
        });
        
        function showModelDropdown() {
            // Remove existing dropdown and its event listener
            closeModelDropdown();
            
            if (availableModels.length === 0) {
                // Request models from extension
                vscode.postMessage({ type: 'getModels' });
                return;
            }
            
            // Create dropdown
            const dropdown = document.createElement('div');
            dropdown.className = 'model-dropdown';
            
            // Append to session-info so it appears above the model selector
            sessionInfo.appendChild(dropdown);
            
            // Add recent models first
            const recentModels = availableModels.filter(m => m.isRecent);
            if (recentModels.length > 0) {
                const recentHeader = document.createElement('div');
                recentHeader.className = 'model-option';
                recentHeader.style.fontWeight = 'bold';
                recentHeader.textContent = 'Recent';
                dropdown.appendChild(recentHeader);
                
                recentModels.forEach(model => {
                    const option = createModelOption(model);
                    dropdown.appendChild(option);
                });
            }
            
            // Add all models grouped by provider
            const providers = [...new Set(availableModels.map(m => m.providerId))];
            providers.forEach(providerId => {
                const providerModels = availableModels.filter(m => m.providerId === providerId && !m.isRecent);
                if (providerModels.length > 0) {
                    const providerHeader = document.createElement('div');
                    providerHeader.className = 'model-option';
                    providerHeader.style.fontWeight = 'bold';
                    providerHeader.textContent = providerId.charAt(0).toUpperCase() + providerId.slice(1);
                    dropdown.appendChild(providerHeader);
                    
                    providerModels.forEach(model => {
                        const option = createModelOption(model);
                        dropdown.appendChild(option);
                    });
                }
            });
            
            // Position dropdown above the model selector
            const rect = currentModel.getBoundingClientRect();
            dropdown.style.position = 'fixed';
            dropdown.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
            dropdown.style.left = rect.left + 'px';
            
            document.body.appendChild(dropdown);
            
            // Create and store close handler
            currentDropdownCloseHandler = (e) => {
                // Don't close if clicking on the dropdown itself or the model selector
                if (dropdown.contains(e.target) || currentModel.contains(e.target)) {
                    return;
                }
                closeModelDropdown();
            };
            
            // Close dropdown when clicking outside
            setTimeout(() => {
                document.addEventListener('click', currentDropdownCloseHandler);
            }, 0);
        }
        
        function createModelOption(model) {
            const option = document.createElement('div');
            option.className = 'model-option';
            option.innerHTML = \`
                <span>\${model.name}</span>
                <span class="model-provider">\${model.providerId}</span>
            \`;
            
            option.addEventListener('click', () => {
                selectModel(model);
                closeModelDropdown();
            });
            
            return option;
        }
        
        function selectModel(model) {
            currentModelData = model;
            currentModel.textContent = model.name;
            
            // Send model switch request to extension
            vscode.postMessage({
                type: 'switchModel',
                providerId: model.providerId,
                modelId: model.id
            });
        }
        
        function showSessionDropdown() {
            // Remove existing dropdown and its event listener
            closeSessionDropdown();
            
            if (availableSessions.length === 0) {
                // Request sessions from extension
                vscode.postMessage({ type: 'getSessions' });
                return;
            }
            
            // Create dropdown
            const dropdown = document.createElement('div');
            dropdown.className = 'session-dropdown';
            
            // Add default session templates (like TUI)
            const defaultSessions = [
                { id: 'default', title: 'Getting Started with Claude Code', isDefault: true },
                { id: 'init-cli', title: 'Initializing Claude Code CLI', isDefault: true },
                { id: 'thread-title', title: 'Generating Thread Title', isDefault: true },
                { id: 'project-kickoff', title: 'Brainstorming Project Kickoff', isDefault: true },
                { id: 'cli-interaction', title: 'Exploring CLI Interaction', isDefault: true },
                { id: 'discussing-cli', title: 'Discussing CLI Interaction', isDefault: true }
            ];
            
            // Add default sessions
            const defaultHeader = document.createElement('div');
            defaultHeader.className = 'session-option';
            defaultHeader.style.fontWeight = 'bold';
            defaultHeader.textContent = 'Default Sessions';
            dropdown.appendChild(defaultHeader);
            
            defaultSessions.forEach(session => {
                const option = createSessionOption(session);
                dropdown.appendChild(option);
            });
            
            // Add separator
            const separator = document.createElement('div');
            separator.className = 'session-separator';
            dropdown.appendChild(separator);
            
            // Add user sessions
            if (availableSessions.length > 0) {
                const userHeader = document.createElement('div');
                userHeader.className = 'session-option';
                userHeader.style.fontWeight = 'bold';
                userHeader.textContent = 'Your Sessions';
                dropdown.appendChild(userHeader);
                
                availableSessions.forEach(session => {
                    const option = createSessionOption(session);
                    dropdown.appendChild(option);
                });
            }
            
            // Add new session option at the top
            const newSessionOption = document.createElement('div');
            newSessionOption.className = 'session-option new-session';
            newSessionOption.innerHTML = '<span>+ New Session</span>';
            newSessionOption.addEventListener('click', () => {
                createNewSession();
                closeSessionDropdown();
            });
            dropdown.insertBefore(newSessionOption, dropdown.firstChild);
            
            // Position dropdown above the session selector
            const rect = currentSession.getBoundingClientRect();
            dropdown.style.position = 'fixed';
            dropdown.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
            dropdown.style.left = rect.left + 'px';
            
            document.body.appendChild(dropdown);
            
            // Create and store close handler
            currentSessionCloseHandler = (e) => {
                // Don't close if clicking on the dropdown itself or the session selector
                if (dropdown.contains(e.target) || currentSession.contains(e.target)) {
                    return;
                }
                closeSessionDropdown();
            };
            
            // Close dropdown when clicking outside
            setTimeout(() => {
                document.addEventListener('click', currentSessionCloseHandler);
            }, 0);
        }
        
        function createSessionOption(session) {
            const option = document.createElement('div');
            option.className = 'session-option';
            option.innerHTML = \`
                <span>\${session.title}</span>
                \${session.isDefault ? '<span class="session-type">Default</span>' : ''}
            \`;
            
            option.addEventListener('click', () => {
                selectSession(session);
                closeSessionDropdown();
            });
            
            return option;
        }
        
        function selectSession(session) {
            currentSessionData = session;
            currentSession.textContent = session.title;
            
            // Send session switch request to extension
            vscode.postMessage({
                type: 'switchSession',
                sessionId: session.id
            });
        }
        
        function createNewSession() {
            // Send new session request to extension
            vscode.postMessage({
                type: 'createSession'
            });
        }
        
        function closeModelDropdown() {
            const dropdown = document.querySelector('.model-dropdown');
            if (dropdown) {
                dropdown.remove();
            }
            if (currentDropdownCloseHandler) {
                document.removeEventListener('click', currentDropdownCloseHandler);
                currentDropdownCloseHandler = null;
            }
        }
        
        function closeSessionDropdown() {
            const dropdown = document.querySelector('.session-dropdown');
            if (dropdown) {
                dropdown.remove();
            }
            if (currentSessionCloseHandler) {
                document.removeEventListener('click', currentSessionCloseHandler);
                currentSessionCloseHandler = null;
            }
        }

        // State variables for message handling
        let currentStreamingMessage = null;
        let currentMessageId = null;
        const processedMessageIds = new Set();
        let lastAssistantMessageId = null;
        let isSessionLocked = false; // Track if session is currently processing
        
        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            // Only log errors and warnings
            if (message.type === 'error') {
                vscode.postMessage({
                    type: 'debug',
                    message: 'ERROR: ' + message.message
                });
            }

            switch (message.type) {
                case 'messageSent':
                    // Message was sent, waiting for SSE response
                    status.textContent = 'Processing...';
                    
                    // Following TUI approach: only show "Generating..." if session is not locked
                    // If session is locked, the message will be queued on the server side
                    if (!isSessionLocked) {
                        // First message - session is not locked, show "Generating..."
                        const modelName = message.model || 'Unknown';
                        const mode = message.mode || 'plan';
                        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const generatingText = \`Generating...\n\${mode.charAt(0).toUpperCase() + mode.slice(1)} \${modelName} (\${currentTime})\`;
                        
                        currentStreamingMessage = addStreamingMessage('assistant', generatingText, mode);
                        currentMessageId = message.messageId;
                        isSessionLocked = true; // Mark session as locked
                    } else {
                        // Session is locked - message will be queued, show "QUEUED" status
                        addQueuedStatus();
                    }
                    break;
                    
                case 'streamingUpdate':
                    // Handle streaming updates
                    handleStreamingUpdate(message.messageId, message.content, message.partType, message.role);
                    break;
                    
                case 'error':
                    // Error occurred
                    addMessage('assistant', \`Error: \${message.message}\`, 'error');
                    sendButton.disabled = false;
                    status.textContent = 'Error';
                    break;
                    
                case 'stateUpdate':
                    // Update session info
                    const state = message.state;
                    currentMode.textContent = state.currentMode || 'Plan';
                    currentSession.textContent = state.currentSession?.title || 'Default';
                    currentSessionData = state.currentSession;
                    
                    // Update current model display
                    if (state.currentModel) {
                        currentModel.textContent = state.currentModel.name || 'Unknown';
                        currentModelData = state.currentModel;
                    } else {
                        currentModel.textContent = 'Loading...';
                    }
                    
                    // Update available models if provided
                    if (state.availableModels && state.availableModels.length > 0) {
                        availableModels = state.availableModels;
                    }
                    break;
                    
                case 'sessionsUpdate':
                    // Update available sessions
                    availableSessions = message.sessions || [];
                    break;
                    
                case 'modelsLoaded':
                    // Models loaded from extension
                    availableModels = message.models || [];
                    break;
                    
                case 'modelSwitched':
                    // Model was switched
                    currentModel.textContent = message.modelName || 'Unknown';
                    status.textContent = 'Model switched';
                    setTimeout(() => {
                        status.textContent = 'Ready';
                    }, 2000);
                    break;
                    
                case 'sessionCreated':
                    // New session was created - refresh sessions list
                    // Request updated sessions list
                    vscode.postMessage({ type: 'getSessions' });
                    status.textContent = 'New session created';
                    setTimeout(() => {
                        status.textContent = 'Ready';
                    }, 1000);
                    break;
                    
                case 'sessionSwitched':
                    // Session was switched - clear chat and show welcome message
                    chatArea.innerHTML = '';
                    addMessage('assistant', 'Hello! I\\'m OpenCode Assistant. How can I help you today?', 'plan');
                    status.textContent = 'Session switched';
                    setTimeout(() => {
                        status.textContent = 'Ready';
                    }, 2000);
                    break;
                    
                case 'messagesLoaded':
                    // Load messages for the current session
                    chatArea.innerHTML = '';
                    const messages = message.messages;
                    if (messages && messages.length > 0) {
                        // Display existing messages and find last assistant message ID
                        messages.forEach(msg => {
                            if (msg.role === 'user') {
                                addMessage('user', msg.content || msg.text || '', modeSelector.value);
                            } else if (msg.role === 'assistant') {
                                addMessage('assistant', msg.content || msg.text || '', modeSelector.value);
                                // Update lastAssistantMessageId for queue detection
                                if (msg.id) {
                                    lastAssistantMessageId = msg.id;
                                }
                            }
                        });
                    } else {
                        // No messages, show welcome message
                        addMessage('assistant', 'Hello! I\\'m OpenCode Assistant. How can I help you today?', 'plan');
                    }
                    // Reset session lock state when loading messages
                    isSessionLocked = false;
                    status.textContent = 'Messages loaded';
                    setTimeout(() => {
                        status.textContent = 'Ready';
                    }, 1000);
                    break;
            }
        });

        // Smart scrolling state - following TUI approach
        let isAtBottom = true; // Track if user is at bottom of chat
        let userScrolled = false; // Track if user manually scrolled
        
        // Track scroll position to detect user scrolling
        chatArea.addEventListener('scroll', () => {
            const isCurrentlyAtBottom = chatArea.scrollTop + chatArea.clientHeight >= chatArea.scrollHeight - 5;
            isAtBottom = isCurrentlyAtBottom;
            userScrolled = !isCurrentlyAtBottom;
        });
        
        // Smart scroll function - only scroll if user is at bottom
        function smartScrollToBottom() {
            if (isAtBottom) {
                chatArea.scrollTop = chatArea.scrollHeight;
            }
        }
        
        function handleStreamingUpdate(messageId, content, partType, role) {
            // Following TUI approach: ignore user message updates (they're already displayed)
            if (role === 'user') {
                return;
            }
            
            if (partType === 'text') {
                // Following TUI approach: update the existing "Generating..." message with actual content
                if (currentStreamingMessage) {
                    // Replace "Generating..." content with actual LLM response
                    updateStreamingMessage(currentStreamingMessage, content);
                    currentMessageId = messageId; // Update to real message ID from server
                    
                    // Remove streaming indicator only when we have actual content (not "Generating...")
                    if (content && !content.includes('Generating...')) {
                        finalizeStreamingMessage(currentStreamingMessage);
                    }
                } else {
                    // This shouldn't happen with our current logic, but handle it gracefully
                    currentStreamingMessage = addStreamingMessage('assistant', content, modeSelector.value);
                    currentMessageId = messageId;
                }
            } else if (partType === 'step-finish') {
                // Streaming complete - Following TUI approach
                // The server processes all queued messages and returns a single unified response
                if (currentStreamingMessage) {
                    // Only finalize if we haven't already done so
                    if (currentStreamingMessage.classList.contains('streaming')) {
                        finalizeStreamingMessage(currentStreamingMessage);
                    }
                    
                    // Update lastAssistantMessageId to the completed message
                    lastAssistantMessageId = messageId;
                    
                    // Check if there are queued messages that need processing BEFORE clearing them
                    const queuedTags = document.querySelectorAll('.queued-tag');
                    const hasQueuedMessages = queuedTags.length > 0;
                    
                    // Clear all QUEUED tags since they all get the same response
                    queuedTags.forEach(tag => tag.remove());
                    
                    if (hasQueuedMessages) {
                        // Following TUI approach: create new "Generating..." bubble for queued messages
                        const modelName = 'Unknown'; // We don't have model info here, use default
                        const mode = modeSelector.value || 'plan';
                        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const generatingText = \`Generating...\n\${mode.charAt(0).toUpperCase() + mode.slice(1)} \${modelName} (\${currentTime})\`;
                        
                        currentStreamingMessage = addStreamingMessage('assistant', generatingText, mode);
                        currentMessageId = 'generating_' + Date.now();
                        isSessionLocked = true; // Keep session locked for queued processing
                    } else {
                        // No queued messages - unlock session
                        isSessionLocked = false;
                        sendButton.disabled = false;
                        status.textContent = 'Ready';
                    }
                    
                    processedMessageIds.add(messageId);
                    
                    // Only reset currentStreamingMessage if there are no queued messages
                    if (!hasQueuedMessages) {
                        currentStreamingMessage = null;
                        currentMessageId = null;
                    }
                }
            }
        }
        
        function addStreamingMessage(role, content, mode) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role} streaming\`;

            const headerDiv = document.createElement('div');
            headerDiv.className = 'message-header';
            headerDiv.textContent = role === 'user' ? 'You' : 'OpenCode';
            if (mode) {
                headerDiv.textContent += \` (\${mode})\`;
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = content;

            messageDiv.appendChild(headerDiv);
            messageDiv.appendChild(contentDiv);
            chatArea.appendChild(messageDiv);

            // Smart scroll - only scroll if user is at bottom
            smartScrollToBottom();

            return messageDiv;
        }
        
        function addQueuedStatus() {
            // Add QUEUED status indicator inside the last user message bubble
            const userMessages = chatArea.querySelectorAll('.message.user');
            if (userMessages.length > 0) {
                const lastUserMessage = userMessages[userMessages.length - 1];
                const contentDiv = lastUserMessage.querySelector('.message-content');
                if (contentDiv) {
                    // Create QUEUED tag
                    const queuedTag = document.createElement('div');
                    queuedTag.className = 'queued-tag';
                    queuedTag.style.cssText = \`
                        margin: 4px 0 8px 0;
                        padding: 2px 6px;
                        font-size: 10px;
                        font-weight: bold;
                        color: white;
                        background-color: #ff8c00;
                        text-align: center;
                        border-radius: 3px;
                        opacity: 0.9;
                        display: inline-block;
                    \`;
                    queuedTag.textContent = 'QUEUED';
                    
                    // Insert QUEUED tag at the top of the message content
                    contentDiv.insertBefore(queuedTag, contentDiv.firstChild);
                }
            }
            smartScrollToBottom();
        }
        
        function updateStreamingMessage(messageDiv, content) {
            const contentDiv = messageDiv.querySelector('.message-content');
            if (contentDiv) {
                contentDiv.textContent = content;
                // Smart scroll - only scroll if user is at bottom
                smartScrollToBottom();
            }
        }
        
        function finalizeStreamingMessage(messageDiv) {
            messageDiv.classList.remove('streaming');
        }

        // Request initial state and sessions
        vscode.postMessage({ type: 'getState' });
        vscode.postMessage({ type: 'getSessions' });
    </script>
</body>
</html>`;
  }

  /**
   * Check if the panel is disposed
   */
  isDisposed(): boolean {
    return this.disposed
  }

  /**
   * Show the panel
   */
  show(): void {
    if (this.disposed) {
      throw new Error('Webview is disposed')
    }
    // this.outputChannel.appendLine('👁️ Revealing OpenCode panel') // Removed
    this.webview.reveal()
  }

  /**
   * Dispose of the panel
   */
  dispose(): void {
    if (!this.disposed) {
      this.disposed = true
      this.webview.dispose()
    }
  }
}
