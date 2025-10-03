// Chat functionality and message handling

// Handle messages from the extension
window.addEventListener('message', (event) => {
    const message = event.data;
    
    switch (message.type) {
        case 'streamingUpdate':
            handleStreamingUpdate(message);
            break;
            
        case 'streamingComplete':
            handleStreamingComplete(message);
            break;
            
        case 'permissionRequest':
            showPermissionDialog(message.permission);
            break;
            
        case 'permissionResponseSuccess':
            hidePermissionDialog();
            break;
            
        case 'undoSuccess':
            handleUndoSuccess(message);
            break;
            
        case 'redoSuccess':
            handleRedoSuccess(message);
            break;
            
        case 'stateUpdate':
            handleStateUpdate(message.state);
            break;
            
        case 'sessionsUpdate':
            handleSessionsUpdate(message.sessions);
            break;
            
        case 'modelsUpdate':
            handleModelsUpdate(message.models);
            break;
            
        case 'modelSwitched':
            vscode.postMessage({ type: 'debug', message: `📡 Received modelSwitched message: ${message.providerId}/${message.modelId}` });
            handleModelSwitched(message.providerId, message.modelId);
            break;
            
        case 'switchSession':
            handleSessionSwitch(message.sessionId);
            break;
            
        case 'createSession':
            handleCreateSession(message.session);
            break;
            
        case 'sessionCreated':
            vscode.postMessage({ type: 'debug', message: `📡 Received sessionCreated message: ${message.session.id}` });
            handleSessionCreated(message.session);
            break;
            
        case 'sessionSwitched':
            vscode.postMessage({ type: 'debug', message: `📡 Received sessionSwitched message: ${message.sessionId}` });
            handleSessionSwitched(message.sessionId, message.messages);
            break;
            
        case 'sessionDeleteSuccess':
            vscode.postMessage({ type: 'debug', message: `📡 Received sessionDeleteSuccess message: ${message.sessionId}` });
            handleSessionDeleteSuccess(message.sessionId);
            break;
            
        case 'sessionUpdated':
            handleSessionUpdated(message.session);
            break;
            
        case 'messagesLoaded':
            vscode.postMessage({ type: 'debug', message: `📡 Received messagesLoaded message: ${message.messages.length} messages` });
            handleMessagesLoaded(message.messages);
            break;
            
        case 'error':
            handleError(message.error);
            break;
            
        case 'debug':
            if (message.message.includes('ERROR') || message.message.includes('WARNING')) {
                console.error('OpenCode Debug:', message.message);
            }
            break;
            
        default:
            console.log('Unknown message type:', message.type);
    }
});

// Handle streaming update
function handleStreamingUpdate(message) {
    const { messageId, content, partType, role } = message;
    
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
            currentStreamingMessage = addStreamingMessage('assistant', content, modeSelector.value, false); // Don't force scroll
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
        }
        
        // Check if there are queued messages that need processing BEFORE clearing them
        const queuedTags = document.querySelectorAll('.queued-tag');
        const hasQueuedMessages = queuedTags.length > 0;
        
        // Clear all QUEUED tags since they all get the same response
        queuedTags.forEach(tag => tag.remove());
        
        if (hasQueuedMessages) {
            // Following TUI approach: create new "Generating..." bubble for queued messages
            const modelName = currentModel ? currentModel.textContent : 'Unknown';
            const mode = modeSelector.value || 'plan';
            const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const generatingText = `Generating...\n${mode.charAt(0).toUpperCase() + mode.slice(1)} ${modelName} (${currentTime})`;
            
            currentStreamingMessage = addStreamingMessage('assistant', generatingText, mode, false); // Don't force scroll for queued messages
            currentMessageId = 'generating_' + Date.now();
            isSessionLocked = true; // Keep session locked for queued processing
        } else {
            // No queued messages - unlock session
            isSessionLocked = false;
            status.textContent = 'Ready';
        }
    }
}

// Update streaming message content
function updateStreamingMessage(messageDiv, content) {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
        contentDiv.textContent = content;
        // Smart scroll - only scroll if user is at bottom
        smartScrollToBottom();
    }
}


// Handle streaming complete
function handleStreamingComplete(message) {
    if (currentStreamingMessage) {
        finalizeStreamingMessage(currentStreamingMessage);
        currentStreamingMessage = null;
        currentMessageId = null;
    }
    
    // Unlock session
    isSessionLocked = false;
    status.textContent = 'Ready';
}

// Add QUEUED status indicator
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
            queuedTag.style.cssText = `
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
            `;
            queuedTag.textContent = 'QUEUED';
            
            // Insert QUEUED tag at the top of the message content
            contentDiv.insertBefore(queuedTag, contentDiv.firstChild);
        }
    }
}

// Handle undo success
function handleUndoSuccess(message) {
    status.textContent = 'Undo completed';
    setTimeout(() => {
        status.textContent = 'Ready';
    }, 2000);
    
    // Show revert status like TUI
    if (message.revertInfo) {
        showRevertStatus(message.revertInfo);
    }
    
    // Pre-fill input with last user message (TUI behavior)
    if (message.lastUserMessage) {
        messageInput.value = message.lastUserMessage;
        // Update send button state after pre-filling
        updateSendButtonState();
    }
}

// Handle redo success
function handleRedoSuccess(message) {
    status.textContent = 'Redo completed';
    setTimeout(() => {
        status.textContent = 'Ready';
    }, 2000);
}

// Handle state update
function handleStateUpdate(state) {
    if (state.currentMode && currentMode) {
        currentMode.textContent = state.currentMode;
    }
    
    if (state.currentModel && currentModel) {
        currentModel.textContent = state.currentModel.name || 'Unknown Model';
    }
    
    if (state.currentSession && currentSession) {
        currentSession.textContent = state.currentSession.title || 'Default';
        currentSessionData = state.currentSession;
    }
    
    // Update undo/redo button states
    if (state.currentSession) {
        const canUndo = !!(state.currentSession.revert?.messageId || state.currentSession.revert?.partId);
        const canRedo = !!(state.currentSession.revert?.messageId || state.currentSession.revert?.partId);
        updateUndoRedoButtons(canUndo, canRedo);
    }
}

// Handle sessions update
function handleSessionsUpdate(sessions) {
    vscode.postMessage({ type: 'debug', message: `📋 Received ${sessions.length} sessions` });
    
    if (window.dropdownManager) {
        window.dropdownManager.updateAvailableSessions(sessions);
        vscode.postMessage({ type: 'debug', message: `✅ Updated dropdownManager with ${sessions.length} sessions` });
    } else {
        vscode.postMessage({ type: 'debug', message: `❌ dropdownManager not available for sessions update` });
    }
    
    // Update current session display
    if (sessions.length > 0) {
        const currentSessionId = currentSessionData?.id;
        const currentSession = sessions.find(s => s.id === currentSessionId);
        if (currentSession && window.dropdownManager) {
            window.dropdownManager.updateCurrentSession(currentSession);
            vscode.postMessage({ type: 'debug', message: `✅ Updated current session display: ${currentSession.title}` });
        }
    }
}

// Handle models update
function handleModelsUpdate(models) {
    vscode.postMessage({ type: 'debug', message: `🤖 Received ${models.length} models` });
    
    if (window.dropdownManager) {
        window.dropdownManager.updateAvailableModels(models);
        vscode.postMessage({ type: 'debug', message: `✅ Updated dropdownManager with ${models.length} models` });
    } else {
        vscode.postMessage({ type: 'debug', message: `❌ dropdownManager not available for models update` });
    }
    
    // Update current model display - backend now properly sets isCurrent flag
    if (models.length > 0) {
        const currentModel = models.find(m => m.isCurrent) || models[0];
        if (currentModel && window.dropdownManager) {
            window.dropdownManager.updateCurrentModel(currentModel);
            currentModelData = currentModel;
            vscode.postMessage({ type: 'debug', message: `✅ Updated current model display: ${currentModel.name} (isCurrent: ${currentModel.isCurrent})` });
        }
    }
}

// Handle model switch
function handleModelSwitched(providerId, modelId) {
    vscode.postMessage({ type: 'debug', message: `🔄 Handling model switch: ${providerId}/${modelId}` });
    
    // Update current model data
    if (window.dropdownManager && window.dropdownManager.getAvailableModels) {
        const models = window.dropdownManager.getAvailableModels();
        const newModel = models.find(m => m.providerId === providerId && m.id === modelId);
        
        if (newModel) {
            currentModelData = newModel;
            
            // Update UI display
            const currentModelElement = document.getElementById('currentModel');
            if (currentModelElement) {
                currentModelElement.textContent = newModel.name;
                vscode.postMessage({ type: 'debug', message: `✅ Updated current model display to: ${newModel.name}` });
            }
            
            // Update dropdown manager
            if (window.dropdownManager.updateCurrentModel) {
                window.dropdownManager.updateCurrentModel(newModel);
                vscode.postMessage({ type: 'debug', message: `✅ Updated dropdownManager current model: ${newModel.name}` });
            }
        } else {
            vscode.postMessage({ type: 'debug', message: `❌ Model not found in available models: ${providerId}/${modelId}` });
        }
    } else {
        vscode.postMessage({ type: 'debug', message: `❌ dropdownManager or getAvailableModels not available` });
    }
}

// Handle session switch
function handleSessionSwitch(sessionId) {
    // Update current session data
    const session = availableSessions.find(s => s.id === sessionId);
    if (session && window.dropdownManager) {
        window.dropdownManager.updateCurrentSession(session);
    }
    
    // Clear chat area for new session
    const chatArea = document.getElementById('chatArea');
    if (chatArea) {
        chatArea.innerHTML = '';
    }
}

// Handle session created
function handleSessionCreated(session) {
    vscode.postMessage({ type: 'debug', message: `🆕 Handling session created: ${session.id}` });
    
    // Add new session to available sessions
    if (window.dropdownManager && window.dropdownManager.getAvailableSessions) {
        const sessions = window.dropdownManager.getAvailableSessions();
        sessions.push(session);
        window.dropdownManager.updateAvailableSessions(sessions);
    }
    
    // Switch to the new session
    if (window.dropdownManager) {
        window.dropdownManager.updateCurrentSession(session);
    }
    
    // Refresh dropdown if it's open
    if (window.dropdownManager && window.dropdownManager.refreshSessionDropdown) {
        window.dropdownManager.refreshSessionDropdown();
    }
    
    // Clear chat area for new session
    const chatArea = document.getElementById('chatArea');
    if (chatArea) {
        chatArea.innerHTML = '';
        // Force scroll to bottom for new session
        forceScrollToBottom();
    }
    
    // Reset session state
    isSessionLocked = false;
    currentStreamingMessage = null;
    currentMessageId = null;
    
    // Update status
    status.textContent = 'New session created';
    setTimeout(() => {
        status.textContent = 'Ready';
    }, 1000);
    
    vscode.postMessage({ type: 'debug', message: '✅ Session created completed' });
}

// Handle create session
function handleCreateSession(session) {
    if (session && window.dropdownManager) {
        window.dropdownManager.updateCurrentSession(session);
    }
    
    // Clear chat area for new session
    const chatArea = document.getElementById('chatArea');
    if (chatArea) {
        chatArea.innerHTML = '';
    }
}

// Handle session switched
function handleSessionSwitched(sessionId, messages = []) {
    vscode.postMessage({ type: 'debug', message: `🔄 Handling session switch: ${sessionId}` });
    
    // Get sessions from dropdown manager instead of local variable
    let session = null;
    if (window.dropdownManager && window.dropdownManager.getAvailableSessions) {
        const sessions = window.dropdownManager.getAvailableSessions();
        session = sessions.find(s => s.id === sessionId);
    }
    
    vscode.postMessage({ type: 'debug', message: `🔍 Found session: ${session ? session.title : 'null'}` });
    vscode.postMessage({ type: 'debug', message: `📋 Received ${messages.length} messages for this session` });
    
    if (session && window.dropdownManager) {
        window.dropdownManager.updateCurrentSession(session);
    }
    
    // Clear chat area for new session
    const chatArea = document.getElementById('chatArea');
    if (chatArea) {
        vscode.postMessage({ type: 'debug', message: '🧹 Clearing chat area' });
        chatArea.innerHTML = '';
    }
    
    // Load messages for the new session
    if (messages && messages.length > 0) {
        vscode.postMessage({ type: 'debug', message: `📝 Loading ${messages.length} messages` });
        messages.forEach(message => {
            addMessage(message.role, message.content, modeSelector.value, true); // Force scroll for loaded messages
        });
        vscode.postMessage({ type: 'debug', message: '✅ Messages loaded successfully' });
    } else {
        vscode.postMessage({ type: 'debug', message: '📝 No messages to load for this session' });
    }
    
    // Force scroll to bottom when opening a new chat
    forceScrollToBottom();
    
    // Reset session state
    isSessionLocked = false;
    currentStreamingMessage = null;
    currentMessageId = null;
    
    // Update status
    status.textContent = 'Session switched';
    setTimeout(() => {
        status.textContent = 'Ready';
    }, 1000);
    
    vscode.postMessage({ type: 'debug', message: '✅ Session switch completed' });
}

// Handle session delete success
function handleSessionDeleteSuccess(sessionId) {
    vscode.postMessage({ type: 'debug', message: `🗑️ Handling session delete: ${sessionId}` });
    
    // Get sessions from dropdown manager and remove the deleted one
    if (window.dropdownManager && window.dropdownManager.getAvailableSessions) {
        const sessions = window.dropdownManager.getAvailableSessions();
        const updatedSessions = sessions.filter(s => s.id !== sessionId);
        
        // Update dropdown manager
        window.dropdownManager.updateAvailableSessions(updatedSessions);
        
        // Refresh dropdown if it's open
        if (window.dropdownManager && window.dropdownManager.refreshSessionDropdown) {
            vscode.postMessage({ type: 'debug', message: '🔄 Calling refreshSessionDropdown' });
            window.dropdownManager.refreshSessionDropdown();
        } else {
            vscode.postMessage({ type: 'debug', message: '❌ refreshSessionDropdown not available' });
        }
        
        // If deleted session was current, switch to first available session
        if (currentSessionData?.id === sessionId) {
            if (updatedSessions.length > 0) {
                const firstSession = updatedSessions[0];
                handleSessionSwitched(firstSession.id);
            } else {
                // No sessions left, clear current session
                currentSessionData = null;
                const currentSession = document.getElementById('currentSession');
                if (currentSession) {
                    currentSession.textContent = 'No sessions';
                }
                
                // Clear chat area
                const chatArea = document.getElementById('chatArea');
                if (chatArea) {
                    chatArea.innerHTML = '';
                }
            }
        }
    }
    
    // Update status
    status.textContent = 'Session deleted';
    setTimeout(() => {
        status.textContent = 'Ready';
    }, 1000);
    
    vscode.postMessage({ type: 'debug', message: '✅ Session delete completed' });
}

// Handle session updated
function handleSessionUpdated(session) {
    vscode.postMessage({ type: 'debug', message: `📝 Handling session update: ${session.id}` });
    
    // Get sessions from dropdown manager and update the session
    if (window.dropdownManager && window.dropdownManager.getAvailableSessions) {
        const sessions = window.dropdownManager.getAvailableSessions();
        const index = sessions.findIndex(s => s.id === session.id);
        if (index !== -1) {
            sessions[index] = session;
            
            // Update dropdown manager
            window.dropdownManager.updateAvailableSessions(sessions);
            
            // If updated session is current, update display
            if (currentSessionData?.id === session.id) {
                currentSessionData = session;
                if (window.dropdownManager) {
                    window.dropdownManager.updateCurrentSession(session);
                }
            }
        }
    }
    
    vscode.postMessage({ type: 'debug', message: '✅ Session update completed' });
}

// Handle messages loaded
function handleMessagesLoaded(messages) {
    vscode.postMessage({ type: 'debug', message: `📝 Handling messages loaded: ${messages.length} messages` });
    
    // Clear chat area first
    const chatArea = document.getElementById('chatArea');
    if (chatArea) {
        chatArea.innerHTML = '';
    }
    
    // Load messages for the current session
    if (messages && messages.length > 0) {
        vscode.postMessage({ type: 'debug', message: `📝 Loading ${messages.length} messages` });
        messages.forEach(message => {
            addMessage(message.role, message.content, modeSelector.value, true); // Force scroll for loaded messages
        });
        vscode.postMessage({ type: 'debug', message: '✅ Messages loaded successfully' });
    } else {
        vscode.postMessage({ type: 'debug', message: '📝 No messages to load for current session' });
    }
    
    // Force scroll to bottom when loading messages
    forceScrollToBottom();
    
    // Reset session state
    isSessionLocked = false;
    currentStreamingMessage = null;
    currentMessageId = null;
    
    // Update status
    status.textContent = 'Messages loaded';
    setTimeout(() => {
        status.textContent = 'Ready';
    }, 1000);
    
    vscode.postMessage({ type: 'debug', message: '✅ Messages loaded completed' });
}

// Handle error
function handleError(error) {
    console.error('OpenCode Error:', error);
    status.textContent = `Error: ${error}`;
    setTimeout(() => {
        status.textContent = 'Ready';
    }, 3000);
    
    // Unlock session on error
    isSessionLocked = false;
}


// Handle queued processing
function handleQueuedProcessing(message) {
    if (message.isQueued) {
        // Show queued processing indicator
        if (!currentStreamingMessage) {
            const mode = modeSelector.value || 'plan';
            const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const generatingText = `Generating...\n${mode.charAt(0).toUpperCase() + mode.slice(1)} ${modelName} (${currentTime})`;
            
            currentStreamingMessage = addStreamingMessage('assistant', generatingText, mode);
            currentMessageId = 'generating_' + Date.now();
            isSessionLocked = true; // Keep session locked for queued processing
        } else {
            // No queued messages - unlock session
            isSessionLocked = false;
        }
    }
}
