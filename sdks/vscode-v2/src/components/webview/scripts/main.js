// Main JavaScript for OpenCode Assistant WebView

// VSCode API
const vscode = acquireVsCodeApi();

// DOM elements
const chatArea = document.getElementById('chatArea');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const modeSelector = document.getElementById('modeSelector');
const status = document.getElementById('status');
const sessionInfo = document.getElementById('sessionInfo');
const currentModel = document.getElementById('currentModel');
const currentMode = document.getElementById('currentMode');
const currentSession = document.getElementById('currentSession');

// Global state
let availableSessions = [];
let currentSessionData = null;
let currentStreamingMessage = null;
let currentMessageId = null;
let isSessionLocked = false;
let showThinkingBlocks = false; // Default to false, following TUI
let lastAssistantMessageId = null;

// Initialize event listeners
function initializeEventListeners() {
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

    // Handle input changes to enable/disable send button
    messageInput.addEventListener('input', () => {
        updateSendButtonState();
    });

    // Handle paste events
    messageInput.addEventListener('paste', () => {
        // Use setTimeout to ensure paste content is processed
        setTimeout(updateSendButtonState, 0);
    });

    // Handle mode selector change
    modeSelector.addEventListener('change', () => {
        updateBuildModeUI();
        // Update the status bar to reflect the current mode
        const currentMode = document.getElementById('currentMode');
        if (currentMode) {
            currentMode.textContent = modeSelector.value === 'build' ? 'Build' : 'Plan';
        }
    });

    // Initialize dropdown functionality - will be called from init.js after all scripts are loaded
    
    // Initialize send button state
    updateSendButtonState();
}

// Update send button state based on input content
function updateSendButtonState() {
    const hasContent = messageInput.value.trim().length > 0;
    sendButton.disabled = !hasContent;
    
    // Update button appearance
    if (hasContent) {
        sendButton.style.opacity = '1';
        sendButton.style.cursor = 'pointer';
    } else {
        sendButton.style.opacity = '0.5';
        sendButton.style.cursor = 'not-allowed';
    }
}

// Send message function
function sendMessage(text) {
    const mode = modeSelector.value;

    // Handle TUI-style commands
    if (text.startsWith('/')) {
        const command = text.substring(1).toLowerCase();
        if (command === 'undo') {
            handleUndoCommand();
            return;
        } else if (command === 'redo') {
            handleRedoCommand();
            return;
        }
    }

    // Following TUI approach: create user message immediately
    // This ensures correct chronological order
    const userMessageDiv = addMessage('user', text, mode, true);
    vscode.postMessage({ type: 'debug', message: `👤 Created user message immediately: "${text}"` });

    // Clear input immediately
    messageInput.value = '';
    
    // Update send button state after clearing input
    updateSendButtonState();
    status.textContent = 'Sending...';

    // Following TUI approach: don't create any status messages locally
    // Let the server create assistant messages via EventMessageUpdated
    // and handle status display during rendering
    vscode.postMessage({ type: 'debug', message: `🔍 sendMessage: isSessionLocked=${isSessionLocked}, currentStreamingMessage=${currentStreamingMessage ? 'exists' : 'null'}` });
    
    if (!isSessionLocked) {
        isSessionLocked = true; // Mark session as locked
        vscode.postMessage({ type: 'debug', message: `🔒 Session locked for first message` });
    } else {
        vscode.postMessage({ type: 'debug', message: `⚠️ Session already locked - this message will be queued` });
    }

    // Send to extension
    vscode.postMessage({ type: 'debug', message: `📤 Sending message to extension: "${text}" (mode: ${mode})` });
    vscode.postMessage({
        type: 'sendMessage',
        text: text,
        mode: mode
    });
}

// Simple Markdown renderer for basic formatting
function renderMarkdown(text) {
    if (!text) return '';
    
    // Escape HTML first
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // Bold text: **text** -> <strong>text</strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Code blocks: ```\ncode\n``` -> <pre><code>code</code></pre>
    html = html.replace(/```\n([\s\S]*?)\n```/g, '<pre><code>$1</code></pre>');
    
    // Inline code: `code` -> <code>code</code>
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Line breaks: \n -> <br>
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

// Message structure following TUI's approach - message.Parts array
let messageParts = new Map(); // messageId -> parts array

// Add message to chat area - Following TUI's message structure
function addMessage(role, content, mode, forceScroll = false, messageId = null, messageModel = null, messageTimestamp = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    // Use provided messageId or generate one using TUI's algorithm
    // Frontend should not generate IDs - they come from the backend
    const finalMessageId = messageId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    messageDiv.setAttribute('data-message-id', finalMessageId);
    
    // CRITICAL FIX: Store timestamp for QUEUED logic
    const timestamp = messageTimestamp || Date.now();
    messageDiv.setAttribute('data-timestamp', timestamp.toString());
    
    messageParts.set(finalMessageId, []);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // For user messages, set content directly (not using parts structure)
    if (content) {
        if (role === 'user') {
            contentDiv.innerHTML = renderMarkdown(content);
        } else {
            // For assistant messages, create text part directly
            const textPartDiv = document.createElement('div');
            textPartDiv.className = 'message-part text-part';
            textPartDiv.setAttribute('data-part-id', `text_${Date.now()}`);
            textPartDiv.innerHTML = renderMarkdown(content);
            contentDiv.appendChild(textPartDiv);
            
            // Track this part in messageParts
            if (finalMessageId && window.messageParts) {
                const parts = window.messageParts.get(finalMessageId) || [];
                parts.push({
                    type: 'text',
                    id: textPartDiv.getAttribute('data-part-id'),
                    content: content
                });
                window.messageParts.set(finalMessageId, parts);
            }
        }
    } else if (role === 'assistant') {
        // Following TUI approach: if assistant message has no content, show "Generating..."
        // TUI shows "Generating..." for empty assistant messages (line 664-682 in messages.go)
        if (content) {
            // CRITICAL FIX: Check for tool-only messages
            if (content === '[TOOL_CALLS_ONLY]') {
                // This is a tool-only message - don't show "Generating..." 
                // The tool parts will be loaded separately via SSE events
                vscode.postMessage({ type: 'debug', message: `🔧 Tool-only message detected: ${finalMessageId}` });
            } else {
                // For assistant messages with text content, create text part directly
                const textPartDiv = document.createElement('div');
                textPartDiv.className = 'message-part text-part';
                textPartDiv.setAttribute('data-part-id', `text_${Date.now()}`);
                textPartDiv.innerHTML = renderMarkdown(content);
                contentDiv.appendChild(textPartDiv);
                
                // Track this part in messageParts
                if (finalMessageId && window.messageParts) {
                    const parts = window.messageParts.get(finalMessageId) || [];
                    parts.push({
                        type: 'text',
                        id: textPartDiv.getAttribute('data-part-id'),
                        content: content
                    });
                    window.messageParts.set(finalMessageId, parts);
                }
            }
        } else {
            // Following TUI approach: show "Generating..." for empty assistant messages
            const generatingPartDiv = document.createElement('div');
            generatingPartDiv.className = 'message-part text-part generating-part';
            generatingPartDiv.setAttribute('data-part-id', `generating_${Date.now()}`);
            generatingPartDiv.innerHTML = '<span class="generating-label">Generating...</span>';
            contentDiv.appendChild(generatingPartDiv);
            
            // Track this part in messageParts
            if (finalMessageId && window.messageParts) {
                const parts = window.messageParts.get(finalMessageId) || [];
                parts.push({
                    type: 'generating',
                    id: generatingPartDiv.getAttribute('data-part-id'),
                    content: 'Generating...'
                });
                window.messageParts.set(finalMessageId, parts);
            }
        }
    }
    
    // Add metadata at the bottom - TUI style
    const metadataDiv = document.createElement('div');
    metadataDiv.className = 'message-metadata';
    
    if (role === 'user') {
        // User message metadata: username + time
        const username = 'jack'; // Could be dynamic
        const time = messageTimestamp ? new Date(messageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        metadataDiv.textContent = `${username} (${time})`;
    } else {
        // Assistant message metadata: mode + model + time
        const modeText = mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : 'Plan';
        // Always use technical model ID for consistency with TUI
        // For historical messages: use server's modelID
        // For new messages: use current model's ID (technical ID)
        const modelName = messageModel || (window.currentModelData ? window.currentModelData.id : 'Loading...');
        const time = messageTimestamp ? new Date(messageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        metadataDiv.textContent = `${modeText} ${modelName} (${time})`;
        
        // CRITICAL FIX: Hide metadata by default for new assistant messages
        // Following TUI approach: metadata only shows when message is completed
        metadataDiv.style.display = 'none';
    }
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(metadataDiv);
    chatArea.appendChild(messageDiv);
    
    // Use force scroll for user messages, smart scroll for assistant messages
    if (forceScroll || role === 'user') {
        forceScrollToBottom();
    } else {
        smartScrollToBottom();
    }
    
    // TUI approach: Check QUEUED status for user messages
    if (role === 'user' && window.addQueuedStatusToMessage) {
        // Use setTimeout to ensure DOM is fully rendered before checking QUEUED status
        setTimeout(() => {
            window.addQueuedStatusToMessage(messageDiv);
        }, 0);
    }
    
    return messageDiv;
}

// Smart scroll function - only scroll if user is at bottom
function smartScrollToBottom() {
    // Use requestAnimationFrame to ensure DOM updates are complete
    requestAnimationFrame(() => {
        const scrollTop = chatArea.scrollTop;
        const scrollHeight = chatArea.scrollHeight;
        const clientHeight = chatArea.clientHeight;
        
        // More generous buffer for detecting "at bottom" - 100px instead of 50px
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100;
        
        if (isAtBottom) {
            // Smooth scroll to bottom
            chatArea.scrollTo({
                top: scrollHeight,
                behavior: 'smooth'
            });
        }
    });
}

// Force scroll to bottom - used when opening a new chat
function forceScrollToBottom() {
    // Use requestAnimationFrame to ensure DOM updates are complete
    requestAnimationFrame(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
    });
}

// Add streaming message
// Finalize streaming message
function finalizeStreamingMessage(messageDiv) {
    messageDiv.classList.remove('streaming');
}

// Handle undo command
function handleUndoCommand() {
    console.log('Handling /undo command');
    vscode.postMessage({
        type: 'undoToMessage'
    });
}

// Handle redo command
function handleRedoCommand() {
    console.log('Handling /redo command');
    vscode.postMessage({
        type: 'redoChanges'
    });
}

// Update build mode UI
function updateBuildModeUI() {
    const isBuildMode = modeSelector.value === 'build';
    console.log('updateBuildModeUI called, isBuildMode:', isBuildMode);
    
    const buildControls = document.getElementById('buildControls');
    const fileChanges = document.getElementById('fileChanges');
    
    if (buildControls && fileChanges) {
        if (isBuildMode) {
            buildControls.classList.add('active');
            fileChanges.classList.add('active');
            console.log('Added active class to build controls');
        } else {
            buildControls.classList.remove('active');
            fileChanges.classList.remove('active');
            console.log('Removed active class from build controls');
        }
    }
}

// Initialize the application
function initialize() {
    console.log('Initializing OpenCode WebView...');
    initializeEventListeners();
    updateBuildModeUI();
    
    // Request initial state, models and sessions
    vscode.postMessage({ type: 'getState' });
    vscode.postMessage({ type: 'getModels' });
    vscode.postMessage({ type: 'getSessions' });
}

// Start initialization when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
