import * as vscode from "vscode"
import { OpenCodeApp } from "./core/app"
import { OpenCodePanel } from "./components/webview/panel"

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
  outputChannel = vscode.window.createOutputChannel("OpenCode Assistant")
  outputChannel.appendLine("OpenCode extension activated")

  // Register commands
  const openPanelDisposable = vscode.commands.registerCommand("opencode-v2.openPanel", async () => {
    try {
      outputChannel.appendLine("Opening OpenCode panel...")

      // Initialize OpenCode app if not already done
      if (!openCodeApp) {
        // Get current workspace directory
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        const workspacePath = workspaceFolder?.uri.fsPath || process.cwd()

        outputChannel.appendLine(`📁 Workspace folder: ${workspaceFolder?.name || "none"}`)
        outputChannel.appendLine(`📁 Workspace URI: ${workspaceFolder?.uri.toString() || "none"}`)
        outputChannel.appendLine(`📁 Workspace fsPath: ${workspaceFolder?.uri.fsPath || "none"}`)
        outputChannel.appendLine(`📁 Process cwd: ${process.cwd()}`)
        outputChannel.appendLine(`📁 Final workspace path: ${workspacePath}`)

        openCodeApp = new OpenCodeApp(outputChannel, workspacePath, context)
        await openCodeApp.initialize()
      }

      // Check if panel exists and is still valid
      if (openCodePanel && !openCodePanel.isDisposed()) {
        outputChannel.appendLine("👁️ Revealing existing OpenCode panel")
        openCodePanel.show()

        // Manually trigger updateUI to ensure state is refreshed
        openCodePanel.updateUI().catch((error: any) => {
          outputChannel.appendLine(`❌ Failed to update UI: ${error.message}`)
        })
      } else {
        outputChannel.appendLine("🆕 Creating new OpenCode panel")
        // Clear the old panel reference if it was disposed
        if (openCodePanel && openCodePanel.isDisposed()) {
          openCodePanel = null
        }
        openCodePanel = new OpenCodePanel(openCodeApp, outputChannel)

        // Explicitly update UI after panel creation to ensure state is loaded
        // This addresses the "Loading..." issue where model/provider aren't yet set
        openCodePanel.updateUI().catch((error: any) => {
          outputChannel.appendLine(`❌ Failed to update UI after panel creation: ${error.message}`)
        })
      }

      outputChannel.appendLine("✅ OpenCode panel opened successfully")
    } catch (error: any) {
      outputChannel.appendLine(`❌ Failed to open OpenCode panel: ${error.message}`)
      vscode.window.showErrorMessage(`Failed to open OpenCode panel: ${error.message}`)
    }
  })

  const refreshPanelDisposable = vscode.commands.registerCommand("opencode-v2.refreshPanel", async () => {
    try {
      outputChannel.appendLine("Refreshing OpenCode panel...")

      if (openCodePanel) {
        // Recreate the panel to refresh it
        openCodePanel.dispose()
        if (openCodeApp) {
          openCodePanel = new OpenCodePanel(openCodeApp, outputChannel)
        }
      }

      outputChannel.appendLine("✅ OpenCode panel refreshed successfully")
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
    outputChannel.appendLine("OpenCode extension deactivated")
  }

  // Dispose of resources
  if (openCodePanel) {
    openCodePanel.dispose()
    openCodePanel = null
  }

  if (openCodeApp) {
    // Clean up app resources
    openCodeApp = null
  }
}
