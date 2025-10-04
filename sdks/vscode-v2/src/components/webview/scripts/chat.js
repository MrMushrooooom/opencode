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
            handlePermissionRequest(message.permission);
            break;
            
        case 'message-updated':
            handleMessageUpdated(message.messageInfo);
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
            
        case 'clearChat':
            vscode.postMessage({ type: 'debug', message: '🧹 Clearing chat area' });
            handleClearChat();
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
            
        case 'modelsUpdate':
            vscode.postMessage({ type: 'debug', message: `📡 Received modelsUpdate message: ${message.models.length} models` });
            handleModelsUpdate(message.models);
            break;
            
        case 'sessionsUpdate':
            vscode.postMessage({ type: 'debug', message: `📡 Received sessionsUpdate message: ${message.sessions.length} sessions` });
            handleSessionsUpdate(message.sessions);
            break;
            
        case 'stateUpdate':
            vscode.postMessage({ type: 'debug', message: `📡 Received stateUpdate message` });
            handleStateUpdate(message.state);
            break;
            
        case 'tool-part-updated':
            vscode.postMessage({ type: 'debug', message: `🔧 Received tool-part-updated message: ${message.toolPart.id}` });
            handleToolPartUpdated(message.messageId, message.toolPart);
            break;
            
        case 'permission-request':
            vscode.postMessage({ type: 'debug', message: `🔐 Received permission-request message: ${message.permission.id}` });
            handlePermissionRequest(message.permission);
            break;
            
        case 'permission-replied':
            vscode.postMessage({ type: 'debug', message: `🔐 Received permission-replied message: ${message.permissionId}` });
            handlePermissionReplied(message.permissionId);
            break;
            
        case 'part-removed':
            vscode.postMessage({ type: 'debug', message: `🗑️ Received part-removed message: ${message.partId} from ${message.messageId}` });
            handlePartRemoved(message.messageId, message.partId);
            break;
            
        case 'message-removed':
            vscode.postMessage({ type: 'debug', message: `🗑️ Received message-removed message: ${message.messageId} from ${message.sessionId}` });
            handleMessageRemoved(message.messageId, message.sessionId);
            break;
            
        case 'session-idle':
            vscode.postMessage({ type: 'debug', message: '💤 Session idle event received - updating status' });
            updateSessionStatus();
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

// TUI-style tool part update handling
function handleToolPartUpdated(messageId, toolPart) {
    const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
    if (targetMessage) {
        handleToolPart(targetMessage, toolPart);
    }
}

// TUI-style permission replied handling
function handlePermissionReplied(permissionId) {
    // Remove permission UI after response
    const permissionDiv = document.querySelector(`[data-permission-id="${permissionId}"]`);
    if (permissionDiv) {
        permissionDiv.remove();
        vscode.postMessage({ type: 'debug', message: `✅ Permission UI removed for: ${permissionId}` });
    }
}

// TUI-style part removal handling
function handlePartRemoved(messageId, partId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        const partDiv = messageDiv.querySelector(`[data-part-id="${partId}"]`);
        if (partDiv) {
            partDiv.remove();
            vscode.postMessage({ type: 'debug', message: `✅ Part removed: ${partId} from message ${messageId}` });
            
            // Update messageParts tracking
            if (window.messageParts && window.messageParts.has(messageId)) {
                const parts = window.messageParts.get(messageId);
                const updatedParts = parts.filter(part => part.id !== partId);
                window.messageParts.set(messageId, updatedParts);
            }
        }
    }
}

// TUI-style message removal handling
function handleMessageRemoved(messageId, sessionId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        messageDiv.remove();
        vscode.postMessage({ type: 'debug', message: `✅ Message removed: ${messageId} from session ${sessionId}` });
        
        // Clean up tracking data
        if (window.messageParts) {
            window.messageParts.delete(messageId);
        }
        if (window.messageData) {
            window.messageData.delete(messageId);
        }
        
        // Update QUEUED status for remaining messages
        updateQueuedStatusForAllMessages();
    }
}
// TUI-style permission request handling
function handlePermissionRequest(permission) {
    vscode.postMessage({ type: 'debug', message: `🔐 Handling permission request: ${JSON.stringify(permission)}` });
    
    // Following TUI approach: find the current streaming message and add permission inline
    if (currentStreamingMessage) {
        addPermissionToMessage(currentStreamingMessage, permission);
    } else {
        // If no current streaming message, find the last assistant message
        const lastAssistantMessage = document.querySelector('.message.assistant:last-child');
        if (lastAssistantMessage) {
            addPermissionToMessage(lastAssistantMessage, permission);
        } else {
            vscode.postMessage({ type: 'debug', message: '⚠️ No message found for permission request' });
        }
    }
}

// TUI-style permission addition to message - following TUI's renderToolDetails with permission
function addPermissionToMessage(messageDiv, permission) {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (!contentDiv) return;
    
    // Check if permission already exists
    let permissionDiv = contentDiv.querySelector(`[data-permission-id="${permission.id}"]`);
    
    if (!permissionDiv) {
        // Create permission container
        permissionDiv = document.createElement('div');
        permissionDiv.className = 'permission-request';
        permissionDiv.setAttribute('data-permission-id', permission.id);
        contentDiv.appendChild(permissionDiv);
    }
    
    // Render permission following TUI's approach
    const permissionContent = renderPermissionContent(permission);
    permissionDiv.innerHTML = permissionContent;
    
    smartScrollToBottom();
}

// TUI-style permission content rendering
function renderPermissionContent(permission) {
    const toolName = renderToolName(permission.type);
    const title = permission.title || `${toolName} permission required`;
    
    return `
        <div class="permission-content">
            <div class="permission-title">${title}</div>
            <div class="permission-description">Permission required to run this tool</div>
            <div class="permission-actions">
                <button class="permission-btn accept-once" onclick="respondToPermission('${permission.id}', 'once')">
                    Accept
                </button>
                <button class="permission-btn accept-always" onclick="respondToPermission('${permission.id}', 'always')">
                    Accept Always
                </button>
                <button class="permission-btn reject" onclick="respondToPermission('${permission.id}', 'reject')">
                    Reject
                </button>
            </div>
        </div>
    `;
}

// TUI-style permission response handling
function respondToPermission(permissionId, response) {
    vscode.postMessage({ 
        type: 'respondToPermission', 
        permissionId: permissionId, 
        response: response 
    });
    
    // Remove permission UI immediately for better UX
    const permissionDiv = document.querySelector(`[data-permission-id="${permissionId}"]`);
    if (permissionDiv) {
        permissionDiv.remove();
        vscode.postMessage({ type: 'debug', message: `✅ Permission UI removed immediately for: ${permissionId}` });
    }
}

// Update message metadata (model, timestamp, etc.)
function updateMessageMetadata(messageDiv, messageInfo) {
    const metadataDiv = messageDiv.querySelector('.message-metadata');
    if (metadataDiv && messageInfo.role === 'assistant') {
        // CRITICAL FIX: Only update metadata when message is completed
        // Following TUI approach: metadata should only show when Time.Completed > 0
        const isCompleted = messageInfo.time?.completed && messageInfo.time.completed > 0;
        
        if (isCompleted) {
            // Update model and timestamp information using completed time
            const modeText = modeSelector.value ? modeSelector.value.charAt(0).toUpperCase() + modeSelector.value.slice(1) : 'Plan';
            const modelName = messageInfo.modelID || (window.currentModelData ? window.currentModelData.id : 'Loading...');
            const time = new Date(messageInfo.time.completed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            metadataDiv.textContent = `${modeText} ${modelName} (${time})`;
            metadataDiv.style.display = 'block'; // Show metadata when completed
            
            vscode.postMessage({ type: 'debug', message: `🔄 Updated metadata for completed message: ${messageInfo.id}` });
        } else {
            // Hide metadata while message is still streaming
            metadataDiv.style.display = 'none';
            vscode.postMessage({ type: 'debug', message: `🔄 Hiding metadata for streaming message: ${messageInfo.id}` });
        }
    }
}

// Handle message creation - Following TUI approach
function handleMessageUpdated(messageInfo) {
    vscode.postMessage({ type: 'debug', message: `📨 Processing message-updated for messageId: ${messageInfo.id}` });
    vscode.postMessage({ type: 'debug', message: `📨 MessageInfo: ${JSON.stringify(messageInfo)}` });
    
    // Following TUI approach: update or create message, then re-render
    if (messageInfo) {
        // Check if message already exists
        const existingMessage = document.querySelector(`[data-message-id="${messageInfo.id}"]`);
        
        if (existingMessage) {
            // Update existing message metadata
            vscode.postMessage({ type: 'debug', message: `🔄 Updating existing message: ${messageInfo.id}` });
            updateMessageMetadata(existingMessage, messageInfo);
            
            // Following TUI approach: store message data for completion checking
            if (!window.messageData) {
                window.messageData = new Map();
            }
            window.messageData.set(messageInfo.id, messageInfo);
            
            // CRITICAL FIX: For completed messages, ensure metadata is visible
            // This handles the case where page refreshes and metadata gets hidden
            if (messageInfo.role === 'assistant' && messageInfo.time?.completed && messageInfo.time.completed > 0) {
                const metadataDiv = existingMessage.querySelector('.message-metadata');
                if (metadataDiv) {
                    metadataDiv.style.display = 'block';
                    vscode.postMessage({ type: 'debug', message: `🔄 Restored metadata visibility for completed message: ${messageInfo.id}` });
                }
            }
            
            // CRITICAL FIX: Update session status when message is completed
            // Following TUI approach: check if message is completed and update status accordingly
            if (messageInfo.role === 'assistant' && messageInfo.time?.completed && messageInfo.time.completed > 0) {
                vscode.postMessage({ type: 'debug', message: `🏁 Assistant message completed: ${messageInfo.id}` });
                updateSessionStatus();
            }
        } else {
            // Create new message (following TUI's approach)
            vscode.postMessage({ type: 'debug', message: `🆕 Creating new message: ${messageInfo.id} (${messageInfo.role})` });
            
            if (messageInfo.role === 'user') {
                // For user messages, we need to find the most recent user message with a temp ID
                // and update it with the real server ID
                const tempUserMessages = document.querySelectorAll('.message.user[data-message-id^="temp_"]');
                if (tempUserMessages.length > 0) {
                    const lastTempMessage = tempUserMessages[tempUserMessages.length - 1];
                    vscode.postMessage({ type: 'debug', message: `🔄 Updating temp user message ID: ${lastTempMessage.getAttribute('data-message-id')} -> ${messageInfo.id}` });
                    
                    // Update messageParts map BEFORE changing the ID
                    const tempId = lastTempMessage.getAttribute('data-message-id');
                    if (window.messageParts && window.messageParts.has(tempId)) {
                        const parts = window.messageParts.get(tempId);
                        window.messageParts.delete(tempId);
                        window.messageParts.set(messageInfo.id, parts);
                    }
                    
                    // Update the message ID
                    lastTempMessage.setAttribute('data-message-id', messageInfo.id);
                    
                    // Update metadata
                    updateMessageMetadata(lastTempMessage, messageInfo);
                } else {
                    vscode.postMessage({ type: 'debug', message: `⚠️ No temp user message found for ID update: ${messageInfo.id}` });
                }
            } else if (messageInfo.role === 'assistant') {
                // Following TUI approach: Create assistant message with empty content initially
                // Only create if it doesn't already exist
                let assistantMessageDiv = document.querySelector(`[data-message-id="${messageInfo.id}"]`);
                
                if (!assistantMessageDiv) {
                    assistantMessageDiv = addMessage('assistant', '', modeSelector.value, false, messageInfo.id, messageInfo.modelID, messageInfo.time?.created);
                    
                    // Following TUI approach: store message data for completion checking
                    if (!window.messageData) {
                        window.messageData = new Map();
                    }
                    window.messageData.set(messageInfo.id, messageInfo);
                    
                    // CRITICAL FIX: Only set as current streaming message if no other message is currently streaming
                    // This ensures QUEUED status works correctly for consecutive messages
                    if (!currentStreamingMessage) {
                        vscode.postMessage({ type: 'debug', message: `🔄 Setting currentStreamingMessage to: ${messageInfo.id} (no other message streaming)` });
                        currentStreamingMessage = assistantMessageDiv;
                        currentMessageId = messageInfo.id;
                    } else {
                        vscode.postMessage({ type: 'debug', message: `⚠️ Not setting currentStreamingMessage - another message is already streaming: ${currentMessageId}` });
                    }
                    
                    // TUI approach: Update QUEUED status for all user messages when a new assistant message is created
                    updateQueuedStatusForAllMessages();
                } else {
                    vscode.postMessage({ type: 'debug', message: `🔄 Assistant message already exists: ${messageInfo.id}` });
                }
            }
        }
    } else {
        vscode.postMessage({ type: 'debug', message: `⚠️ MessageInfo is null` });
    }
}


// Following TUI approach: determine if a message should show QUEUED status
function shouldShowQueued(messageId) {
    // TUI's exact logic: find last assistant message ID
    const allAssistantMessages = Array.from(document.querySelectorAll('.message.assistant[data-message-id]'));
    let lastAssistantMessageId = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"; // TUI's default value
    
    if (allAssistantMessages.length > 0) {
        const lastAssistantMessage = allAssistantMessages[allAssistantMessages.length - 1];
        lastAssistantMessageId = lastAssistantMessage.getAttribute('data-message-id');
    }
    
    // TUI's exact comparison: string comparison
    const isQueued = messageId > lastAssistantMessageId;
    
    vscode.postMessage({ type: 'debug', message: `🔍 QUEUED check: messageId=${messageId}, lastAssistantMessageId=${lastAssistantMessageId}, isQueued=${isQueued}` });
    
    return isQueued;
}

// Add QUEUED status to a message if needed - Following TUI approach
function addQueuedStatusToMessage(messageDiv) {
    const messageId = messageDiv.getAttribute('data-message-id');
    if (!messageId) return;
    
    // TUI only shows QUEUED on user messages, not assistant messages
    if (messageDiv.classList.contains('user') && shouldShowQueued(messageId)) {
        const contentDiv = messageDiv.querySelector('.message-content');
        if (contentDiv && !contentDiv.querySelector('.queued-status')) {
            const queuedDiv = document.createElement('div');
            queuedDiv.className = 'queued-status';
            queuedDiv.innerHTML = '<span class="queued-label">QUEUED</span>';
            contentDiv.insertBefore(queuedDiv, contentDiv.firstChild);
            vscode.postMessage({ type: 'debug', message: `✅ Added QUEUED status to user message: ${messageId}` });
        }
    }
}

// Expose function to global scope for main.js access
window.addQueuedStatusToMessage = addQueuedStatusToMessage;

// Update QUEUED status for all messages when streaming state changes - Following TUI approach
function updateQueuedStatusForAllMessages() {
    // TUI approach: Check all user messages for QUEUED status
    const allUserMessages = document.querySelectorAll('.message.user[data-message-id]');
    
    allUserMessages.forEach(messageDiv => {
        const messageId = messageDiv.getAttribute('data-message-id');
        if (messageId) {
            // Check if this user message should show QUEUED status
            if (shouldShowQueued(messageId)) {
                addQueuedStatusToMessage(messageDiv);
            } else {
                // Remove QUEUED status if it exists
                const queuedStatus = messageDiv.querySelector('.queued-status');
                if (queuedStatus) {
                    queuedStatus.remove();
                }
            }
        }
    });
}

// Handle streaming update
function handleStreamingUpdate(message) {
    vscode.postMessage({ type: 'debug', message: `🔄 Received streaming update: ${JSON.stringify(message)}` });
    
    const { messageId, content, partType, role } = message;
    
    // Following TUI approach: ignore message-updated events (handled separately)
    if (partType === 'message-updated') {
        vscode.postMessage({ type: 'debug', message: `📨 Ignoring message-updated streaming event - handled separately` });
        return;
    }
    
    // Following TUI approach: ignore user message updates since they're already displayed
    // User messages are created immediately when sendMessage is called
    if (role === 'user') {
        vscode.postMessage({ type: 'debug', message: '👤 Ignoring user message update - already displayed' });
        return;
    }
    
    if (partType === 'text') {
        vscode.postMessage({ type: 'debug', message: `📝 Processing text update for messageId: ${messageId}, content length: ${content?.length || 0}` });
        
        // Following TUI approach: find the specific message by ID
        const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        if (targetMessage) {
            vscode.postMessage({ type: 'debug', message: `✅ Found target message for messageId: ${messageId}` });
            addTextPartToMessage(targetMessage, content);
            
            // CRITICAL FIX: Only update current streaming message if this is the first content for this message
            // or if no other message is currently streaming
            if (!currentStreamingMessage || currentMessageId === messageId) {
                vscode.postMessage({ type: 'debug', message: `🔄 Updating currentStreamingMessage in handleStreamingUpdate: ${messageId}` });
                vscode.postMessage({ type: 'debug', message: `🔄 Previous currentMessageId: ${currentMessageId || 'null'}` });
                currentStreamingMessage = targetMessage;
                currentMessageId = messageId;
                vscode.postMessage({ type: 'debug', message: `🔄 New currentMessageId: ${currentMessageId}` });
                
                // Update QUEUED status for all other messages when a new message starts streaming
                updateQueuedStatusForAllMessages();
            } else {
                vscode.postMessage({ type: 'debug', message: `⚠️ Not updating currentStreamingMessage - different messageId: ${messageId} vs ${currentMessageId}` });
            }
        } else {
            vscode.postMessage({ type: 'debug', message: `⚠️ Message not found for messageId: ${messageId}` });
        }
    } else if (partType === 'reasoning') {
        // TUI-style reasoning part handling - filter based on showThinkingBlocks setting
        vscode.postMessage({ type: 'debug', message: `🧠 Processing reasoning part for messageId: ${messageId}, showThinkingBlocks: ${showThinkingBlocks}` });
        
        // Following TUI approach: only show reasoning if showThinkingBlocks is true
        if (!showThinkingBlocks) {
            vscode.postMessage({ type: 'debug', message: `🚫 Reasoning part hidden - showThinkingBlocks is false` });
            return;
        }
        
        const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        if (targetMessage) {
            vscode.postMessage({ type: 'debug', message: `✅ Found target message for reasoning part: ${messageId}` });
            addReasoningPartToMessage(targetMessage, content);
        } else {
            vscode.postMessage({ type: 'debug', message: `⚠️ Message not found for reasoning part: ${messageId}` });
        }
    } else if (partType === 'tool') {
        // TUI-style tool part handling - unified approach
        vscode.postMessage({ type: 'debug', message: `🔧 Processing tool part for messageId: ${messageId}` });
        
        const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        if (targetMessage) {
            handleToolPart(targetMessage, message);
            
            // CRITICAL FIX: Remove "Generating..." when tool execution starts
            // This handles both streaming and loaded messages
            const generatingDiv = targetMessage.querySelector('.generating-part');
            if (generatingDiv) {
                generatingDiv.remove();
                vscode.postMessage({ type: 'debug', message: `🗑️ Removed generating part for message: ${messageId}` });
            }
            
            // Also remove any generating parts from messageParts tracking
            if (window.messageParts && window.messageParts.has(messageId)) {
                const parts = window.messageParts.get(messageId);
                const filteredParts = parts.filter(part => part.type !== 'generating');
                window.messageParts.set(messageId, filteredParts);
            }
        }
        
    } else if (partType === 'step-start') {
        vscode.postMessage({ type: 'debug', message: `🚀 Step start for messageId: ${messageId}` });
        
        // Following TUI approach: find the specific message by ID
        const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        if (targetMessage) {
            currentStreamingMessage = targetMessage;
            currentMessageId = messageId;
        }
        
    } else if (partType === 'step-finish') {
        vscode.postMessage({ type: 'debug', message: `🏁 Step finish for messageId: ${messageId}` });
        
        // Following TUI approach: step-finish is just another part, not the end of streaming
        // TUI treats step-start and step-finish as regular parts in the message
        // We should NOT finalize the message here - wait for actual completion
        
        // Only clear QUEUED tags if this is truly the end of the entire response
        // For now, just log the step finish - the server will continue sending parts
        vscode.postMessage({ type: 'debug', message: `🏁 Step finished for messageId: ${messageId} - waiting for more parts` });
        
        // Don't unlock session or change status here - wait for actual completion
        // The server will continue sending text parts after tool execution
    }
}

// Add or update text part to message (for LLM responses) - Following TUI's TextPart structure
function addTextPartToMessage(messageDiv, content) {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
        // Get message ID for parts tracking
        const messageId = messageDiv.getAttribute('data-message-id');
        
        // Check if text part already exists (including generating parts)
        let textPartDiv = contentDiv.querySelector('.text-part');
        
        if (!textPartDiv) {
            // Create new text part container
            textPartDiv = document.createElement('div');
            textPartDiv.className = 'message-part text-part';
            textPartDiv.setAttribute('data-part-id', `text_${Date.now()}`);
            contentDiv.appendChild(textPartDiv);
            
            // Track this part in messageParts
            if (messageId && window.messageParts) {
                const parts = window.messageParts.get(messageId) || [];
                parts.push({
                    type: 'text',
                    id: textPartDiv.getAttribute('data-part-id'),
                    content: content
                });
                window.messageParts.set(messageId, parts);
            }
        } else {
            // Remove generating class if it exists
            textPartDiv.classList.remove('generating');
        }
        
        // Remove QUEUED status when content arrives
        const queuedStatus = contentDiv.querySelector('.queued-status');
        if (queuedStatus) {
            queuedStatus.remove();
        }
        
        // CRITICAL FIX: Following TUI's exact logic for "Generating..." handling
        // TUI only shows "Generating..." if the text is exactly "Generating..."
        // Otherwise, it shows the actual content and removes any generating parts
        if (content && content.trim() !== '') {
            // Check if this is exactly "Generating..." text
            const isGenerating = content.trim() === "Generating...";
            
            if (isGenerating) {
                // Only show "Generating..." if text is exactly "Generating..."
                textPartDiv.innerHTML = '<span class="generating-label">Generating...</span>';
                textPartDiv.classList.add('generating-part');
            } else {
                // Remove generating class and show actual content
                textPartDiv.classList.remove('generating-part');
                textPartDiv.innerHTML = renderMarkdown(content);
                
                // Remove any other generating parts when real content arrives
                const generatingDiv = contentDiv.querySelector('.generating-part');
                if (generatingDiv) {
                    generatingDiv.remove();
                }
            }
        }
        
        // Update the part in messageParts
        if (messageId && window.messageParts) {
            const parts = window.messageParts.get(messageId) || [];
            const partIndex = parts.findIndex(p => p.id === textPartDiv.getAttribute('data-part-id'));
            if (partIndex !== -1) {
                parts[partIndex].content = content;
                window.messageParts.set(messageId, parts);
            }
        }
        
        smartScrollToBottom();
    }
}

// TUI-style reasoning part handling - following TUI's renderText with isThinking=true
function addReasoningPartToMessage(messageDiv, content) {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
        const messageId = messageDiv.getAttribute('data-message-id');
        let reasoningPartDiv = contentDiv.querySelector('.reasoning-part');

        if (!reasoningPartDiv) {
            reasoningPartDiv = document.createElement('div');
            reasoningPartDiv.className = 'message-part reasoning-part';
            reasoningPartDiv.setAttribute('data-part-id', `reasoning_${Date.now()}`);
            contentDiv.appendChild(reasoningPartDiv);
            
            // Track this part in messageParts
            if (messageId && window.messageParts) {
                const parts = window.messageParts.get(messageId) || [];
                parts.push({
                    type: 'reasoning',
                    id: reasoningPartDiv.getAttribute('data-part-id'),
                    content: content
                });
                window.messageParts.set(messageId, parts);
            }
        } else {
            reasoningPartDiv.classList.remove('generating');
        }

        const queuedStatus = contentDiv.querySelector('.queued-status');
        if (queuedStatus) {
            queuedStatus.remove();
        }

        if (content && content.trim() !== '') {
            // Following TUI's renderText with isThinking=true
            const thinkingLabel = '<div class="thinking-label">Thinking...</div>';
            const thinkingContent = renderMarkdown(content);
            reasoningPartDiv.innerHTML = thinkingLabel + '<div class="thinking-content">' + thinkingContent + '</div>';
        }
        
        if (messageId && window.messageParts) {
            const parts = window.messageParts.get(messageId) || [];
            const existingPartIndex = parts.findIndex(p => p.id === reasoningPartDiv.getAttribute('data-part-id'));
            if (existingPartIndex !== -1) {
                parts[existingPartIndex].content = content;
            }
            window.messageParts.set(messageId, parts);
        }
        
        smartScrollToBottom();
    }
}

// TUI-style tool part handling - unified approach following TUI's renderToolDetails
function handleToolPart(messageDiv, toolPart) {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (!contentDiv) return;
    
    const messageId = messageDiv.getAttribute('data-message-id');
    
    // Check if tool part already exists
    let toolPartDiv = contentDiv.querySelector(`[data-tool-id="${toolPart.id}"]`);
    
    if (!toolPartDiv) {
        // Create new tool part container
        toolPartDiv = document.createElement('div');
        toolPartDiv.className = 'message-part tool-part';
        toolPartDiv.setAttribute('data-tool-id', toolPart.id);
        toolPartDiv.setAttribute('data-part-id', toolPart.id);
        contentDiv.appendChild(toolPartDiv);
        
        // Track this part in messageParts
        if (messageId && window.messageParts) {
            const parts = window.messageParts.get(messageId) || [];
            parts.push({
                type: 'tool',
                id: toolPart.id,
                content: toolPart
            });
            window.messageParts.set(messageId, parts);
        }
        
        // Following TUI approach: store tool data for completion checking
        if (!window.toolData) {
            window.toolData = new Map();
        }
        window.toolData.set(toolPart.id, toolPart);
    }
    
    // Render tool details following TUI's approach
    const toolDetails = renderToolDetails(toolPart);
    toolPartDiv.innerHTML = toolDetails;
    
    smartScrollToBottom();
}

// TUI-style tool details rendering - following TUI's renderToolDetails function
function renderToolDetails(toolPart) {
    const toolName = renderToolName(toolPart.tool);
    const state = toolPart.state?.status || 'pending';
    
    // Handle pending state - show action description
    if (state === 'pending') {
        const action = renderToolAction(toolPart.tool);
        return `
            <div class="tool-pending">
                <div class="tool-title">${action}</div>
            </div>
        `;
    }
    
    // Handle completed/error states
    let title = renderToolTitle(toolPart);
    let output = '';
    
    if (toolPart.state?.output) {
        // Format output for better display
        const outputText = toolPart.state.output;
        output = `<pre><code>${outputText}</code></pre>`;
    }
    
    if (toolPart.state?.error) {
        output = `<pre><code class="error">❌ ${toolPart.state.error}</code></pre>`;
    }
    
    return `
        <div class="tool-completed">
            <div class="tool-title">${title}</div>
            ${output ? `<div class="tool-output">${output}</div>` : ''}
        </div>
    `;
}

// TUI-style tool name rendering
function renderToolName(name) {
    switch (name) {
        case 'bash':
            return 'Shell';
        case 'webfetch':
            return 'Fetch';
        case 'invalid':
            return 'Invalid';
        default:
            let normalizedName = name;
            if (name.startsWith('opencode_')) {
                normalizedName = name.substring(9);
            }
            return normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1);
    }
}

// TUI-style tool action rendering
function renderToolAction(name) {
    switch (name) {
        case 'task':
            return 'Delegating...';
        case 'bash':
            return 'Writing command...';
        case 'edit':
            return 'Preparing edit...';
        case 'webfetch':
            return 'Fetching from the web...';
        case 'glob':
            return 'Finding files...';
        case 'grep':
            return 'Searching content...';
        case 'list':
            return 'Listing directory...';
        case 'read':
            return 'Reading file...';
        case 'write':
            return 'Preparing write...';
        case 'todowrite':
        case 'todoread':
            return 'Planning...';
        case 'patch':
            return 'Preparing patch...';
        default:
            return 'Working...';
    }
}

// TUI-style tool title rendering
function renderToolTitle(toolPart) {
    const toolName = renderToolName(toolPart.tool);
    const args = toolPart.state?.input || {};
    
    switch (toolPart.tool) {
        case 'read':
            return `${toolName} ${args.filePath || ''}`;
        case 'edit':
        case 'write':
            return `${toolName} ${args.filePath || ''}`;
        case 'bash':
            return `${toolName} ${args.command || args.description || ''}`;
        case 'webfetch':
            return `${toolName} ${args.url || ''}`;
        case 'list':
            return `${toolName} ${args.path || '.'}`;
        default:
            return toolName;
    }
}

// Update streaming message content - Following TUI's approach
function updateStreamingMessage(messageDiv, content) {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
        // Following TUI approach: update the text part, not the entire content
        const textPartDiv = contentDiv.querySelector('.text-part');
        if (textPartDiv) {
            // Update existing text part
            textPartDiv.innerHTML = renderMarkdown(content);
            
            // Update the part in messageParts
            const messageId = messageDiv.getAttribute('data-message-id');
            if (messageId && window.messageParts) {
                const parts = window.messageParts.get(messageId) || [];
                const partIndex = parts.findIndex(p => p.id === textPartDiv.getAttribute('data-part-id'));
                if (partIndex !== -1) {
                    parts[partIndex].content = content;
                    window.messageParts.set(messageId, parts);
                }
            }
        } else {
            // No text part exists, create one
            addTextPartToMessage(messageDiv, content);
        }
        
        // Smart scroll - only scroll if user is at bottom
        smartScrollToBottom();
    }
}


// Following TUI approach: check if there's any animating work
function hasAnimatingWork() {
    // TUI's HasAnimatingWork logic:
    // 1. Check if any AssistantMessage has Time.Completed == 0
    // 2. Check if any ToolPart has Status == 'pending'
    
    const assistantMessages = document.querySelectorAll('.message.assistant[data-message-id]');
    for (const msg of assistantMessages) {
        const messageId = msg.getAttribute('data-message-id');
        const messageData = window.messageData?.get(messageId);
        
        // Check if assistant message is not completed (Time.Completed == 0)
        if (messageData && messageData.time && messageData.time.completed === 0) {
            vscode.postMessage({ type: 'debug', message: `🔄 HasAnimatingWork: Assistant message ${messageId} not completed` });
            return true;
        }
        
        // Check if any tool parts are pending
        const toolParts = msg.querySelectorAll('.tool-part[data-tool-id]');
        for (const toolPart of toolParts) {
            const toolId = toolPart.getAttribute('data-tool-id');
            const toolData = window.toolData?.get(toolId);
            
            if (toolData && toolData.state && toolData.state.status === 'pending') {
                vscode.postMessage({ type: 'debug', message: `🔄 HasAnimatingWork: Tool ${toolId} is pending` });
                return true;
            }
        }
    }
    
    return false;
}

// Following TUI approach: check if session is busy
function isSessionBusy() {
    // TUI's IsBusy logic: check if last message is AssistantMessage with Time.Completed == 0
    const allMessages = document.querySelectorAll('.message[data-message-id]');
    if (allMessages.length === 0) {
        return false;
    }
    
    const lastMessage = allMessages[allMessages.length - 1];
    if (lastMessage.classList.contains('assistant')) {
        const messageId = lastMessage.getAttribute('data-message-id');
        const messageData = window.messageData?.get(messageId);
        
        if (messageData && messageData.time && messageData.time.completed === 0) {
            vscode.postMessage({ type: 'debug', message: `🔄 IsBusy: Last assistant message ${messageId} not completed` });
            return true;
        }
    }
    
    return false;
}

// Update session status based on TUI's logic
function updateSessionStatus() {
    vscode.postMessage({ type: 'debug', message: '🔄 Updating session status...' });
    
    const hasWork = hasAnimatingWork();
    vscode.postMessage({ type: 'debug', message: `🔍 hasAnimatingWork() result: ${hasWork}` });
    
    // Check if there's any animating work (following TUI's HasAnimatingWork logic)
    if (!hasWork) {
        // No animating work - unlock session and update status
        if (isSessionLocked) {
            isSessionLocked = false;
            status.textContent = 'Ready';
            vscode.postMessage({ type: 'debug', message: '🔓 Session unlocked - no more animating work' });
        } else {
            vscode.postMessage({ type: 'debug', message: '🔄 Session already unlocked' });
        }
    } else {
        // Still has animating work - keep session locked
        if (!isSessionLocked) {
            isSessionLocked = true;
            status.textContent = 'Sending...';
            vscode.postMessage({ type: 'debug', message: '🔒 Session locked - has animating work' });
        } else {
            vscode.postMessage({ type: 'debug', message: '🔄 Session still busy - keeping locked' });
        }
    }
}

// Handle streaming complete - Following TUI's approach
function handleStreamingComplete(message) {
    vscode.postMessage({ type: 'debug', message: `🏁 Handling streaming complete for message: ${message?.messageId || 'unknown'}` });
    
    // Following TUI approach: only finalize if no more animating work
    if (!hasAnimatingWork()) {
        if (currentStreamingMessage) {
            finalizeStreamingMessage(currentStreamingMessage);
            vscode.postMessage({ type: 'debug', message: `🏁 Finalized streaming message: ${currentMessageId}` });
            currentStreamingMessage = null;
            currentMessageId = null;
        }
        
        // Following TUI approach: unlock session only if not busy
        if (!isSessionBusy()) {
            isSessionLocked = false;
            status.textContent = 'Ready';
            vscode.postMessage({ type: 'debug', message: '🔓 Session unlocked - no more animating work' });
        } else {
            vscode.postMessage({ type: 'debug', message: '🔄 Session still busy - keeping locked' });
        }
    } else {
        vscode.postMessage({ type: 'debug', message: '🔄 Still has animating work - not finalizing' });
    }
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
        let currentSession = sessions.find(s => s.id === currentSessionId);
        
        // If no current session is set, use the first session as default
        if (!currentSession && !currentSessionData) {
            currentSession = sessions[0];
            currentSessionData = currentSession;
            vscode.postMessage({ type: 'debug', message: `📝 Set default current session: ${currentSession.title}` });
        }
        
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
            // Also update global window variable for message metadata
            window.currentModelData = currentModel;
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
            // Also update global window variable for message metadata
            window.currentModelData = newModel;
            
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

// Handle clear chat - Following TUI approach: clear chat area for manual session creation
function handleClearChat() {
    const chatArea = document.getElementById('chatArea');
    if (chatArea) {
        chatArea.innerHTML = '';
        forceScrollToBottom();
    }
    
    // Reset session state
    isSessionLocked = false;
    currentStreamingMessage = null;
    currentMessageId = null;
    
    vscode.postMessage({ type: 'debug', message: '✅ Chat area cleared' });
}

// Handle session created - Following TUI approach: only update session, don't clear messages
function handleSessionCreated(session) {
    vscode.postMessage({ type: 'debug', message: `🆕 Handling session created: ${session.id}` });
    
    // Add new session to available sessions (insert at the beginning)
    if (window.dropdownManager && window.dropdownManager.getAvailableSessions) {
        const sessions = window.dropdownManager.getAvailableSessions();
        sessions.unshift(session); // Insert at the beginning instead of push to end
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
    
    // TUI approach: Don't clear chat area for sessionCreated
    // Only clear for manual session creation (which should use a different event)
    
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
            const messageDiv = addMessage(message.role, message.content, message.mode || modeSelector.value, true, message.id, message.model, message.timestamp);
            
            // CRITICAL FIX: Ensure metadata is visible for completed assistant messages
            if (message.role === 'assistant' && message.completed && messageDiv) {
                const metadataDiv = messageDiv.querySelector('.message-metadata');
                if (metadataDiv) {
                    metadataDiv.style.display = 'block';
                    vscode.postMessage({ type: 'debug', message: `🔄 Restored metadata visibility for loaded message: ${message.id}` });
                }
            }
            
            // CRITICAL FIX: Handle tool-only messages during loading
            if (message.content === '[TOOL_CALLS_ONLY]' && messageDiv) {
                vscode.postMessage({ type: 'debug', message: `🔧 Tool-only message loaded: ${message.id}` });
                // Remove any generating parts that might have been created
                const generatingDiv = messageDiv.querySelector('.generating-part');
                if (generatingDiv) {
                    generatingDiv.remove();
                }
            }
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
            const messageDiv = addMessage(message.role, message.content, message.mode || modeSelector.value, true, message.id, message.model, message.timestamp);
            
            // CRITICAL FIX: Ensure metadata is visible for completed assistant messages
            if (message.role === 'assistant' && message.completed && messageDiv) {
                const metadataDiv = messageDiv.querySelector('.message-metadata');
                if (metadataDiv) {
                    metadataDiv.style.display = 'block';
                    vscode.postMessage({ type: 'debug', message: `🔄 Restored metadata visibility for loaded message: ${message.id}` });
                }
            }
            
            // CRITICAL FIX: Handle tool-only messages during loading
            if (message.content === '[TOOL_CALLS_ONLY]' && messageDiv) {
                vscode.postMessage({ type: 'debug', message: `🔧 Tool-only message loaded: ${message.id}` });
                // Remove any generating parts that might have been created
                const generatingDiv = messageDiv.querySelector('.generating-part');
                if (generatingDiv) {
                    generatingDiv.remove();
                }
            }
        });
        vscode.postMessage({ type: 'debug', message: '✅ Messages loaded successfully' });
    } else {
        vscode.postMessage({ type: 'debug', message: '📝 No messages to load for current session' });
    }
    
    // Force scroll to bottom when loading messages
    forceScrollToBottom();
    
    // Set current session data if we have messages (indicates we have an active session)
    if (messages && messages.length > 0 && window.dropdownManager && window.dropdownManager.getAvailableSessions) {
        const sessions = window.dropdownManager.getAvailableSessions();
        if (sessions.length > 0) {
            // Assume the first session is the current one if no specific session is set
            const currentSession = sessions[0];
            currentSessionData = currentSession;
            vscode.postMessage({ type: 'debug', message: `📝 Set current session data: ${currentSession.title}` });
        }
    }
    
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

// Finalize streaming message - remove streaming indicators
function finalizeStreamingMessage(messageDiv) {
    vscode.postMessage({ type: 'debug', message: '🏁 Finalizing streaming message' });
    
    // Remove streaming class
    messageDiv.classList.remove('streaming');
    
    vscode.postMessage({ type: 'debug', message: '✅ Streaming message finalized' });
}

// Add reasoning part to message (for thinking process) - Following TUI's ReasoningPart
function addReasoningPartToMessage(messageDiv, content) {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
        // Check if reasoning part already exists
        let reasoningPartDiv = contentDiv.querySelector('.reasoning-part');
        
        if (!reasoningPartDiv) {
            // Create new reasoning part container
            reasoningPartDiv = document.createElement('div');
            reasoningPartDiv.className = 'message-part reasoning-part';
            contentDiv.appendChild(reasoningPartDiv);
        }
        
        // Update the reasoning content (replace, not append)
        reasoningPartDiv.innerHTML = `
            <div class="reasoning-header">
                <strong>🧠 Thinking...</strong>
            </div>
            <div class="reasoning-content">
                <pre><code>${content}</code></pre>
            </div>
        `;
        
        smartScrollToBottom();
    }
}

function handleQueuedProcessing(message) {
    if (message.isQueued) {
        // Show queued processing indicator
        if (!currentStreamingMessage) {
            const mode = modeSelector.value || 'plan';
            const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const generatingText = `Generating...\n${mode.charAt(0).toUpperCase() + mode.slice(1)} ${modelName} (${currentTime})`;
            
            currentStreamingMessage = addMessage('assistant', generatingText, mode);
            currentMessageId = 'generating_' + Date.now();
            isSessionLocked = true; // Keep session locked for queued processing
        } else {
            // No queued messages - unlock session
            isSessionLocked = false;
        }
    }
}
