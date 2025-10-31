import * as vscode from 'vscode'
import { createOpencodeServer } from '@opencode-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'

/**
 * OpenCode Server Manager
 * Handles server startup, port detection, and lifecycle management
 */
export class ServerManager {
  private server: any = null
  private serverPort: number | null = null
  private serverURL: string | null = null
  private outputChannel: vscode.OutputChannel
  private isStarting = false

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel
  }


  /**
   * Start OpenCode server
   */
  async startServer(workspacePath?: string): Promise<string> {
    if (this.isStarting) {
      throw new Error('Server is already starting')
    }

    if (this.server) {
      this.outputChannel.appendLine('⚠️ OpenCode server is already running')
      return this.serverURL!
    }

    try {
      this.isStarting = true
      this.outputChannel.appendLine('🚀 Starting OpenCode server...')
      
      // Load OpenCode configuration
      const sdkConfig = this.loadOpenCodeConfig()
      
      // Set workspace path in environment for project context detection
      const serverEnv = {
        ...process.env,
        PWD: workspacePath, // Workspace path for detection
        OPENCODE_WORKSPACE: workspacePath // Workspace path for detection
      }
      
      this.server = await createOpencodeServer({
        port: 0, // Let the system assign a port
        timeout: 15000, // 15 second timeout
        config: sdkConfig, // Pass converted configuration for server initialization
        env: serverEnv // Pass environment with workspace path
      })

      // Store the exact server URL
      this.serverURL = this.server.url
      this.outputChannel.appendLine(`🔍 Server URL: ${this.serverURL}`)
      const url = new URL(this.serverURL)
      this.serverPort = parseInt(url.port)
      
      this.outputChannel.appendLine(`✅ OpenCode server started on port: ${this.serverPort}`)
      this.outputChannel.appendLine(`🔍 Full server URL: ${this.serverURL}`)

      // Test server health - try multiple endpoints
      try {
        // Try /health endpoint first
        this.outputChannel.appendLine(`🔍 Testing server health at: ${this.serverURL}/health`)
        const healthResponse = await fetch(`${this.serverURL}/health`)
        this.outputChannel.appendLine(`✅ Server health check: ${healthResponse.status}`)
        
        // Try /app/providers endpoint to test if server is actually working
        this.outputChannel.appendLine(`🔍 Testing server functionality at: ${this.serverURL}/app/providers`)
        const providersResponse = await fetch(`${this.serverURL}/app/providers`)
        this.outputChannel.appendLine(`✅ Server providers check: ${providersResponse.status}`)
        
        if (providersResponse.ok) {
          this.outputChannel.appendLine(`✅ Server is responding correctly`)
        } else {
          this.outputChannel.appendLine(`⚠️ Server responded with status: ${providersResponse.status}`)
        }
      } catch (error) {
        this.outputChannel.appendLine(`❌ Server health check failed: ${error}`)
        this.outputChannel.appendLine(`🔍 This indicates the server may not be running properly`)
      }

      // Wait for models to load (server needs to fetch from models.dev)
      this.outputChannel.appendLine(`⏳ Waiting for models to load...`)
      await this.waitForModelsToLoad()

      this.isStarting = false
      return this.serverURL

    } catch (error: any) {
      this.isStarting = false
      this.outputChannel.appendLine(`❌ Failed to start OpenCode server: ${error.message}`)
      this.outputChannel.appendLine(`❌ Error stack: ${error.stack}`)
      throw error
    }
  }

  /**
   * Stop OpenCode server
   */
  async stopServer(): Promise<void> {
    if (this.server) {
      try {
        this.outputChannel.appendLine('🛑 Stopping OpenCode server...')
        this.server.close()
        this.server = null
        this.serverPort = null
        this.serverURL = null
        this.outputChannel.appendLine('✅ OpenCode server stopped')
      } catch (error: any) {
        this.outputChannel.appendLine(`❌ Failed to stop OpenCode server: ${error.message}`)
        throw error
      }
    }
  }

  /**
   * Get server port
   */
  getServerPort(): number | null {
    return this.serverPort
  }

  /**
   * Get server URL
   */
  getServerURL(): string | null {
    return this.serverURL
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.server !== null
  }

  /**
   * Wait for models to load from models.dev
   */
  private async waitForModelsToLoad(): Promise<void> {
    const maxAttempts = 5
    const delayMs = 2000
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.outputChannel.appendLine(`🔍 Checking models availability (attempt ${attempt}/${maxAttempts})...`)
        
        // Test the providers endpoint
        const response = await fetch(`${this.serverURL}/config/providers`)
        if (response.ok) {
          const data = await response.json()
          const providerCount = data.providers?.length || 0
          
          this.outputChannel.appendLine(`📊 Server response: ${providerCount} providers available`)
          
          if (providerCount > 0) {
            this.outputChannel.appendLine(`✅ Models loaded successfully! Found ${providerCount} providers`)
            // Log some model details for debugging
            data.providers.forEach((provider: any) => {
              const modelCount = Object.keys(provider.models || {}).length
              this.outputChannel.appendLine(`  📋 Provider: ${provider.name} (${provider.id}) - ${modelCount} models`)
            })
            return
          } else {
            this.outputChannel.appendLine(`⏳ Models not ready yet (${providerCount} providers), waiting...`)
          }
        } else {
          this.outputChannel.appendLine(`⚠️ Providers endpoint returned ${response.status}, waiting...`)
        }
      } catch (error) {
        this.outputChannel.appendLine(`⚠️ Failed to check models (attempt ${attempt}): ${error}`)
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
    
    this.outputChannel.appendLine(`⚠️ Models loading timeout after ${maxAttempts} attempts`)
  }

  /**
   * Load OpenCode configuration from user's local config
   */
  private loadOpenCodeConfig(): any {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE
      if (!homeDir) {
        this.outputChannel.appendLine(`❌ No home directory found`)
        return {}
      }

      // Check multiple possible config locations
      const configPaths = [
        path.join(homeDir, '.opencode', 'auth.json'),
        path.join(homeDir, '.local', 'share', 'opencode', 'auth.json'),
        path.join(homeDir, '.config', 'opencode', 'auth.json')
      ]

      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          this.outputChannel.appendLine(`🔍 Found config at: ${configPath}`)
          const configContent = fs.readFileSync(configPath, 'utf8')
          const authInfo = JSON.parse(configContent)
          
          // Convert to server configuration format
          const sdkConfig: any = {
            provider: {}
          }

          // Handle Anthropic API key
          if (authInfo.anthropic?.key) {
            sdkConfig.provider.anthropic = {
              options: {
                apiKey: authInfo.anthropic.key
              }
            }
          }

          // Handle OpenCode API key
          if (authInfo.opencode?.key) {
            sdkConfig.provider.opencode = {
              options: {
                apiKey: authInfo.opencode.key
              }
            }
          }
          
          this.outputChannel.appendLine(`✅ Loaded OpenCode configuration`)
          return sdkConfig
        }
      }

      this.outputChannel.appendLine(`⚠️ No OpenCode configuration found`)
      return {}
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to load OpenCode config: ${error.message}`)
      return {}
    }
  }
}
