// Dropdown functionality for model and session selectors

// Debug: Script loaded
if (typeof vscode !== 'undefined') {
    vscode.postMessage({ type: 'debug', message: 'dropdown.js script loaded' });
}

// Global variables for dropdown state
let availableModels = [];
let availableSessions = [];
let currentModelData = null;
let currentSessionData = null;
let currentDropdownCloseHandler = null;
let currentSessionCloseHandler = null;

// Initialize dropdown functionality
function initializeDropdowns() {
    vscode.postMessage({ type: 'debug', message: 'Initializing dropdown functionality...' });
    const currentModel = document.getElementById('currentModel');
    const currentSession = document.getElementById('currentSession');
    
    vscode.postMessage({ type: 'debug', message: `Found elements: currentModel=${!!currentModel}, currentSession=${!!currentSession}` });
    
    if (!currentModel || !currentSession) {
        vscode.postMessage({ type: 'debug', message: 'ERROR: Model or session selector not found' });
        return;
    }
    
    // Handle model selector click
    currentModel.addEventListener('click', (e) => {
        vscode.postMessage({ type: 'debug', message: 'Model selector clicked' });
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
        vscode.postMessage({ type: 'debug', message: 'Session selector clicked' });
        e.stopPropagation();
        // Toggle dropdown - if already open, close it; if closed, open it
        const existingDropdown = document.querySelector('.session-dropdown');
        if (existingDropdown) {
            closeSessionDropdown();
        } else {
            showSessionDropdown();
        }
    });
}

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
    const currentModel = document.getElementById('currentModel');
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
    option.innerHTML = `
        <span>${model.name}</span>
        <span class="model-provider">${model.providerId}</span>
    `;
    
    option.addEventListener('click', () => {
        selectModel(model);
        closeModelDropdown();
    });
    
    return option;
}

function selectModel(model) {
    currentModelData = model;
    const currentModel = document.getElementById('currentModel');
    currentModel.textContent = model.name;
    
    // Send model switch request to extension
    vscode.postMessage({
        type: 'switchModel',
        providerId: model.providerId,
        modelId: model.id
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
    
    // Add new session option at the top
    const newSessionOption = document.createElement('div');
    newSessionOption.className = 'session-option new-session';
    newSessionOption.innerHTML = '<span>+ New Session</span>';
    newSessionOption.addEventListener('click', () => {
        createNewSession();
        closeSessionDropdown();
    });
    dropdown.appendChild(newSessionOption);
    
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
    
    // Position dropdown above the session selector
    const currentSession = document.getElementById('currentSession');
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
        
        // Don't close if clicking on session edit input
        if (e.target.classList && e.target.classList.contains('session-edit-input')) {
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
    option.dataset.sessionId = session.id;
    
    // Check if this is the current session
    const isCurrentSession = currentSessionData?.id === session.id;
    
    option.innerHTML = `
        <div class="session-content">
            <span class="session-title">${session.title}</span>
            <div class="session-badges">
                ${isCurrentSession ? '<span class="session-current">Current</span>' : ''}
                ${session.isDefault ? '<span class="session-type">Default</span>' : ''}
            </div>
        </div>
         <div class="session-actions" style="display: none;">
             <button class="session-edit-btn" title="Edit session name">
                 <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                     <path d="M8.5 1.5L10.5 3.5L3.5 10.5H1.5V8.5L8.5 1.5Z" stroke="currentColor" stroke-width="1" fill="none"/>
                 </svg>
             </button>
             ${!isCurrentSession ? '<button class="session-delete-btn" title="Delete session"><svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1"/></svg></button>' : ''}
         </div>
    `;
    
    // Add hover effects
    option.addEventListener('mouseenter', () => {
        const actions = option.querySelector('.session-actions');
        if (actions) {
            actions.style.display = 'flex';
        }
    });
    
    option.addEventListener('mouseleave', () => {
        const actions = option.querySelector('.session-actions');
        if (actions) {
            actions.style.display = 'none';
        }
    });
    
    // Add click handler for session selection
    option.addEventListener('click', (e) => {
        // Don't trigger if clicking on action buttons
        if (e.target.closest('.session-actions')) {
            return;
        }
        selectSession(session);
        closeSessionDropdown();
    });
    
    // Add edit button handler
    const editBtn = option.querySelector('.session-edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editSessionTitle(session, option);
        });
    }
    
    // Add delete button handler
    const deleteBtn = option.querySelector('.session-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSession(session);
        });
    }
    
    return option;
}

function selectSession(session) {
    currentSessionData = session;
    const currentSession = document.getElementById('currentSession');
    currentSession.textContent = session.title;
    
    // Send session switch request to extension
    vscode.postMessage({
        type: 'switchSession',
        sessionId: session.id
    });
}

function editSessionTitle(session, optionElement) {
    const titleSpan = optionElement.querySelector('.session-title');
    const currentTitle = titleSpan.textContent;
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'session-edit-input';
    input.value = currentTitle;
    input.style.width = '100%';
    
    // Replace title with input
    titleSpan.style.display = 'none';
    titleSpan.parentNode.insertBefore(input, titleSpan);
    
    // Focus and select text
    input.focus();
    input.select();
    
    // Handle save on Enter or blur
    const saveEdit = () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            // Send update request to extension
            vscode.postMessage({
                type: 'updateSession',
                sessionId: session.id,
                updates: { title: newTitle }
            });
        }
        
        // Restore title display
        titleSpan.textContent = newTitle || currentTitle;
        titleSpan.style.display = '';
        input.remove();
    };
    
    // Handle cancel on Escape
    const cancelEdit = () => {
        titleSpan.style.display = '';
        input.remove();
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
}

function deleteSession(session) {
    if (confirm(`Are you sure you want to delete session "${session.title}"?`)) {
        // Send delete request to extension
        vscode.postMessage({
            type: 'deleteSession',
            sessionId: session.id
        });
    }
}

function createNewSession() {
    // Send create new session request to extension
    vscode.postMessage({
        type: 'createSession'
    });
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

// Update functions for external use
function updateAvailableModels(models) {
    availableModels = models;
}

function updateAvailableSessions(sessions) {
    availableSessions = sessions;
}

function updateCurrentModel(model) {
    currentModelData = model;
    const currentModel = document.getElementById('currentModel');
    if (currentModel && model) {
        currentModel.textContent = model.name;
    }
}

function updateCurrentSession(session) {
    currentSessionData = session;
    const currentSession = document.getElementById('currentSession');
    if (currentSession && session) {
        currentSession.textContent = session.title;
    }
}

// Export functions for use in other scripts
window.dropdownManager = {
    initializeDropdowns,
    updateAvailableModels,
    updateAvailableSessions,
    updateCurrentModel,
    updateCurrentSession,
    closeModelDropdown,
    closeSessionDropdown
};

// Debug: dropdownManager exported
if (typeof vscode !== 'undefined') {
    vscode.postMessage({ type: 'debug', message: 'dropdownManager exported to window' });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        vscode.postMessage({ type: 'debug', message: 'Auto-initializing dropdowns on DOMContentLoaded' });
        initializeDropdowns();
    });
} else {
    vscode.postMessage({ type: 'debug', message: 'Auto-initializing dropdowns immediately' });
    initializeDropdowns();
}
