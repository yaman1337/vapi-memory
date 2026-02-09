// src/client/SupermemoryClient.ts
import Supermemory from "supermemory";

class SupermemoryClient {
  client;
  logger;
  sanitizeContainerTag(tag) {
    return tag.replace(/[^a-zA-Z0-9_-]/g, "");
  }
  constructor(options) {
    this.logger = options.logger || console;
    this.client = new Supermemory({
      apiKey: options.apiKey,
      baseURL: options.baseURL || "https://api.supermemory.ai"
    });
    this.logger.info("Supermemory client initialized");
  }
  async getProfile(containerTag, query, threshold) {
    try {
      this.logger.debug(`Fetching profile for ${containerTag}`);
      const result = await this.client.profile({
        containerTag: this.sanitizeContainerTag(containerTag),
        q: query
      });
      return result;
    } catch (error) {
      this.logger.error("Error fetching profile:", error);
      throw new Error(`Failed to fetch profile: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  async addMemory(content, containerTag, metadata) {
    try {
      this.logger.debug(`Adding memory for ${containerTag}`);
      const result = await this.client.add({
        content,
        containerTag: this.sanitizeContainerTag(containerTag),
        metadata
      });
      return result;
    } catch (error) {
      this.logger.error("Error adding memory:", error);
      throw new Error(`Failed to add memory: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  async searchMemories(query, containerTag, threshold, limit) {
    try {
      this.logger.debug(`Searching memories: ${query} in ${containerTag}`);
      const result = await this.client.search.memories({
        q: query,
        containerTag: this.sanitizeContainerTag(containerTag),
        threshold,
        limit: limit || 5
      });
      return result;
    } catch (error) {
      this.logger.error("Error searching memories:", error);
      throw new Error(`Failed to search memories: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  async searchDocuments(query, containerTags, limit) {
    try {
      this.logger.debug(`Searching documents: ${query} in ${containerTags.join(", ")}`);
      const result = await this.client.search.documents({
        q: query,
        containerTags: containerTags.map((tag) => this.sanitizeContainerTag(tag)),
        limit: limit || 5
      });
      return result;
    } catch (error) {
      this.logger.error("Error searching documents:", error);
      throw new Error(`Failed to search documents: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

// src/utils/cache.ts
class LRUCache {
  cache;
  maxSize;
  currentSize;
  constructor(maxSize = 100) {
    this.cache = new Map;
    this.maxSize = maxSize;
    this.currentSize = 0;
  }
  get(key) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.hits++;
      entry.timestamp = Date.now();
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.value;
    }
    return;
  }
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.currentSize--;
    }
    if (this.currentSize >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.currentSize--;
      }
    }
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    });
    this.currentSize++;
  }
  has(key) {
    return this.cache.has(key);
  }
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.currentSize--;
    }
    return deleted;
  }
  clear() {
    this.cache.clear();
    this.currentSize = 0;
  }
  size() {
    return this.currentSize;
  }
  entries() {
    return Array.from(this.cache.entries());
  }
  keys() {
    return Array.from(this.cache.keys());
  }
  values() {
    return Array.from(this.cache.values()).map((e) => e.value);
  }
  cleanup(maxAge) {
    const now = Date.now();
    const cutoffTime = now - maxAge;
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < cutoffTime) {
        this.delete(key);
        removed++;
      }
    }
    return removed;
  }
  getStats() {
    const entries = this.entries();
    const totalHits = entries.reduce((sum, [, e]) => sum + e.hits, 0);
    const totalAccess = totalHits + (this.maxSize - this.cache.size);
    return {
      size: this.currentSize,
      maxSize: this.maxSize,
      hitRate: totalAccess > 0 ? totalHits / totalAccess : 0,
      entries: entries.map(([key, entry]) => ({
        key,
        hits: entry.hits,
        age: Date.now() - entry.timestamp
      }))
    };
  }
}

// src/utils/token-counter.ts
class TokenCounter {
  static CHARS_PER_TOKEN = 4;
  static TOKENS_PER_WORD = 0.75;
  static estimate(text) {
    if (!text || text.length === 0) {
      return 0;
    }
    const charEstimate = Math.ceil(text.length / this.CHARS_PER_TOKEN);
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const wordEstimate = Math.ceil(words.length * this.TOKENS_PER_WORD);
    return Math.max(charEstimate, wordEstimate);
  }
  static estimateMultiple(texts) {
    return texts.reduce((total, text) => total + this.estimate(text), 0);
  }
  static formatWithinBudget(texts, budget, separator = `
`) {
    let usedTokens = 0;
    const included = [];
    for (const text of texts) {
      const tokenCount = this.estimate(text);
      if (usedTokens + tokenCount > budget) {
        break;
      }
      usedTokens += tokenCount;
      included.push(text);
    }
    return {
      formatted: included.join(separator),
      usedTokens,
      includedCount: included.length
    };
  }
}

// src/builders/VapiResponseBuilder.ts
class VapiResponseBuilder {
  static DEFAULT_CONTEXT_TEMPLATE = `
User context:

{{#profile.static}}
Static Profile:
{{/profile.static}}
{{profile.static.join('\\n')}}

{{/profile.static}}

{{#profile.dynamic}}
Dynamic Profile:
{{/profile.dynamic}}
{{profile.dynamic.join('\\n')}}

{{/profile.dynamic}}

{{#recentMemories}}
Recent Memories:
{{/recentMemories}}
{{recentMemories.join('\\n')}}

{{/recentMemories}}

{{#searchResults}}
Relevant Memories:
{{/searchResults}}
{{searchResults.join('\\n')}}

{{/searchResults}}

Context info: {{totalTokens}} tokens retrieved in {{retrievalTime}}ms from {{sources.join(', ')}}.
`;
  static buildAssistant(options) {
    const { context, baseAssistant, injectContext = true } = options;
    let messages = baseAssistant?.messages || [];
    if (injectContext) {
      const systemMessage = this.buildSystemMessage(context);
      messages = [systemMessage, ...messages];
    }
    return {
      assistant: baseAssistant ? {
        ...baseAssistant,
        messages
      } : {
        messages
      }
    };
  }
  static buildOverrides(options) {
    const { context, assistantId, additionalOverrides } = options;
    const systemMessage = this.buildSystemMessage(context);
    const overrides = {
      messages: [systemMessage],
      ...additionalOverrides
    };
    return {
      assistantId,
      assistantOverrides: overrides
    };
  }
  static buildAssistantSelection(options) {
    const { context, assistantId, includeContext = true } = options;
    if (!includeContext) {
      return {
        assistantId
      };
    }
    const systemMessage = this.buildSystemMessage(context);
    const overrides = {
      messages: [systemMessage]
    };
    return {
      assistantId,
      assistantOverrides: overrides
    };
  }
  static buildSystemMessage(context) {
    const content = this.formatContextString(context);
    return {
      role: "system",
      content
    };
  }
  static injectContextToMessages(messages, context, position = "before") {
    const systemMessage = this.buildSystemMessage(context);
    if (position === "before") {
      return [systemMessage, ...messages];
    } else {
      return [...messages, systemMessage];
    }
  }
  static formatContextString(context) {
    let parts = [`User context:
`];
    if (context.profile?.static && context.profile.static.length > 0) {
      parts.push("Static Profile:");
      parts.push(...context.profile.static);
      parts.push("");
    }
    if (context.profile?.dynamic && context.profile.dynamic.length > 0) {
      parts.push("Dynamic Profile:");
      parts.push(...context.profile.dynamic);
      parts.push("");
    }
    if (context.recentMemories && context.recentMemories.length > 0) {
      parts.push("Recent Memories:");
      parts.push(...context.recentMemories);
      parts.push("");
    }
    if (context.searchResults && context.searchResults.length > 0) {
      parts.push("Relevant Memories:");
      parts.push(...context.searchResults);
      parts.push("");
    }
    parts.push(`Context includes ${context.totalTokens} estimated tokens.`);
    parts.push(`Retrieved in ${context.metadata.retrievalTime}ms from sources: ${context.metadata.sources.join(", ")}.`);
    return parts.join(`
`);
  }
  static extractVariableValues(context) {
    const values = {};
    if (context.profile?.static) {
      values.userName = this.extractValue(context.profile.static, ["name", "Name"]);
      values.userTier = this.extractValue(context.profile.static, ["VIP", "vip", "premium", "standard"]);
      values.userLocation = this.extractValue(context.profile.static, ["lives", "location", "in"]);
      values.userAge = this.extractValue(context.profile.static, ["years old", "age"]);
    }
    if (context.recentMemories && context.recentMemories.length > 0) {
      values.recentActivities = context.recentMemories.slice(0, 3).join("; ");
    }
    return values;
  }
  static extractValue(facts, keywords) {
    for (const fact of facts) {
      const lowerFact = fact.toLowerCase();
      for (const keyword of keywords) {
        if (lowerFact.includes(keyword)) {
          return fact;
        }
      }
    }
    return "";
  }
}

// src/tools/VapiToolFactory.ts
class VapiToolFactory {
  static createSearchTool() {
    return {
      type: "function",
      name: "search_memories",
      description: "Search user memories using semantic similarity. Use this to find relevant information about the user based on their query.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find relevant memories"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 5)",
            default: 5
          },
          threshold: {
            type: "number",
            description: "Minimum similarity threshold (0-1, default: 0.5)",
            default: 0.5
          }
        },
        required: ["query"]
      }
    };
  }
  static createProfileTool() {
    return {
      type: "function",
      name: "get_user_profile",
      description: "Get user profile information including static facts, dynamic memories, and recent context.",
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            enum: ["static", "dynamic", "all"],
            description: "Which section of the profile to retrieve (default: all)",
            default: "all"
          }
        },
        required: []
      }
    };
  }
  static createRecentMemoriesTool() {
    return {
      type: "function",
      name: "get_recent_memories",
      description: "Get recent conversation memories for the user.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of recent memories to return (default: 3)",
            default: 3
          }
        },
        required: []
      }
    };
  }
  static createStoreMemoryTool() {
    return {
      type: "function",
      name: "store_memory",
      description: "Store important information to user profile for future use.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Information to store in memory"
          },
          metadata: {
            type: "object",
            description: "Optional metadata for this memory (e.g., category, importance)"
          }
        },
        required: ["content"]
      }
    };
  }
  static createFullContextTool() {
    return {
      type: "function",
      name: "get_full_context",
      description: "Get complete user context including profile, recent memories, and search results. Use this when you need comprehensive user information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for finding relevant memories"
          },
          includeProfile: {
            type: "boolean",
            description: "Include user profile (default: true)",
            default: true
          },
          includeRecent: {
            type: "boolean",
            description: "Include recent memories (default: true)",
            default: true
          },
          includeSearch: {
            type: "boolean",
            description: "Include search results (default: true)",
            default: true
          }
        },
        required: []
      }
    };
  }
  static createToolSet(includeSearch = true) {
    const tools = [];
    if (includeSearch) {
      tools.push(this.createSearchTool());
    }
    tools.push(this.createProfileTool());
    tools.push(this.createRecentMemoriesTool());
    tools.push(this.createStoreMemoryTool());
    tools.push(this.createFullContextTool());
    return tools;
  }
}

// src/VapiMemory.ts
class VapiMemory {
  client;
  options;
  profileCache;
  cleanupInterval;
  constructor(options) {
    this.options = {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl || "https://api.supermemory.ai",
      maxTokens: options.maxTokens || 2000,
      searchThreshold: options.searchThreshold || 0.5,
      cacheEnabled: options.cacheEnabled !== false,
      cacheTTL: options.cacheTTL || 60000,
      logger: options.logger || console
    };
    this.client = new SupermemoryClient({
      apiKey: this.options.apiKey,
      baseURL: this.options.baseUrl,
      logger: this.options.logger
    });
    this.profileCache = new LRUCache(100);
    if (this.options.cacheEnabled) {
      this.cleanupInterval = setInterval(() => {
        const removed = this.profileCache.cleanup(this.options.cacheTTL);
        if (removed > 0) {
          this.options.logger.debug(`Cleaned up ${removed} expired cache entries`);
        }
      }, 60000);
    }
    this.options.logger.info("VapiMemory initialized with caching:", this.options.cacheEnabled);
  }
  async getContext(request) {
    const startTime = Date.now();
    const sources = [];
    try {
      const context = {
        recentMemories: [],
        searchResults: [],
        totalTokens: 0,
        metadata: {
          userId: request.userId,
          retrievalTime: 0,
          sources: []
        }
      };
      const cacheKey = `profile:${request.userId}`;
      if (this.options.cacheEnabled) {
        const cached = this.profileCache.get(cacheKey);
        if (cached) {
          this.options.logger.debug(`Cache hit for ${request.userId}`);
          context.profile = {
            static: cached.profile.static,
            dynamic: cached.profile.dynamic
          };
          sources.push("cache");
          context.totalTokens += TokenCounter.estimateMultiple(context.profile.static);
          context.totalTokens += TokenCounter.estimateMultiple(context.profile.dynamic);
          if (cached.searchResults && request.includeSearch !== false) {
            const profileResults = cached.searchResults.results;
            context.searchResults = profileResults.filter((r) => r.memory !== undefined).map((r) => r.memory);
            context.totalTokens += TokenCounter.estimateMultiple(context.searchResults);
            sources.push("search");
          }
        }
      }
      if (!context.profile && request.includeProfile !== false) {
        try {
          const profile = await this.client.getProfile(request.userId, request.query);
          sources.push("profile");
          if (this.options.cacheEnabled) {
            this.profileCache.set(cacheKey, profile);
          }
          context.profile = {
            static: profile.profile.static,
            dynamic: profile.profile.dynamic
          };
          context.totalTokens += TokenCounter.estimateMultiple(context.profile.static);
          context.totalTokens += TokenCounter.estimateMultiple(context.profile.dynamic);
          if (profile.searchResults && request.includeSearch !== false) {
            const profileResults = profile.searchResults.results;
            context.searchResults = profileResults.filter((r) => r.memory !== undefined).map((r) => r.memory);
            context.totalTokens += TokenCounter.estimateMultiple(context.searchResults);
            sources.push("search");
          }
        } catch (error) {
          this.options.logger.warn("Failed to fetch profile:", error);
        }
      }
      if (request.includeRecent !== false && request.callId) {
        try {
          const memories = await this.client.searchMemories("recent conversation", request.userId, this.options.searchThreshold, 3);
          context.recentMemories = memories.results.filter((r) => r.memory !== undefined).map((r) => r.memory);
          context.totalTokens += TokenCounter.estimateMultiple(context.recentMemories);
          sources.push("recent-memories");
        } catch (error) {
          this.options.logger.warn("Failed to fetch recent memories:", error);
        }
      }
      const endTime = Date.now();
      context.metadata.retrievalTime = endTime - startTime;
      context.metadata.sources = sources;
      this.options.logger.info(`Context retrieved for ${request.userId} in ${context.metadata.retrievalTime}ms (${sources.join(", ")})`);
      return context;
    } catch (error) {
      this.options.logger.error("Error getting context:", error);
      throw new Error(`Failed to get context: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  async storeConversation(call) {
    try {
      const transcriptText = call.transcript.map((t) => `${t.role}: ${t.content}`).join(`
`);
      await this.client.addMemory(transcriptText, call.userId, {
        callId: call.callId,
        timestamp: new Date().toISOString(),
        ...call.metadata
      });
      this.options.logger.info(`Stored conversation ${call.callId} for user ${call.userId}`);
    } catch (error) {
      this.options.logger.error("Error storing conversation:", error);
      throw new Error(`Failed to store conversation: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  async getUserProfile(userId) {
    try {
      const profile = await this.client.getProfile(userId);
      return {
        userId,
        static: profile.profile.static,
        dynamic: profile.profile.dynamic
      };
    } catch (error) {
      this.options.logger.error("Error getting user profile:", error);
      throw new Error(`Failed to get user profile: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  async addMemory(memory) {
    try {
      await this.client.addMemory(memory.content, memory.userId, memory.metadata);
      this.options.logger.info(`Added memory for user ${memory.userId}`);
    } catch (error) {
      this.options.logger.error("Error adding memory:", error);
      throw new Error(`Failed to add memory: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  async forgetMemory(memoryId) {
    throw new Error("forgetMemory is not yet implemented");
  }
  clearCache() {
    this.profileCache.clear();
    this.options.logger.info("Cache cleared");
  }
  getCacheStats() {
    const stats = this.profileCache.getStats();
    return {
      size: stats.size,
      maxSize: stats.maxSize,
      hitRate: stats.hitRate
    };
  }
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.profileCache.clear();
    this.options.logger.info("VapiMemory destroyed");
  }
  createAssistantResponse(context, baseAssistant) {
    return VapiResponseBuilder.buildAssistant({
      context,
      baseAssistant,
      injectContext: true
    });
  }
  buildWithTools(context, baseAssistant, toolSet) {
    const tools = toolSet || VapiToolFactory.createToolSet();
    return VapiResponseBuilder.buildAssistant({
      context,
      baseAssistant: baseAssistant ? {
        ...baseAssistant,
        tools
      } : {
        tools
      },
      injectContext: true
    });
  }
  buildWithVariables(context, baseAssistant) {
    const variableValues = VapiResponseBuilder.extractVariableValues(context);
    if (baseAssistant) {
      return {
        assistant: baseAssistant,
        assistantOverrides: {
          variableValues
        }
      };
    }
    return {
      assistantOverrides: {
        variableValues
      }
    };
  }
  createContextMessage(context) {
    let content = `User context:

`;
    if (context.profile?.static && context.profile.static.length > 0) {
      content += `Static Profile:
`;
      content += context.profile.static.join(`
`);
      content += `

`;
    }
    if (context.profile?.dynamic && context.profile.dynamic.length > 0) {
      content += `Dynamic Profile:
`;
      content += context.profile.dynamic.join(`
`);
      content += `

`;
    }
    if (context.recentMemories && context.recentMemories.length > 0) {
      content += `Recent Memories:
`;
      content += context.recentMemories.join(`
`);
      content += `

`;
    }
    if (context.searchResults && context.searchResults.length > 0) {
      content += `Relevant Memories:
`;
      content += context.searchResults.join(`
`);
      content += `

`;
    }
    content += `Context includes ${context.totalTokens} estimated tokens.
`;
    content += `Retrieved in ${context.metadata.retrievalTime}ms from sources: ${context.metadata.sources.join(", ")}.`;
    return {
      role: "system",
      content
    };
  }
  estimateTokens(text) {
    return TokenCounter.estimate(text);
  }
}
// src/formatters/ContextFormatter.ts
class ContextFormatter {
  static format(sections, options) {
    const { maxTokens, includeTokens, includeMetadata, separator = `

` } = options;
    const sorted = [...sections].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.id.localeCompare(a.id);
    });
    const deduplicated = this.deduplicate(sorted);
    let usedTokens = 0;
    const included = [];
    const excluded = [];
    for (const section of deduplicated) {
      if (usedTokens + section.tokens > maxTokens) {
        excluded.push(section);
        continue;
      }
      usedTokens += section.tokens;
      included.push(section);
    }
    let formatted = "";
    for (const section of included) {
      formatted += section.content;
      if (includeMetadata) {
        formatted += ` [${section.source}]`;
      }
      if (includeTokens) {
        formatted += ` [${section.tokens}t]`;
      }
      formatted += separator;
    }
    if (includeTokens) {
      formatted += `
Total: ${usedTokens}/${maxTokens} tokens`;
    }
    const sources = Array.from(new Set(included.map((s) => s.source)));
    const metadata = {
      totalItems: deduplicated.length,
      includedItems: included.length,
      excludedItems: excluded.length,
      sources
    };
    return {
      formatted: formatted.trim(),
      usedTokens,
      sections: included,
      metadata: includeMetadata ? metadata : undefined
    };
  }
  static deduplicate(sections) {
    const seen = new Set;
    const deduplicated = [];
    for (const section of sections) {
      const normalized = section.content.toLowerCase().trim();
      if (seen.has(normalized)) {
        continue;
      }
      const isDuplicate = deduplicated.some((s) => {
        const similarity = this.calculateSimilarity(s.content, section.content);
        return similarity > 0.85;
      });
      if (isDuplicate) {
        continue;
      }
      seen.add(normalized);
      deduplicated.push(section);
    }
    return deduplicated;
  }
  static calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2)
      return 1;
    if (s1.length === 0 || s2.length === 0)
      return 0;
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }
  static createSection(id, content, source, priority = 1) {
    return {
      id,
      content,
      tokens: TokenCounter.estimate(content),
      priority,
      source
    };
  }
  static createSections(items, source, priority = 1) {
    return items.map((item) => this.createSection(item.id, item.content, source, priority));
  }
}
// src/formatters/VariableFormatter.ts
class VariableFormatter {
  static VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;
  static extractVariables(template) {
    const matches = template.match(this.VARIABLE_PATTERN);
    if (!matches) {
      return [];
    }
    return matches.map((match) => match.replace(this.VARIABLE_PATTERN, "$1"));
  }
  static formatTemplate(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      if (value === undefined || value === null) {
        continue;
      }
      const pattern = this.VARIABLE_PATTERN;
      const replacement = this.formatValue(value);
      const regex = new RegExp(`\\{\\{${this.escapeRegExp(key)}\\}\\}`, "g");
      result = result.replace(regex, replacement);
    }
    return result;
  }
  static extractFromContext(context, options = {}) {
    const variables = {};
    if (options.includeProfile !== false && context.profile) {
      variables.userName = this.extractUserName(context.profile);
      variables.userTier = this.extractUserTier(context.profile);
      variables.userLocation = this.extractUserLocation(context.profile);
      variables.userAge = this.extractUserAge(context.profile);
      variables.userPreferences = this.extractUserPreferences(context.profile);
      const staticProfile = context.profile.static;
      const dynamicProfile = context.profile.dynamic;
      variables.profileStatic = staticProfile ? this.formatProfile(staticProfile) : "";
      variables.profileDynamic = dynamicProfile ? this.formatProfile(dynamicProfile) : "";
    }
    if (options.includeRecent !== false && context.recentMemories) {
      variables.recentMemoriesCount = String(context.recentMemories.length);
      variables.recentMemories = this.formatMemories(context.recentMemories);
      variables.lastInteraction = context.recentMemories[0] || "";
    }
    if (options.includeSearch !== false && context.searchResults) {
      variables.searchResultsCount = String(context.searchResults.length);
      variables.searchResults = this.formatMemories(context.searchResults);
      variables.topSearchResult = context.searchResults[0] || "";
    }
    return variables;
  }
  static formatValue(value) {
    if (Array.isArray(value)) {
      return value.join(`
`);
    }
    return String(value);
  }
  static escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  static extractUserName(profile) {
    if (!profile.static)
      return "";
    const nameFact = profile.static.find((s) => s.toLowerCase().includes("name") || s.match(/is\s+\w+/i));
    return this.extractNameFromFact(nameFact || "");
  }
  static extractNameFromFact(fact) {
    if (!fact)
      return "";
    const matches = fact.match(/(?:is|named|called)\s+(?:[A-Z][a-z]+|\w+)/i);
    return matches ? matches[1] || fact : fact;
  }
  static extractUserTier(profile) {
    if (!profile.static)
      return "standard";
    const tierKeywords = profile.static.filter((s) => ["vip", "premium", "gold", "platinum", "enterprise"].some((t) => s.toLowerCase().includes(t)));
    return tierKeywords.length > 0 ? tierKeywords[0].toLowerCase() : "standard";
  }
  static extractUserLocation(profile) {
    if (!profile.static)
      return "";
    const locationFact = profile.static.find((s) => ["lives", "located", "based in", "resides in"].some((loc) => s.toLowerCase().includes(loc)));
    if (!locationFact)
      return "";
    const location = locationFact.replace(/(?:lives|located|based in|resides in)\s+/i, "");
    return location;
  }
  static extractUserAge(profile) {
    if (!profile.static)
      return "";
    const ageFact = profile.static.find((s) => s.match(/\d+\s*(?:years?|y\.o\.?)/i));
    return ageFact || "";
  }
  static extractUserPreferences(profile) {
    if (!profile.static)
      return "";
    const preferenceFacts = profile.static.filter((s) => ["likes", "loves", "prefers", "enjoys", "hates", "dislikes"].some((pref) => s.toLowerCase().includes(pref)));
    return preferenceFacts.join("; ");
  }
  static formatProfile(items) {
    if (!items || items.length === 0)
      return "";
    return items.join(`
`);
  }
  static formatMemories(memories) {
    if (!memories || memories.length === 0)
      return "";
    return memories.slice(0, 5).join(`
`);
  }
}
// src/tools/MemoryTools.ts
class MemoryTools {
  static search = VapiToolFactory.createSearchTool();
  static profile = VapiToolFactory.createProfileTool();
  static recent = VapiToolFactory.createRecentMemoriesTool();
  static store = VapiToolFactory.createStoreMemoryTool();
  static fullContext = VapiToolFactory.createFullContextTool();
  static getStandardToolSet() {
    return [
      MemoryTools.search,
      MemoryTools.profile,
      MemoryTools.recent,
      MemoryTools.store,
      MemoryTools.fullContext
    ];
  }
  static getMinimalToolSet() {
    return [
      MemoryTools.search,
      MemoryTools.fullContext
    ];
  }
  static getAllToolNames() {
    return [
      "search_memories",
      "get_user_profile",
      "get_recent_memories",
      "store_memory",
      "get_full_context"
    ];
  }
  static getToolDefinition(name) {
    switch (name) {
      case "search_memories":
        return MemoryTools.search;
      case "get_user_profile":
        return MemoryTools.profile;
      case "get_recent_memories":
        return MemoryTools.recent;
      case "store_memory":
        return MemoryTools.store;
      case "get_full_context":
        return MemoryTools.fullContext;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
export {
  VariableFormatter,
  VapiToolFactory,
  VapiResponseBuilder,
  VapiMemory,
  TokenCounter,
  MemoryTools,
  LRUCache,
  ContextFormatter
};
