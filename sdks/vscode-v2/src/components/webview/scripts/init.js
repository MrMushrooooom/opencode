// Initialization script for OpenCode WebView

// Initialize the application when DOM is ready
function initializeApplication() {
    console.log('Initializing OpenCode WebView Application...');
    
    // Initialize all modules
    if (typeof initializeEventListeners === 'function') {
        initializeEventListeners();
    }
    
    if (typeof initializeBuildModeListeners === 'function') {
        initializeBuildModeListeners();
    }
    
    if (typeof initializePermissionDialogListeners === 'function') {
        initializePermissionDialogListeners();
    }
    
    // Dropdown functionality is now auto-initialized in dropdown.js
    
    // Update UI state
    if (typeof updateBuildModeUI === 'function') {
        updateBuildModeUI();
    }
    
    // Request initial state and sessions
    vscode.postMessage({ type: 'getState' });
    vscode.postMessage({ type: 'getSessions' });
    
    console.log('OpenCode WebView Application initialized successfully');
}

// Start initialization when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
    initializeApplication();
}
