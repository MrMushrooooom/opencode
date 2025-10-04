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

// Handle permission request
function handlePermissionRequest(permission) {
    vscode.postMessage({ type: 'debug', message: `🔐 Handling permission request: ${JSON.stringify(permission)}` });
    
    // Find the current streaming message to add permission request inline
    if (currentStreamingMessage) {
        addInlinePermissionRequest(currentStreamingMessage, permission);
    } else {
        vscode.postMessage({ type: 'debug', message: '⚠️ No current streaming message found for permission request' });
    }
}

// Update message metadata (model, timestamp, etc.)
function updateMessageMetadata(messageDiv, messageInfo) {
    const metadataDiv = messageDiv.querySelector('.message-metadata');
    if (metadataDiv && messageInfo.role === 'assistant') {
        // Update model and timestamp information
        const modeText = modeSelector.value ? modeSelector.value.charAt(0).toUpperCase() + modeSelector.value.slice(1) : 'Plan';
        const modelName = messageInfo.modelID || (window.currentModelData ? window.currentModelData.id : 'Loading...');
        const time = messageInfo.time?.created ? new Date(messageInfo.time.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        metadataDiv.textContent = `${modeText} ${modelName} (${time})`;
        
        vscode.postMessage({ type: 'debug', message: `🔄 Updated metadata for message: ${messageInfo.id}` });
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
                // Create assistant message with empty content initially
                const assistantMessageDiv = addMessage('assistant', '', modeSelector.value, false, messageInfo.id, messageInfo.modelID, messageInfo.time?.created);
                
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
            } else if (messageInfo.role === 'user') {
                // User messages are usually created immediately when sent
                vscode.postMessage({ type: 'debug', message: `👤 User message already created: ${messageInfo.id}` });
            }
        }
    } else {
        vscode.postMessage({ type: 'debug', message: `⚠️ MessageInfo is null` });
    }
}

// Add inline permission request to message - TUI-style integration
function addInlinePermissionRequest(messageDiv, permission) {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (!contentDiv) return;
    
    // Create permission request container
    const permissionDiv = document.createElement('div');
    permissionDiv.className = 'permission-request';
    permissionDiv.setAttribute('data-permission-id', permission.id);
    
    // Create permission content
    const permissionContent = document.createElement('div');
    permissionContent.className = 'permission-content';
    
    // Permission description
    const descriptionDiv = document.createElement('div');
    descriptionDiv.className = 'permission-description';
    descriptionDiv.textContent = 'Permission required to run this tool:';
    
    // Permission metadata (tool details)
    const metadataDiv = document.createElement('div');
    metadataDiv.className = 'permission-metadata';
    metadataDiv.textContent = formatPermissionMetadata(permission);
    
    // Permission actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'permission-actions';
    
    // Accept Once button
    const acceptOnceBtn = document.createElement('button');
    acceptOnceBtn.className = 'permission-btn accept-once';
    acceptOnceBtn.textContent = 'Accept';
    acceptOnceBtn.addEventListener('click', () => respondToPermission(permission.id, 'once'));
    
    // Accept Always button
    const acceptAlwaysBtn = document.createElement('button');
    acceptAlwaysBtn.className = 'permission-btn accept-always';
    acceptAlwaysBtn.textContent = 'Accept Always';
    acceptAlwaysBtn.addEventListener('click', () => respondToPermission(permission.id, 'always'));
    
    // Reject button
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'permission-btn reject';
    rejectBtn.textContent = 'Reject';
    rejectBtn.addEventListener('click', () => respondToPermission(permission.id, 'reject'));
    
    // Assemble the permission request
    actionsDiv.appendChild(acceptOnceBtn);
    actionsDiv.appendChild(acceptAlwaysBtn);
    actionsDiv.appendChild(rejectBtn);
    
    permissionContent.appendChild(descriptionDiv);
    permissionContent.appendChild(metadataDiv);
    permissionContent.appendChild(actionsDiv);
    
    permissionDiv.appendChild(permissionContent);
    
    // Insert permission request after the message content
    contentDiv.appendChild(permissionDiv);
    
    vscode.postMessage({ type: 'debug', message: '✅ Inline permission request UI added to message' });
}

// Format permission metadata for display
function formatPermissionMetadata(permission) {
    let metadata = '';
    
    if (permission.metadata) {
        if (permission.metadata.tool) {
            metadata += `Tool: ${permission.metadata.tool}\n`;
        }
        if (permission.metadata.filePath) {
            metadata += `File: ${permission.metadata.filePath}\n`;
        }
        if (permission.metadata.command) {
            metadata += `Command: ${permission.metadata.command}\n`;
        }
        if (permission.metadata.url) {
            metadata += `URL: ${permission.metadata.url}\n`;
        }
        if (permission.metadata.description) {
            metadata += `Description: ${permission.metadata.description}\n`;
        }
    }
    
    return metadata || 'No additional details available';
}

// Respond to permission request
function respondToPermission(permissionId, response) {
    vscode.postMessage({ type: 'debug', message: `🔐 Responding to permission ${permissionId} with: ${response}` });
    
    // Send response to backend
    vscode.postMessage({
        type: 'respondToPermission',
        permissionId: permissionId,
        response: response
    });
    
    // Remove permission request UI
    const permissionDiv = document.querySelector(`[data-permission-id="${permissionId}"]`);
    if (permissionDiv) {
        permissionDiv.remove();
        vscode.postMessage({ type: 'debug', message: '✅ Permission request UI removed' });
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
    } else if (partType === 'tool') {
        vscode.postMessage({ type: 'debug', message: `🔧 Processing tool call for messageId: ${messageId}` });
        
        // Following TUI approach: find the specific message by ID
        const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        if (targetMessage) {
            addToolPartToMessage(targetMessage, content);
        }
        
        // Tool calls might trigger permission requests
        // We'll wait for the backend to send permission requests
        
    } else if (partType === 'tool-result' || partType === 'tool-completed') {
        vscode.postMessage({ type: 'debug', message: `🔧 Processing tool result for messageId: ${messageId}` });
        
        // Following TUI approach: find the specific message by ID
        const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        if (targetMessage) {
            const toolResult = content || 'Tool executed successfully';
            updateToolPartInMessage(targetMessage, toolResult);
        }
        
    } else if (partType === 'tool-updated') {
        vscode.postMessage({ type: 'debug', message: `🔧 Processing tool update for messageId: ${messageId}` });
        
        // Following TUI approach: find the specific message by ID
        const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        if (targetMessage && message.toolState) {
            const { status, output, title } = message.toolState;
            if (status === 'completed' && output) {
                updateToolPartInMessage(targetMessage, output, title);
            } else if (status === 'error') {
                updateToolPartInMessage(targetMessage, null, title, message.toolState.error);
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
        // Streaming complete - Following TUI approach
        // The server processes all queued messages and returns a single unified response
        if (currentStreamingMessage) {
            // Only finalize if we haven't already done so
            if (currentStreamingMessage.classList.contains('streaming')) {
                vscode.postMessage({ type: 'debug', message: '🏁 Finalizing streaming message on step-finish' });
                finalizeStreamingMessage(currentStreamingMessage);
            }
        }
        
        // Check if there are queued messages that need processing BEFORE clearing them
        const queuedTags = document.querySelectorAll('.queued-tag');
        const hasQueuedMessages = queuedTags.length > 0;
        
        // Clear all QUEUED tags since they all get the same response
        queuedTags.forEach(tag => tag.remove());
        
        // Following TUI approach: don't create new messages here
        // Wait for server to send EventMessageUpdated for queued messages
        // Just unlock session if no more messages are being processed
        isSessionLocked = false;
        status.textContent = 'Ready';
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
        
        // CRITICAL FIX: Update the content (replace, not append) - Following TUI approach
        // The server sends complete accumulated text each time, so we should replace the entire content
        // Only replace if we have actual content (not empty or just whitespace)
        if (content && content.trim() !== '') {
            textPartDiv.innerHTML = renderMarkdown(content);
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

// Add or update tool part to message (for tool execution results) - TUI-style with state visualization
function addToolPartToMessage(messageDiv, content, toolState) {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
        // Get message ID for parts tracking
        const messageId = messageDiv.getAttribute('data-message-id');
        
        // Check if tool part already exists
        let toolPartDiv = contentDiv.querySelector('.tool-part');
        
        if (!toolPartDiv) {
            // Create new tool part container
            toolPartDiv = document.createElement('div');
            toolPartDiv.className = 'message-part tool-part';
            toolPartDiv.setAttribute('data-part-id', `tool_${Date.now()}`);
            contentDiv.appendChild(toolPartDiv);
            
            // Track this part in messageParts
            if (messageId && window.messageParts) {
                const parts = window.messageParts.get(messageId) || [];
                parts.push({
                    type: 'tool',
                    id: toolPartDiv.getAttribute('data-part-id'),
                    content: content
                });
                window.messageParts.set(messageId, parts);
            }
        }
        
        // Parse tool content to extract tool name and output
        const lines = content.split('\n');
        let toolName = 'Tool';
        let toolOutput = content;
        
        // Try to extract tool name from content
        if (lines.length > 0 && lines[0].includes('**')) {
            const match = lines[0].match(/\*\*(.*?)\*\*/);
            if (match) {
                toolName = match[1];
                toolOutput = lines.slice(2).join('\n'); // Skip tool name and empty line
            }
        }
        
        // Determine tool state and styling
        const state = toolState?.status || 'pending';
        const stateClass = `tool-state-${state}`;
        
        // Update the tool part HTML with state visualization
        toolPartDiv.innerHTML = `
            <div class="tool-header ${stateClass}">
                <strong>${toolName}</strong>
                <span class="tool-state-indicator">${getToolStateIndicator(state)}</span>
            </div>
            <div class="tool-output ${stateClass}">
                ${getToolOutputContent(toolOutput, state, toolState)}
            </div>
        `;
        
        // Update the part in messageParts
        if (messageId && window.messageParts) {
            const parts = window.messageParts.get(messageId) || [];
            const partIndex = parts.findIndex(p => p.id === toolPartDiv.getAttribute('data-part-id'));
            if (partIndex !== -1) {
                parts[partIndex].content = content;
                window.messageParts.set(messageId, parts);
            }
        }
        
        smartScrollToBottom();
    }
}

// Get tool state indicator - TUI-style visual indicators
function getToolStateIndicator(state) {
    switch (state) {
        case 'pending':
            return '⏳ Pending';
        case 'running':
            return '🔄 Running';
        case 'completed':
            return '✅ Completed';
        case 'error':
            return '❌ Error';
        default:
            return '⏳ Pending';
    }
}

// Get tool output content based on state
function getToolOutputContent(output, state, toolState) {
    switch (state) {
        case 'pending':
            return '<pre><code>Waiting for execution...</code></pre>';
        case 'running':
            return '<pre><code>Executing...</code></pre>';
        case 'completed':
            return `<pre><code>${output}</code></pre>`;
        case 'error':
            const error = toolState?.error || output || 'Unknown error';
            return `<pre><code class="error">❌ ${error}</code></pre>`;
        default:
            return `<pre><code>${output}</code></pre>`;
    }
}

// Update tool part in message
function updateToolPartInMessage(messageDiv, output, title, error) {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
        const toolPartDiv = contentDiv.querySelector('.tool-part');
        if (toolPartDiv) {
            const toolOutputDiv = toolPartDiv.querySelector('.tool-output');
            if (toolOutputDiv) {
                if (error) {
                    toolOutputDiv.innerHTML = `<pre><code class="error">❌ ${title || 'Tool'} error: ${error}</code></pre>`;
                } else if (output) {
                    toolOutputDiv.innerHTML = `<pre><code>${output}</code></pre>`;
                }
            }
        }
        smartScrollToBottom();
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


// Handle streaming complete
function handleStreamingComplete(message) {
    vscode.postMessage({ type: 'debug', message: `🏁 Handling streaming complete for message: ${message?.messageId || 'unknown'}` });
    
    if (currentStreamingMessage) {
        finalizeStreamingMessage(currentStreamingMessage);
        vscode.postMessage({ type: 'debug', message: `🏁 Finalized streaming message: ${currentMessageId}` });
        currentStreamingMessage = null;
        currentMessageId = null;
    }
    
    // Check if there are any queued messages
    const queuedMessages = document.querySelectorAll('.queued-status');
    if (queuedMessages.length > 0) {
        // There are still queued messages, keep session locked
        vscode.postMessage({ type: 'debug', message: `🔄 Streaming complete but ${queuedMessages.length} messages still queued` });
    } else {
        // No queued messages, unlock session
        isSessionLocked = false;
        status.textContent = 'Ready';
        vscode.postMessage({ type: 'debug', message: '🔓 Session unlocked - no more queued messages' });
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
            addMessage(message.role, message.content, message.mode || modeSelector.value, true, message.id, message.model, message.timestamp); // Force scroll for loaded messages
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
            addMessage(message.role, message.content, message.mode || modeSelector.value, true, message.id, message.model, message.timestamp); // Force scroll for loaded messages
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
