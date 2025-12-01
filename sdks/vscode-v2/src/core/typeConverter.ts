import * as opencode from "@opencode-ai/sdk"

/**
 * Frontend-compatible type definitions
 * Optimized for WebView consumption with minimal payload
 */
export interface FrontendSession {
  readonly id: string
  readonly title: string
  readonly createdAt: number
  readonly updatedAt: number
}

export interface FrontendModel {
  readonly id: string
  readonly name: string
  readonly providerID: string
}

export interface FrontendProvider {
  readonly id: string
  readonly name: string
  readonly models: readonly FrontendModel[]
}

//

export interface FrontendAgent {
  readonly name: string
  readonly description: string
  readonly mode: "plan" | "build"
}

/**
 * Type conversion utilities for transforming API types to frontend-optimized types
 * Implements the Adapter pattern to bridge API types and frontend type systems
 */
export class TypeConverter {
  /**
   * Convert Session: extracts id, title, timestamps
   */
  static sessionToFrontend(session: opencode.Session): FrontendSession {
    return {
      id: session.id,
      title: session.title,
      createdAt: session.time.created,
      updatedAt: session.time.updated,
    }
  }

  /**
   * Convert Model: extracts id, name, providerID
   */
  static modelToFrontend(model: opencode.Model): FrontendModel {
    const providerId = typeof model.provider === "string" ? model.provider : ((model.provider as any)?.id ?? "")
    return {
      id: model.id,
      name: model.name,
      providerID: providerId,
    }
  }

  /**
   * Convert Provider: includes nested models
   */
  static providerToFrontend(provider: opencode.Provider): FrontendProvider {
    const models = Array.isArray(provider.models) ? provider.models : Object.values(provider.models || {})
    return {
      id: provider.id,
      name: provider.name,
      models: models.map((model: opencode.Model) => this.modelToFrontend(model)),
    }
  }

  /**
   * Convert Agent: extracts name, description, mode
   */
  static agentToFrontend(agent: opencode.Agent): FrontendAgent {
    return {
      name: agent.name,
      description: agent.description ?? "",
      mode: agent.mode as "plan" | "build",
    }
  }

  static sessionsToFrontend(sessions: readonly opencode.Session[]): readonly FrontendSession[] {
    return sessions.map((session) => this.sessionToFrontend(session))
  }

  static providersToFrontend(providers: readonly opencode.Provider[]): readonly FrontendProvider[] {
    return providers.map((provider) => this.providerToFrontend(provider))
  }

  static agentsToFrontend(agents: readonly opencode.Agent[]): readonly FrontendAgent[] {
    return agents.map((agent) => this.agentToFrontend(agent))
  }

  /**
   * Null-safe Session conversion
   */
  static safeSessionToFrontend(session: opencode.Session | null | undefined): FrontendSession | null {
    return session ? this.sessionToFrontend(session) : null
  }

  /**
   * Null-safe Provider conversion
   */
  static safeProviderToFrontend(provider: opencode.Provider | null | undefined): FrontendProvider | null {
    return provider ? this.providerToFrontend(provider) : null
  }

  /**
   * Null-safe Model conversion
   */
  static safeModelToFrontend(model: opencode.Model | null | undefined): FrontendModel | null {
    return model ? this.modelToFrontend(model) : null
  }
}
