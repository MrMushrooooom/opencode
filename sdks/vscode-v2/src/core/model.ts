import { OpenCodeAPI } from './api'
import { Model, Provider, ModelUsage } from '../types/app'
import * as vscode from 'vscode'

/**
 * Model Manager
 * Handles model selection, provider management, and model state
 * Similar to TUI's model selection logic
 */
export class ModelManager {
  private api: OpenCodeAPI
  private outputChannel: vscode.OutputChannel
  private providers: Provider[] = []
  private currentModel: Model | null = null
  private recentlyUsedModels: ModelUsage[] = []

  constructor(api: OpenCodeAPI, outputChannel: vscode.OutputChannel) {
    this.api = api
    this.outputChannel = outputChannel
  }

  /**
   * Initialize model manager by loading providers and selecting default model
   */
  async initialize(): Promise<void> {
    try {
      this.outputChannel.appendLine('🚀 Initializing ModelManager...')
      
      // Load providers from OpenCode server
      await this.loadProviders()
      
      // Select default model using TUI's priority logic
      await this.selectDefaultModel()
      
      this.outputChannel.appendLine('✅ ModelManager initialized successfully')
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to initialize ModelManager: ${error.message}`)
      throw error
    }
  }

  /**
   * Load available providers and models from OpenCode server
   */
  private async loadProviders(): Promise<void> {
    try {
      this.outputChannel.appendLine('📋 Loading providers from OpenCode server...')
      const serverProviders = await this.api.getProviders()
      
      this.providers = serverProviders.map((provider: any) => ({
        id: provider.id,
        name: provider.name,
        models: provider.models ? Object.values(provider.models).map((model: any) => ({
          id: model.id,
          providerId: provider.id,
          name: model.name,
          description: model.description
        })) : []
      }))

      this.outputChannel.appendLine(`✅ Loaded ${this.providers.length} providers with ${this.getTotalModelCount()} models`)
      
      // Log each provider and its models
      this.providers.forEach(provider => {
        this.outputChannel.appendLine(`📋 Provider: ${provider.name} (${provider.id})`)
        provider.models.forEach(model => {
          this.outputChannel.appendLine(`  🤖 Model: ${model.name} (${model.id})`)
        })
      })
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to load providers: ${error.message}`)
      // Like TUI, don't throw error - continue with empty providers
      // The selectDefaultModel will handle the case when no models are available
      this.providers = []
    }
  }

  /**
   * Select default model using TUI's priority logic
   */
  private async selectDefaultModel(): Promise<void> {
    try {
      this.outputChannel.appendLine('🎯 Selecting default model...')
      
      // Priority 1: Recent model usage (most recently used model)
      if (this.recentlyUsedModels.length > 0) {
        const recentUsage = this.recentlyUsedModels[0]
        const model = this.findModelByProviderAndModelID(recentUsage.providerId, recentUsage.modelId)
        if (model) {
          this.currentModel = model
          this.outputChannel.appendLine(`✅ Selected recent model: ${model.name} (${model.providerId})`)
          return
        }
      }

      // Priority 2: Anthropic preferred (like TUI)
      const anthropicProvider = this.findProviderByID('anthropic')
      if (anthropicProvider && anthropicProvider.models.length > 0) {
        const defaultModel = this.getDefaultModelForProvider(anthropicProvider)
        if (defaultModel) {
          this.currentModel = defaultModel
          this.outputChannel.appendLine(`✅ Selected Anthropic model: ${defaultModel.name}`)
          return
        }
      }

      // Priority 3: First available provider
      if (this.providers.length > 0) {
        const firstProvider = this.providers[0]
        const defaultModel = this.getDefaultModelForProvider(firstProvider)
        if (defaultModel) {
          this.currentModel = defaultModel
          this.outputChannel.appendLine(`✅ Selected first available model: ${defaultModel.name} (${firstProvider.name})`)
          return
        }
      }

      // No models available - set to null but don't throw error
      this.currentModel = null
      this.outputChannel.appendLine(`⚠️ No models available - will retry later`)
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to select default model: ${error.message}`)
      this.currentModel = null
    }
  }

  /**
   * Switch to a specific model
   */
  async switchToModel(providerId: string, modelId: string): Promise<Model> {
    try {
      const model = this.findModelByProviderAndModelID(providerId, modelId)
      if (!model) {
        throw new Error(`Model not found: ${providerId}/${modelId}`)
      }

      this.currentModel = model
      this.updateModelUsage(providerId, modelId)
      
      this.outputChannel.appendLine(`✅ Switched to model: ${model.name} (${providerId})`)
      return model
    } catch (error: any) {
      this.outputChannel.appendLine(`❌ Failed to switch model: ${error.message}`)
      throw error
    }
  }

  /**
   * Get all available models
   */
  getAllModels(): Model[] {
    const models: Model[] = []
    for (const provider of this.providers) {
      const providerModels = provider.models.map(model => ({
        ...model,
        isCurrent: model.id === this.currentModel?.id && model.providerId === this.currentModel?.providerId
      }))
      models.push(...providerModels)
    }
    return models
  }

  /**
   * Get models grouped by provider
   */
  getModelsByProvider(): Provider[] {
    return this.providers
  }

  /**
   * Get current model
   */
  getCurrentModel(): Model | null {
    return this.currentModel
  }

  /**
   * Get recently used models
   */
  getRecentlyUsedModels(): Model[] {
    return this.recentlyUsedModels
      .map(usage => this.findModelByProviderAndModelID(usage.providerId, usage.modelId))
      .filter(model => model !== null) as Model[]
  }

  /**
   * Helper methods
   */
  private getTotalModelCount(): number {
    return this.providers.reduce((total, provider) => total + provider.models.length, 0)
  }

  private findProviderByID(providerId: string): Provider | null {
    return this.providers.find(provider => provider.id === providerId) || null
  }

  private findModelByProviderAndModelID(providerId: string, modelId: string): Model | null {
    const provider = this.findProviderByID(providerId)
    if (!provider) return null
    
    return provider.models.find(model => model.id === modelId) || null
  }

  private getDefaultModelForProvider(provider: Provider): Model | null {
    // For Anthropic, prefer Claude Sonnet 3.5
    if (provider.id === 'anthropic') {
      const sonnet35 = provider.models.find(model => 
        model.id.includes('claude-3-5-sonnet') || model.name.includes('Claude Sonnet 3.5')
      )
      if (sonnet35) return sonnet35
    }
    
    // Otherwise, return first available model
    return provider.models.length > 0 ? provider.models[0] : null
  }

  private updateModelUsage(providerId: string, modelId: string): void {
    // Remove existing usage if any
    this.recentlyUsedModels = this.recentlyUsedModels.filter(
      usage => !(usage.providerId === providerId && usage.modelId === modelId)
    )
    
    // Add new usage at the beginning
    this.recentlyUsedModels.unshift({
      providerId,
      modelId,
      lastUsed: Date.now()
    })
    
    // Keep only last 10 models
    this.recentlyUsedModels = this.recentlyUsedModels.slice(0, 10)
  }

  /**
   * Get all providers
   */
  getProviders(): Provider[] {
    return [...this.providers]
  }
}
