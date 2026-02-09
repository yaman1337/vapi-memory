import { SupermemoryClient } from './client/SupermemoryClient';
import { LRUCache } from './utils/cache';
import { TokenCounter } from './utils/token-counter';
import { ContextFormatter } from './formatters/ContextFormatter';
import { VapiResponseBuilder } from './builders/VapiResponseBuilder';
import { VapiToolFactory, type ToolDefinition } from './tools/VapiToolFactory';
import type {
  VapiMemoryOptions,
  GetContextRequest,
  FormattedContext,
  StoreConversationRequest,
  UserProfile,
  Memory,
  AssistantResponse,
  Assistant,
  AssistantOverrides,
  Message,
  Tool,
} from './types';

export class VapiMemory {
  private client: SupermemoryClient;
  private options: Required<VapiMemoryOptions>;
  private profileCache: LRUCache<string, any>;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(options: VapiMemoryOptions) {
    this.options = {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl || 'https://api.supermemory.ai',
      maxTokens: options.maxTokens || 2000,
      searchThreshold: options.searchThreshold || 0.5,
      cacheEnabled: options.cacheEnabled !== false,
      cacheTTL: options.cacheTTL || 60000,
      logger: options.logger || console,
    };

    this.client = new SupermemoryClient({
      apiKey: this.options.apiKey,
      baseURL: this.options.baseUrl,
      logger: this.options.logger,
    });

    this.profileCache = new LRUCache(100);

    if (this.options.cacheEnabled) {
      // Setup periodic cache cleanup
      this.cleanupInterval = setInterval(() => {
        const removed = this.profileCache.cleanup(this.options.cacheTTL);
        if (removed > 0) {
          this.options.logger.debug(`Cleaned up ${removed} expired cache entries`);
        }
      }, 60000); // Cleanup every minute
    }

    this.options.logger.info('VapiMemory initialized with caching:', this.options.cacheEnabled);
  }

  async getContext(request: GetContextRequest): Promise<FormattedContext> {
    const startTime = Date.now();
    const sources: string[] = [];

    try {
      const context: FormattedContext = {
        recentMemories: [],
        searchResults: [],
        totalTokens: 0,
        metadata: {
          userId: request.userId,
          retrievalTime: 0,
          sources: [],
        },
      };

      // Check cache first
      const cacheKey = `profile:${request.userId}`;
      if (this.options.cacheEnabled) {
        const cached = this.profileCache.get(cacheKey);
        if (cached) {
          this.options.logger.debug(`Cache hit for ${request.userId}`);
          context.profile = {
            static: cached.profile.static,
            dynamic: cached.profile.dynamic,
          };
          sources.push('cache');

          // Add profile tokens
          context.totalTokens += TokenCounter.estimateMultiple(context.profile.static);
          context.totalTokens += TokenCounter.estimateMultiple(context.profile.dynamic);

          // Include search results from cache if query provided
          if (cached.searchResults && request.includeSearch !== false) {
            const profileResults = cached.searchResults.results as Array<{ memory?: string }>;
            context.searchResults = profileResults
              .filter(r => r.memory !== undefined)
              .map(r => r.memory!);
            context.totalTokens += TokenCounter.estimateMultiple(context.searchResults);
            sources.push('search');
          }
        }
      }

      // Fetch from API if not in cache
      if (!context.profile && request.includeProfile !== false) {
        try {
          const profile = await this.client.getProfile(request.userId, request.query);
          sources.push('profile');

          // Cache the result
          if (this.options.cacheEnabled) {
            this.profileCache.set(cacheKey, profile);
          }

          context.profile = {
            static: profile.profile.static,
            dynamic: profile.profile.dynamic,
          };

          // Add profile tokens
          context.totalTokens += TokenCounter.estimateMultiple(context.profile.static);
          context.totalTokens += TokenCounter.estimateMultiple(context.profile.dynamic);

          // Include search results from profile if query provided
          if (profile.searchResults && request.includeSearch !== false) {
            const profileResults = profile.searchResults.results as Array<{ memory?: string }>;
            context.searchResults = profileResults
              .filter(r => r.memory !== undefined)
              .map(r => r.memory!);
            context.totalTokens += TokenCounter.estimateMultiple(context.searchResults);
            sources.push('search');
          }
        } catch (error) {
          this.options.logger.warn('Failed to fetch profile:', error);
        }
      }

      // Search for recent memories if requested
      if (request.includeRecent !== false && request.callId) {
        try {
          const memories = await this.client.searchMemories(
            'recent conversation',
            request.userId,
            this.options.searchThreshold,
            3
          );
          context.recentMemories = memories.results
            .filter(r => r.memory !== undefined)
            .map(r => r.memory!);
          context.totalTokens += TokenCounter.estimateMultiple(context.recentMemories);
          sources.push('recent-memories');
        } catch (error) {
          this.options.logger.warn('Failed to fetch recent memories:', error);
        }
      }

      const endTime = Date.now();
      context.metadata.retrievalTime = endTime - startTime;
      context.metadata.sources = sources;

      this.options.logger.info(`Context retrieved for ${request.userId} in ${context.metadata.retrievalTime}ms (${sources.join(', ')})`);

      return context;
    } catch (error) {
      this.options.logger.error('Error getting context:', error);
      throw new Error(`Failed to get context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async storeConversation(call: StoreConversationRequest): Promise<void> {
    try {
      const transcriptText = call.transcript
        .map(t => `${t.role}: ${t.content}`)
        .join('\n');

      await this.client.addMemory(transcriptText, call.userId, {
        callId: call.callId,
        timestamp: new Date().toISOString(),
        ...call.metadata,
      });

      this.options.logger.info(`Stored conversation ${call.callId} for user ${call.userId}`);
    } catch (error) {
      this.options.logger.error('Error storing conversation:', error);
      throw new Error(`Failed to store conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const profile = await this.client.getProfile(userId);
      return {
        userId,
        static: profile.profile.static,
        dynamic: profile.profile.dynamic,
      };
    } catch (error) {
      this.options.logger.error('Error getting user profile:', error);
      throw new Error(`Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async addMemory(memory: Memory): Promise<void> {
    try {
      await this.client.addMemory(memory.content, memory.userId, memory.metadata);
      this.options.logger.info(`Added memory for user ${memory.userId}`);
    } catch (error) {
      this.options.logger.error('Error adding memory:', error);
      throw new Error(`Failed to add memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async forgetMemory(memoryId: string): Promise<void> {
    throw new Error('forgetMemory is not yet implemented');
  }

  clearCache(): void {
    this.profileCache.clear();
    this.options.logger.info('Cache cleared');
  }

  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    const stats = this.profileCache.getStats();
    return {
      size: stats.size,
      maxSize: stats.maxSize,
      hitRate: stats.hitRate,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.profileCache.clear();
    this.options.logger.info('VapiMemory destroyed');
  }

  createAssistantResponse(context: FormattedContext, baseAssistant?: Partial<Assistant>): AssistantResponse {
    return VapiResponseBuilder.buildAssistant({
      context,
      baseAssistant,
      injectContext: true,
    });
  }

  buildWithTools(
    context: FormattedContext,
    baseAssistant?: Partial<Assistant>,
    toolSet?: ToolDefinition[]
  ): AssistantResponse {
    const tools = toolSet || VapiToolFactory.createToolSet();

    return VapiResponseBuilder.buildAssistant({
      context,
      baseAssistant: baseAssistant ? {
        ...baseAssistant,
        tools: tools as Tool[],
      } : {
        tools: tools as Tool[],
      },
      injectContext: true,
    });
  }

  /**
   * Build a response using an existing Vapi assistant ID with context injected as overrides.
   * Use this when you have a pre-built assistant in the Vapi dashboard and want to
   * inject memory context as system message overrides.
   *
   * @param context - The formatted context from getContext()
   * @param assistantId - Your Vapi assistant ID from the dashboard
   * @param additionalOverrides - Optional extra overrides (voice, model, etc.)
   */
  buildWithOverrides(
    context: FormattedContext,
    assistantId: string,
    additionalOverrides?: Partial<AssistantOverrides>
  ): AssistantResponse {
    return VapiResponseBuilder.buildOverrides({
      context,
      assistantId,
      additionalOverrides,
    });
  }

  /**
   * Build a response using an existing Vapi assistant ID with context and memory tools.
   * Combines assistantId overrides with tool injection for mid-call memory access.
   *
   * @param context - The formatted context from getContext()
   * @param assistantId - Your Vapi assistant ID from the dashboard
   * @param toolSet - Optional custom tool definitions (defaults to full memory tool set)
   * @param additionalOverrides - Optional extra overrides (voice, model, etc.)
   */
  buildWithToolsAndOverrides(
    context: FormattedContext,
    assistantId: string,
    toolSet?: ToolDefinition[],
    additionalOverrides?: Partial<AssistantOverrides>
  ): AssistantResponse {
    const tools = toolSet || VapiToolFactory.createToolSet();

    return VapiResponseBuilder.buildOverrides({
      context,
      assistantId,
      additionalOverrides: {
        tools: tools as Tool[],
        ...additionalOverrides,
      },
    });
  }

  /**
   * Select a Vapi assistant by ID with optional context injection.
   * Lightweight version that just selects the assistant and optionally adds context.
   *
   * @param context - The formatted context from getContext()
   * @param assistantId - Your Vapi assistant ID from the dashboard
   * @param includeContext - Whether to inject context as system message (default: true)
   */
  selectAssistant(
    context: FormattedContext,
    assistantId: string,
    includeContext: boolean = true
  ): AssistantResponse {
    return VapiResponseBuilder.buildAssistantSelection({
      context,
      assistantId,
      includeContext,
    });
  }

  buildWithVariables(
    context: FormattedContext,
    baseAssistant?: Partial<Assistant>
  ): AssistantResponse {
    // Extract variables from context
    const variableValues = VapiResponseBuilder.extractVariableValues(context);

    if (baseAssistant) {
      return {
        assistant: baseAssistant,
        assistantOverrides: {
          variableValues,
        },
      };
    }

    return {
      assistantOverrides: {
        variableValues,
      },
    };
  }

  createContextMessage(context: FormattedContext): Message {
    let content = 'User context:\n\n';

    if (context.profile?.static && context.profile.static.length > 0) {
      content += 'Static Profile:\n';
      content += context.profile.static.join('\n');
      content += '\n\n';
    }

    if (context.profile?.dynamic && context.profile.dynamic.length > 0) {
      content += 'Dynamic Profile:\n';
      content += context.profile.dynamic.join('\n');
      content += '\n\n';
    }

    if (context.recentMemories && context.recentMemories.length > 0) {
      content += 'Recent Memories:\n';
      content += context.recentMemories.join('\n');
      content += '\n\n';
    }

    if (context.searchResults && context.searchResults.length > 0) {
      content += 'Relevant Memories:\n';
      content += context.searchResults.join('\n');
      content += '\n\n';
    }

    content += `Context includes ${context.totalTokens} estimated tokens.\n`;
    content += `Retrieved in ${context.metadata.retrievalTime}ms from sources: ${context.metadata.sources.join(', ')}.`;

    return {
      role: 'system',
      content,
    };
  }

  private estimateTokens(text: string): number {
    return TokenCounter.estimate(text);
  }
}
