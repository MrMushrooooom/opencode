import * as vscode from 'vscode'
import { createOpencodeServer } from '@opencode-ai/sdk'
import { ConfigManager } from '../core/config'
import { NetworkManager } from '../core/network'

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
  private configManager: ConfigManager
  private networkManager: NetworkManager

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel
    this.configManager = new ConfigManager(outputChannel)
    this.networkManager = new NetworkManager(outputChannel)
  }

  /**
   * Start OpenCode server
   */
  async startServer(): Promise<string> {
    if (this.isStarting) {
      throw new Error('Server is already starting')
    }

    if (this.server) {
      this.outputChannel.appendLine('⚠️ OpenCode server is already running')
      return this.serverURL!
    }

    try {
      this.isStarting = true
      this.outputChannel.appendLine('🚀 Starting OpenCode server using SDK...')
      
      // Debug: Check OpenCode configuration
      this.outputChannel.appendLine(`🔍 Current working directory: ${process.cwd()}`)
      this.outputChannel.appendLine(`🔍 HOME directory: ${process.env.HOME}`)
      this.outputChannel.appendLine(`🔍 USERPROFILE: ${process.env.USERPROFILE}`)
      this.outputChannel.appendLine(`🔍 XDG_DATA_HOME: ${process.env.XDG_DATA_HOME}`)
      this.outputChannel.appendLine(`🔍 PATH: ${process.env.PATH}`)
      
      // Check if OpenCode binary exists
      const { execSync } = require('child_process')
      try {
        const opencodePath = execSync('which opencode', { encoding: 'utf8' }).trim()
        this.outputChannel.appendLine(`🔍 OpenCode binary path: ${opencodePath}`)
      } catch (error) {
        this.outputChannel.appendLine(`❌ OpenCode binary not found: ${error.message}`)
      }
      
      // Check OpenCode version
      try {
        const opencodeVersion = execSync('opencode --version', { encoding: 'utf8' }).trim()
        this.outputChannel.appendLine(`🔍 OpenCode version: ${opencodeVersion}`)
      } catch (error) {
        this.outputChannel.appendLine(`❌ Failed to get OpenCode version: ${error.message}`)
      }
      
      // Check if config files exist
      const userHome = process.env.HOME || process.env.USERPROFILE || require('os').homedir()
      const fs = require('fs')
      const configPaths = [
        `${userHome}/.opencode`,
        `${userHome}/.local/share/opencode`,
        `${userHome}/.local/share/opencode/auth.json`
      ]
      
      configPaths.forEach(path => {
        try {
          const exists = fs.existsSync(path)
          const isDir = exists && fs.statSync(path).isDirectory()
          this.outputChannel.appendLine(`🔍 Config path ${path}: ${exists ? (isDir ? 'directory exists' : 'file exists') : 'not found'}`)
        } catch (error) {
          this.outputChannel.appendLine(`❌ Error checking ${path}: ${error.message}`)
        }
      })

      // Load user's local auth config and convert to SDK format
      let sdkConfig = {}
      try {
        const fs = require('fs')
        const userHome = process.env.HOME || process.env.USERPROFILE || require('os').homedir()
        const authPath = `${userHome}/.local/share/opencode/auth.json`
        
        if (fs.existsSync(authPath)) {
          const authContent = fs.readFileSync(authPath, 'utf8')
          const authData = JSON.parse(authContent)
          
          // Convert auth format to SDK provider format
          sdkConfig = {
            provider: {}
          }
          
          // Convert each auth entry to provider format
          for (const [providerName, authInfo] of Object.entries(authData)) {
            if (authInfo.type === 'api' && authInfo.key) {
              sdkConfig.provider[providerName] = {
                options: {
                  apiKey: authInfo.key
                }
              }
            }
          }
          
          this.outputChannel.appendLine(`✅ Converted user's auth config to SDK format`)
          this.outputChannel.appendLine(`🔍 SDK config: ${JSON.stringify(sdkConfig, null, 2)}`)
          
          // Debug: Check if API keys are properly loaded
          if (sdkConfig.provider?.anthropic?.options?.apiKey) {
            const apiKey = sdkConfig.provider.anthropic.options.apiKey
            const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4)
            this.outputChannel.appendLine(`🔑 Anthropic API Key loaded: ${maskedKey}`)
          } else {
            this.outputChannel.appendLine(`❌ Anthropic API Key NOT found in config`)
          }
        } else {
          this.outputChannel.appendLine(`⚠️ No local auth config found at ${authPath}`)
        }
      } catch (error: any) {
        this.outputChannel.appendLine(`⚠️ Failed to load local config: ${error.message}`)
      }

      // Start OpenCode server using SDK with converted config
      this.outputChannel.appendLine('🚀 Starting OpenCode server using SDK with converted config...')
      
      // Check for proxy environment variables
      const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']
      const activeProxies = proxyVars.filter(varName => process.env[varName])
      if (activeProxies.length > 0) {
        this.outputChannel.appendLine(`🌐 Proxy detected: ${activeProxies.map(v => `${v}=${process.env[v]}`).join(', ')}`)
      } else {
        this.outputChannel.appendLine(`⚠️ No proxy environment variables detected`)
        this.outputChannel.appendLine(`💡 Tip: Set HTTP_PROXY/HTTPS_PROXY environment variables for VPN/proxy support`)
      }

      // Check if plugin process has proxy environment variables
      const pluginProxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']
      const pluginActiveProxies = pluginProxyVars.filter(varName => process.env[varName])
      
      if (pluginActiveProxies.length > 0) {
        this.outputChannel.appendLine(`🌐 Plugin process has proxy: ${pluginActiveProxies.map(v => `${v}=${process.env[v]}`).join(', ')}`)
      } else {
        this.outputChannel.appendLine(`⚠️ Plugin process has NO proxy environment variables`)
        this.outputChannel.appendLine(`💡 This means OpenCode server will also have no proxy`)
      }

      // Test plugin's network exit IP to verify VPN
      try {
        const response = await fetch('https://ipinfo.io/ip')
        const pluginIP = await response.text()
        this.outputChannel.appendLine(`🌍 Plugin external IP: ${pluginIP.trim()}`)
        this.outputChannel.appendLine(`💡 If this is NOT your VPN exit IP, then plugin is not using VPN`)
      } catch (error) {
        this.outputChannel.appendLine(`❌ Failed to get plugin external IP: ${error}`)
      }

      // Manually set proxy environment variables for OpenCode server
      const proxyEnv = {
        HTTP_PROXY: 'http://127.0.0.1:1087',
        HTTPS_PROXY: 'http://127.0.0.1:1087',
        http_proxy: 'http://127.0.0.1:1087',
        https_proxy: 'http://127.0.0.1:1087',
        ALL_PROXY: 'socks5://127.0.0.1:1080',
        all_proxy: 'socks5://127.0.0.1:1080'
      }
      
      this.outputChannel.appendLine(`🌐 Manually setting proxy environment for OpenCode server`)
      this.outputChannel.appendLine(`🔧 Proxy: HTTP_PROXY=http://127.0.0.1:1087`)

      this.server = await createOpencodeServer({
        port: 0, // Let the system assign a port
        timeout: 15000, // 15 second timeout
        config: sdkConfig, // Pass converted config in SDK format
        env: { ...process.env, ...proxyEnv } // Pass proxy environment variables
      })

      // Test if OpenCode server can access external APIs
      try {
        this.outputChannel.appendLine(`🧪 Testing OpenCode server network connectivity...`)
        const testResponse = await fetch(`${this.serverURL}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        this.outputChannel.appendLine(`✅ OpenCode server health check: ${testResponse.status}`)
      } catch (error) {
        this.outputChannel.appendLine(`❌ OpenCode server health check failed: ${error}`)
      }

      // Store the exact server URL
      this.serverURL = this.server.url
      this.outputChannel.appendLine(`🔍 Server URL: ${this.serverURL}`)
      const url = new URL(this.serverURL)
      this.serverPort = parseInt(url.port)
      
      this.outputChannel.appendLine(`✅ OpenCode server started on port: ${this.serverPort}`)
      this.outputChannel.appendLine(`🔍 Full server URL: ${this.serverURL}`)
      this.isStarting = false
      
      return this.serverURL

    } catch (error: any) {
      this.isStarting = false
      this.outputChannel.appendLine(`❌ Failed to start OpenCode server: ${error.message}`)
      throw error
    }
  }

  /**
   * Stop OpenCode server
   */
  async stopServer(): Promise<void> {
    if (this.server) {
      this.outputChannel.appendLine('🛑 Stopping OpenCode server...')
      this.server.close()
      this.server = null
      this.serverPort = null
      this.serverURL = null
      this.outputChannel.appendLine('✅ OpenCode server stopped')
    }
  }

  /**
   * Get current server port
   */
  getServerPort(): number | null {
    return this.serverPort
  }

  /**
   * Get current server URL
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

}
