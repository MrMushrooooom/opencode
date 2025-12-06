import * as vscode from "vscode"
import { createOpencodeServer } from "@opencode-ai/sdk"
import * as fs from "fs"
import * as path from "path"
import { spawn } from "node:child_process"

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
      throw new Error("Server is already starting")
    }

    if (this.server) {
      this.outputChannel.appendLine("⚠️ OpenCode server is already running")
      return this.serverURL!
    }

    try {
      this.isStarting = true
      this.outputChannel.appendLine("🚀 Starting OpenCode server...")

      // Ensure workspacePath is provided
      if (!workspacePath) {
        throw new Error("workspacePath is required to start the server")
      }

      this.outputChannel.appendLine(`📁 Expected workspace path: ${workspacePath}`)
      this.outputChannel.appendLine(`📁 Plugin process.cwd(): ${process.cwd()}`)

      // Load OpenCode configuration
      const sdkConfig = this.loadOpenCodeConfig()

      // Use SDK's createOpencodeServer but with cwd support
      // Since SDK doesn't support cwd option, we replicate its logic but add cwd
      this.server = await this.createServerWithCwd(workspacePath, sdkConfig)

      // Store the exact server URL
      this.serverURL = this.server.url
      if (!this.serverURL) {
        throw new Error("Server URL is null")
      }
      this.outputChannel.appendLine(`🔍 Server URL: ${this.serverURL}`)
      const url = new URL(this.serverURL)
      const port = url.port
      this.serverPort = parseInt(port ? String(port) : "0", 10)

      this.outputChannel.appendLine(`✅ OpenCode server started on port: ${this.serverPort}`)
      this.outputChannel.appendLine(`🔍 Full server URL: ${this.serverURL}`)

      // Check what directory the server is actually using
      try {
        this.outputChannel.appendLine(`🔍 Checking server's actual working directory...`)
        const currentProjectResponse = await fetch(`${this.serverURL}/project/current`)
        if (currentProjectResponse.ok) {
          const currentProject = await currentProjectResponse.json()
          this.outputChannel.appendLine(`📁 Server's current project worktree: ${currentProject.worktree || "unknown"}`)
          this.outputChannel.appendLine(`📁 Expected workspace path: ${workspacePath}`)
          if (currentProject.worktree !== workspacePath) {
            this.outputChannel.appendLine(`⚠️ WARNING: Server's worktree (${currentProject.worktree}) doesn't match expected workspace path (${workspacePath})`)
          } else {
            this.outputChannel.appendLine(`✅ Server's worktree matches expected workspace path`)
          }
        } else {
          this.outputChannel.appendLine(`⚠️ Failed to get server's current project: ${currentProjectResponse.status}`)
        }
      } catch (error: any) {
        this.outputChannel.appendLine(`⚠️ Error checking server's working directory: ${error.message}`)
      }

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
      if (!this.serverURL) {
        throw new Error("Server URL is null")
      }
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
      const portToRelease = this.serverPort
      try {
        this.outputChannel.appendLine(`🛑 Stopping OpenCode server on port ${portToRelease}...`)
        this.server.close()
        await new Promise((resolve) => setTimeout(resolve, 1000))
        
        this.server = null
        this.serverPort = null
        this.serverURL = null
        this.outputChannel.appendLine(`✅ OpenCode server stopped and port ${portToRelease} released`)
      } catch (error: any) {
        this.outputChannel.appendLine(`❌ Failed to stop OpenCode server: ${error.message}`)
        this.server = null
        this.serverPort = null
        this.serverURL = null
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
          const data = (await response.json()) as any
          const providerCount = (data?.providers as any[])?.length || 0

          this.outputChannel.appendLine(`📊 Server response: ${providerCount} providers available`)

          if (providerCount > 0) {
            this.outputChannel.appendLine(`✅ Models loaded successfully! Found ${providerCount} providers`)
            // Log some model details for debugging
            ;(data?.providers as any[]).forEach((provider: any) => {
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
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    this.outputChannel.appendLine(`⚠️ Models loading timeout after ${maxAttempts} attempts`)
  }

  /**
   * Create server with cwd by replicating SDK's logic but adding cwd support
   * 
   * NOTE: SDK's createOpencodeServer doesn't support cwd option, but we need
   * to ensure process.cwd() is correct in the server process so that desktop app's
   * API calls (project.list, project.current) work correctly.
   * 
   * This replicates packages/sdk/js/src/server.ts:createOpencodeServer but adds cwd.
   * If SDK adds cwd support in the future, we should switch back to using SDK directly.
   */
  private async createServerWithCwd(workspacePath: string, config: any): Promise<{ url: string; close: () => void }> {
    const hostname = "127.0.0.1"
    const port = 0
    const timeout = 15000

    const proc = spawn(`opencode`, [`serve`, `--hostname=${hostname}`, `--port=${port}`], {
      cwd: workspacePath, // This is the key: set cwd for spawned process
      env: {
        ...process.env,
        OPENCODE_CONFIG_CONTENT: JSON.stringify(config ?? {}),
      },
    })

    const url = await new Promise<string>((resolve, reject) => {
      const id = setTimeout(() => {
        reject(new Error(`Timeout waiting for server to start after ${timeout}ms`))
      }, timeout)
      let output = ""
      proc.stdout?.on("data", (chunk) => {
        output += chunk.toString()
        const lines = output.split("\n")
        for (const line of lines) {
          if (line.startsWith("opencode server listening")) {
            const match = line.match(/on\s+(https?:\/\/[^\s]+)/)
            if (!match) {
              throw new Error(`Failed to parse server url from output: ${line}`)
            }
            clearTimeout(id)
            resolve(match[1]!)
            return
          }
        }
      })
      proc.stderr?.on("data", (chunk) => {
        output += chunk.toString()
      })
      proc.on("exit", (code) => {
        clearTimeout(id)
        let msg = `Server exited with code ${code}`
        if (output.trim()) {
          msg += `\nServer output: ${output}`
        }
        reject(new Error(msg))
      })
      proc.on("error", (error) => {
        clearTimeout(id)
        reject(error)
      })
    })

    return {
      url,
      close() {
        proc.kill("SIGTERM")
        setTimeout(() => {
          if (!proc.killed && proc.exitCode === null) {
            proc.kill("SIGKILL")
          }
        }, 1000)
      },
    }
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
        path.join(homeDir, ".opencode", "auth.json"),
        path.join(homeDir, ".local", "share", "opencode", "auth.json"),
        path.join(homeDir, ".config", "opencode", "auth.json"),
      ]

      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          this.outputChannel.appendLine(`🔍 Found config at: ${configPath}`)
          const configContent = fs.readFileSync(configPath, "utf8")
          const authInfo = JSON.parse(configContent)

          // Convert to server configuration format
          const sdkConfig: any = {
            provider: {},
          }

          // Handle Anthropic API key
          if (authInfo.anthropic?.key) {
            sdkConfig.provider.anthropic = {
              options: {
                apiKey: authInfo.anthropic.key,
              },
            }
          }

          // Handle OpenCode API key
          if (authInfo.opencode?.key) {
            sdkConfig.provider.opencode = {
              options: {
                apiKey: authInfo.opencode.key,
              },
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
