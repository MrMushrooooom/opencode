// BUILD Mode specific functionality

// BUILD Mode elements
const buildControls = document.getElementById('buildControls');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const fileChanges = document.getElementById('fileChanges');
const fileChangesList = document.getElementById('fileChangesList');

// Initialize BUILD mode event listeners
function initializeBuildModeListeners() {
    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'undoToMessage' });
        });
    }

    if (redoBtn) {
        redoBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'redoChanges' });
        });
    }
}

// Update undo/redo button states
function updateUndoRedoButtons(canUndo, canRedo) {
    if (undoBtn) {
        undoBtn.disabled = !canUndo;
    }
    if (redoBtn) {
        redoBtn.disabled = !canRedo;
    }
}

// Update file changes display
function updateFileChanges(changes) {
    if (!fileChangesList) return;
    
    fileChangesList.innerHTML = '';
    
    if (!changes || changes.length === 0) {
        return;
    }
    
    changes.forEach(change => {
        const changeItem = document.createElement('div');
        changeItem.className = 'file-change-item';
        
        const statusSpan = document.createElement('span');
        statusSpan.className = `file-status ${change.status}`;
        statusSpan.textContent = change.status.toUpperCase();
        
        const pathSpan = document.createElement('span');
        pathSpan.className = 'file-path';
        pathSpan.textContent = change.path;
        
        changeItem.appendChild(statusSpan);
        changeItem.appendChild(pathSpan);
        
        if (change.diff) {
            const diffToggle = document.createElement('button');
            diffToggle.className = 'file-diff-toggle';
            diffToggle.textContent = 'Show Diff';
            diffToggle.addEventListener('click', () => {
                toggleFileDiff(changeItem, change.diff);
            });
            changeItem.appendChild(diffToggle);
        }
        
        fileChangesList.appendChild(changeItem);
    });
}

// Toggle file diff display
function toggleFileDiff(changeItem, diff) {
    const existingDiff = changeItem.querySelector('.file-diff');
    
    if (existingDiff) {
        existingDiff.remove();
        return;
    }
    
    const diffDiv = document.createElement('div');
    diffDiv.className = 'file-diff';
    
    diff.forEach(line => {
        const lineDiv = document.createElement('div');
        lineDiv.className = `diff-line ${line.type}`;
        
        const lineNumber = document.createElement('span');
        lineNumber.className = 'diff-line-number';
        lineNumber.textContent = line.lineNumber || '';
        
        const lineContent = document.createElement('span');
        lineContent.textContent = line.content;
        
        lineDiv.appendChild(lineNumber);
        lineDiv.appendChild(lineContent);
        diffDiv.appendChild(lineDiv);
    });
    
    changeItem.appendChild(diffDiv);
}

// Show revert status (TUI-style)
function showRevertStatus(revertInfo) {
    const revertDiv = document.createElement('div');
    revertDiv.className = 'revert-status';
    
    let content = `${revertInfo.messageCount} message${revertInfo.messageCount !== 1 ? 's' : ''} reverted`;
    if (revertInfo.toolCount > 0) {
        content += `, ${revertInfo.toolCount} tool call${revertInfo.toolCount !== 1 ? 's' : ''} reverted`;
    }
    
    const statusText = document.createElement('div');
    statusText.className = 'status-text';
    statusText.textContent = content;
    revertDiv.appendChild(statusText);
    
    const hintText = document.createElement('div');
    hintText.className = 'hint-text';
    hintText.textContent = 'Type /redo to restore';
    revertDiv.appendChild(hintText);
    
    chatArea.appendChild(revertDiv);
    smartScrollToBottom();
}

// Initialize BUILD mode when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBuildModeListeners);
} else {
    initializeBuildModeListeners();
}
