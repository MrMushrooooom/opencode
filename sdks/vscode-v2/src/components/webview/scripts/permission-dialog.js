// Permission dialog functionality

// Permission dialog elements
const permissionDialog = document.getElementById('permissionDialog');
const permissionHeader = document.getElementById('permissionHeader');
const permissionDescription = document.getElementById('permissionDescription');
const permissionMetadata = document.getElementById('permissionMetadata');
const permissionAccept = document.getElementById('permissionAccept');
const permissionAlways = document.getElementById('permissionAlways');
const permissionReject = document.getElementById('permissionReject');

// Current permission being processed
let currentPermission = null;

// Initialize permission dialog event listeners
function initializePermissionDialogListeners() {
    if (permissionAccept) {
        permissionAccept.addEventListener('click', () => {
            respondToPermission('once');
        });
    }

    if (permissionAlways) {
        permissionAlways.addEventListener('click', () => {
            respondToPermission('always');
        });
    }

    if (permissionReject) {
        permissionReject.addEventListener('click', () => {
            respondToPermission('reject');
        });
    }

    // Close dialog when clicking outside
    if (permissionDialog) {
        permissionDialog.addEventListener('click', (e) => {
            if (e.target === permissionDialog) {
                hidePermissionDialog();
            }
        });
    }

    // Close dialog with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && permissionDialog && permissionDialog.classList.contains('active')) {
            hidePermissionDialog();
        }
    });
}

// Respond to permission request
function respondToPermission(response) {
    if (currentPermission) {
        vscode.postMessage({
            type: 'respondToPermission',
            response: response
        });
        hidePermissionDialog();
    }
}

// Show permission request dialog
function showPermissionDialog(permission) {
    currentPermission = permission;
    
    if (permissionHeader) {
        permissionHeader.textContent = `Permission Required: ${permission.type}`;
    }
    
    if (permissionDescription) {
        permissionDescription.textContent = permission.description || 'The AI is requesting permission to perform an action.';
    }
    
    if (permissionMetadata) {
        if (permission.metadata) {
            permissionMetadata.textContent = JSON.stringify(permission.metadata, null, 2);
            permissionMetadata.style.display = 'block';
        } else {
            permissionMetadata.style.display = 'none';
        }
    }
    
    if (permissionDialog) {
        permissionDialog.classList.add('active');
    }
    
    // Add type-specific styling
    if (permissionDialog) {
        permissionDialog.className = `permission-dialog active permission-type-${permission.type}`;
    }
}

// Hide permission dialog
function hidePermissionDialog() {
    if (permissionDialog) {
        permissionDialog.classList.remove('active');
        // Remove type-specific styling
        permissionDialog.className = 'permission-dialog';
    }
    currentPermission = null;
}

// Initialize permission dialog when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePermissionDialogListeners);
} else {
    initializePermissionDialogListeners();
}
