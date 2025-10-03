import * as vscode from 'vscode'
import { OpenCodeApp } from './core/app'
import { OpenCodePanel } from './components/webview/panel'

// Global variables
let outputChannel: vscode.OutputChannel
let openCodeApp: OpenCodeApp | null = null
let openCodePanel: OpenCodePanel | null = null

/**
 * Extension activation function
 */
export function activate(context: vscode.ExtensionContext) {
  // Extension activated - logging handled by individual components
  
  // Create output channel
  outputChannel = vscode.window.createOutputChannel('OpenCode Assistant')
  outputChannel.appendLine('OpenCode extension activated')

  // Register commands
  const openPanelDisposable = vscode.commands.registerCommand('opencode-new.openPanel', async () => {
    try {
      outputChannel.appendLine('Opening OpenCode panel...')
      
      // Initialize OpenCode app if not already done
      if (!openCodeApp) {
        // Get current workspace directory
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        const workspacePath = workspaceFolder?.uri.fsPath || process.cwd()
        
        outputChannel.appendLine(`📁 Current workspace: ${workspacePath}`)
        
        openCodeApp = new OpenCodeApp(outputChannel, workspacePath)
        await openCodeApp.initialize()
      }

      // Check if panel exists and is still valid
      if (openCodePanel && !openCodePanel.isDisposed()) {
        outputChannel.appendLine('👁️ Revealing existing OpenCode panel')
        openCodePanel.show()
      } else {
        outputChannel.appendLine('🆕 Creating new OpenCode panel')
        // Clear the old panel reference if it was disposed
        if (openCodePanel && openCodePanel.isDisposed()) {
          openCodePanel = null
        }
        openCodePanel = new OpenCodePanel(openCodeApp, outputChannel)
      }

      outputChannel.appendLine('✅ OpenCode panel opened successfully')
    } catch (error: any) {
      outputChannel.appendLine(`❌ Failed to open OpenCode panel: ${error.message}`)
      vscode.window.showErrorMessage(`Failed to open OpenCode panel: ${error.message}`)
    }
  })

  const refreshPanelDisposable = vscode.commands.registerCommand('opencode-new.refreshPanel', async () => {
    try {
      outputChannel.appendLine('Refreshing OpenCode panel...')
      
      if (openCodePanel) {
        // Recreate the panel to refresh it
        openCodePanel.dispose()
        if (openCodeApp) {
          openCodePanel = new OpenCodePanel(openCodeApp, outputChannel)
        }
      }

      outputChannel.appendLine('✅ OpenCode panel refreshed successfully')
    } catch (error: any) {
      outputChannel.appendLine(`❌ Failed to refresh OpenCode panel: ${error.message}`)
      vscode.window.showErrorMessage(`Failed to refresh OpenCode panel: ${error.message}`)
    }
  })

  // Add disposables to context
  context.subscriptions.push(openPanelDisposable, refreshPanelDisposable)
}

/**
 * Extension deactivation function
 */
export function deactivate() {
  // Extension deactivated - logging handled by individual components
  
  if (outputChannel) {
    outputChannel.appendLine('OpenCode extension deactivated')
  }

  // Dispose of resources
  if (openCodePanel) {
    openCodePanel.dispose()
    openCodePanel = null
  }

  if (openCodeApp) {
    openCodeApp.dispose().then(() => {
      openCodeApp = null
    })
  }
}
