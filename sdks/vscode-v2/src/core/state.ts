import * as vscode from "vscode"
import type { StateStruct, ModelUsage, AgentUsage, AgentModel, Prompt } from "../types/app"

/**
 * State management for persistent user preferences and usage tracking
 * Uses VSCode's workspaceState for persistent storage per workspace
 */
export class StateManager {
  private state: StateStruct
  private workspacePath: string
  private context: vscode.ExtensionContext

  constructor(workspacePath: string, context: vscode.ExtensionContext) {
    this.workspacePath = workspacePath
    this.context = context
    this.state = this.initializeState()
    // Load persisted state asynchronously
    this.loadState().catch((error) => {
      console.error("Failed to load state during initialization:", error)
    })
  }

  private initializeState(): StateStruct {
    return {
      theme: "opencode",
      agent: "build",
      provider: "",
      model: "",
      agentModel: {},
      recentlyUsedModels: [],
      recentlyUsedAgents: [],
      messageHistory: [],
      showToolDetails: false,
      showThinkingBlocks: false,
      workspacePath: this.workspacePath,
      autoStartServer: true,
      serverPort: 3000,
      currentSessionId: undefined,
    }
  }

  private getStateKey(): string {
    return `opencode-state-${this.workspacePath}`
  }

  getState(): StateStruct {
    return { ...this.state }
  }

  updateState(updates: Partial<StateStruct>): void {
    this.state = { ...this.state, ...updates }
  }

  /**
   * Track model usage: adds or moves to front, maintains chronological order
   */
  updateModelUsage(providerID: string, modelID: string): void {
    const now = Date.now()

    const existingIndex = this.state.recentlyUsedModels.findIndex(
      (m) => m.providerID === providerID && m.modelID === modelID,
    )

    if (existingIndex !== -1) {
      this.state.recentlyUsedModels[existingIndex].lastUsed = now
      const usage = this.state.recentlyUsedModels[existingIndex]
      this.state.recentlyUsedModels.splice(existingIndex, 1)
      this.state.recentlyUsedModels.unshift(usage)
    } else {
      this.state.recentlyUsedModels.unshift({
        providerID,
        modelID,
        lastUsed: now,
      })
    }

    // Limit to last 50 entries
    this.state.recentlyUsedModels = this.state.recentlyUsedModels.slice(0, 50)
  }

  removeModelFromRecentlyUsed(providerID: string, modelID: string): void {
    const index = this.state.recentlyUsedModels.findIndex((m) => m.providerID === providerID && m.modelID === modelID)

    if (index !== -1) {
      this.state.recentlyUsedModels.splice(index, 1)
    }
  }

  /**
   * Track agent usage: adds or moves to front, maintains chronological order
   */
  updateAgentUsage(agentName: string): void {
    const now = Date.now()

    const existingIndex = this.state.recentlyUsedAgents.findIndex((a) => a.agentName === agentName)

    if (existingIndex !== -1) {
      this.state.recentlyUsedAgents[existingIndex].lastUsed = now
      const usage = this.state.recentlyUsedAgents[existingIndex]
      this.state.recentlyUsedAgents.splice(existingIndex, 1)
      this.state.recentlyUsedAgents.unshift(usage)
    } else {
      this.state.recentlyUsedAgents.unshift({
        agentName,
        lastUsed: now,
      })
    }

    // Limit to last 20 entries
    this.state.recentlyUsedAgents = this.state.recentlyUsedAgents.slice(0, 20)
  }

  /**
   * Remove agent from recently used list
   */
  removeAgentFromRecentlyUsed(agentName: string): void {
    const index = this.state.recentlyUsedAgents.findIndex((a) => a.agentName === agentName)

    if (index !== -1) {
      this.state.recentlyUsedAgents.splice(index, 1)
    }
  }

  addPromptToHistory(prompt: Prompt): void {
    this.state.messageHistory.unshift(prompt)

    // Limit to last 50 entries
    if (this.state.messageHistory.length > 50) {
      this.state.messageHistory = this.state.messageHistory.slice(0, 50)
    }
  }

  updateAgentModel(agentName: string, providerID: string, modelID: string): void {
    this.state.agentModel[agentName] = {
      providerID,
      modelID,
    }
  }

  getAgentModel(agentName: string): AgentModel | undefined {
    return this.state.agentModel[agentName]
  }

  async saveState(): Promise<void> {
    try {
      await this.context.workspaceState.update(this.getStateKey(), this.state)
    } catch (error) {
      console.error("Failed to save state:", error)
      throw new Error(`Failed to save state to VSCode workspaceState: ${error}`)
    }
  }

  async loadState(): Promise<StateStruct> {
    try {
      const savedState = this.context.workspaceState.get<StateStruct>(this.getStateKey())

      if (savedState) {
        // Merge with defaults to ensure all fields exist
        this.state = { ...this.state, ...savedState }
      }

      return this.state
    } catch (error) {
      console.error("Failed to load state:", error)
      return this.state
    }
  }
}
