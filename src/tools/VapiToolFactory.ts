import type { Tool } from '../types';

export interface ToolDefinition {
  type: 'function' | 'code' | 'integration';
  name: string;
  description: string;
  parameters: any;
}

export class VapiToolFactory {
  static createSearchTool(): ToolDefinition {
    return {
      type: 'function',
      name: 'search_memories',
      description: 'Search user memories using semantic similarity. Use this to find relevant information about the user based on their query.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find relevant memories',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)',
            default: 5,
          },
          threshold: {
            type: 'number',
            description: 'Minimum similarity threshold (0-1, default: 0.5)',
            default: 0.5,
          },
        },
        required: ['query'],
      },
    };
  }

  static createProfileTool(): ToolDefinition {
    return {
      type: 'function',
      name: 'get_user_profile',
      description: 'Get user profile information including static facts, dynamic memories, and recent context.',
      parameters: {
        type: 'object',
        properties: {
          section: {
            type: 'string',
            enum: ['static', 'dynamic', 'all'],
            description: 'Which section of the profile to retrieve (default: all)',
            default: 'all',
          },
        },
        required: [],
      },
    };
  }

  static createRecentMemoriesTool(): ToolDefinition {
    return {
      type: 'function',
      name: 'get_recent_memories',
      description: 'Get recent conversation memories for the user.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of recent memories to return (default: 3)',
            default: 3,
          },
        },
        required: [],
      },
    };
  }

  static createStoreMemoryTool(): ToolDefinition {
    return {
      type: 'function',
      name: 'store_memory',
      description: 'Store important information to user profile for future use.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'Information to store in memory',
          },
          metadata: {
            type: 'object',
            description: 'Optional metadata for this memory (e.g., category, importance)',
          },
        },
        required: ['content'],
      },
    };
  }

  static createFullContextTool(): ToolDefinition {
    return {
      type: 'function',
      name: 'get_full_context',
      description: 'Get complete user context including profile, recent memories, and search results. Use this when you need comprehensive user information.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for finding relevant memories',
          },
          includeProfile: {
            type: 'boolean',
            description: 'Include user profile (default: true)',
            default: true,
          },
          includeRecent: {
            type: 'boolean',
            description: 'Include recent memories (default: true)',
            default: true,
          },
          includeSearch: {
            type: 'boolean',
            description: 'Include search results (default: true)',
            default: true,
          },
        },
        required: [],
      },
    };
  }

  static createToolSet(includeSearch = true): Tool[] {
    const tools: Tool[] = [];

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
