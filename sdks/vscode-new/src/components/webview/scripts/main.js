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

    // Add user message to chat
    addMessage('user', text, mode);

    // Clear input immediately
    messageInput.value = '';
    
    // Update send button state after clearing input
    updateSendButtonState();
    status.textContent = 'Sending...';

    // Show generating bubble or QUEUED status
    if (!isSessionLocked) {
        // First message - session is not locked, show "Generating..."
        const modelName = currentModel ? currentModel.textContent : 'Unknown';
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const generatingText = `Generating...\n${mode.charAt(0).toUpperCase() + mode.slice(1)} ${modelName} (${currentTime})`;
        
        currentStreamingMessage = addStreamingMessage('assistant', generatingText, mode, true); // Force scroll since user just sent a message
        currentMessageId = 'generating_' + Date.now();
        isSessionLocked = true; // Mark session as locked
    } else {
        // Session is locked - message will be queued, show "QUEUED" status
        addQueuedStatus();
    }

    // Send to extension
    vscode.postMessage({
        type: 'sendMessage',
        text: text,
        mode: mode
    });
}

// Add message to chat area
function addMessage(role, content, mode, forceScroll = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    headerDiv.textContent = role === 'user' ? 'You' : 'OpenCode';
    if (mode) {
        headerDiv.textContent += ` (${mode})`;
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    chatArea.appendChild(messageDiv);
    
    // Use force scroll for user messages, smart scroll for assistant messages
    if (forceScroll || role === 'user') {
        forceScrollToBottom();
    } else {
        smartScrollToBottom();
    }
}

// Smart scroll function - only scroll if user is at bottom
function smartScrollToBottom() {
    // Use requestAnimationFrame to ensure DOM updates are complete
    requestAnimationFrame(() => {
        const isAtBottom = chatArea.scrollTop + chatArea.clientHeight >= chatArea.scrollHeight - 50; // Increased buffer
        if (isAtBottom) {
            chatArea.scrollTop = chatArea.scrollHeight;
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
function addStreamingMessage(role, content, mode, forceScroll = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role} streaming`;
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    headerDiv.textContent = role === 'user' ? 'You' : 'OpenCode';
    if (mode) {
        headerDiv.textContent += ` (${mode})`;
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    chatArea.appendChild(messageDiv);
    
    // Use force scroll for specific cases, smart scroll for others
    if (forceScroll) {
        forceScrollToBottom();
    } else {
        smartScrollToBottom();
    }
    
    return messageDiv;
}

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
    
    // Request initial state and sessions
    vscode.postMessage({ type: 'getState' });
    vscode.postMessage({ type: 'getSessions' });
}

// Start initialization when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
