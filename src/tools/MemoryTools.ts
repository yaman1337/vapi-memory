import { VapiToolFactory } from './VapiToolFactory';

export class MemoryTools {
  static readonly search = VapiToolFactory.createSearchTool();
  static readonly profile = VapiToolFactory.createProfileTool();
  static readonly recent = VapiToolFactory.createRecentMemoriesTool();
  static readonly store = VapiToolFactory.createStoreMemoryTool();
  static readonly fullContext = VapiToolFactory.createFullContextTool();

  static getStandardToolSet(): any[] {
    return [
      MemoryTools.search,
      MemoryTools.profile,
      MemoryTools.recent,
      MemoryTools.store,
      MemoryTools.fullContext,
    ];
  }

  static getMinimalToolSet(): any[] {
    return [
      MemoryTools.search,
      MemoryTools.fullContext,
    ];
  }

  static getAllToolNames(): string[] {
    return [
      'search_memories',
      'get_user_profile',
      'get_recent_memories',
      'store_memory',
      'get_full_context',
    ];
  }

  static getToolDefinition(name: string): any {
    switch (name) {
      case 'search_memories':
        return MemoryTools.search;
      case 'get_user_profile':
        return MemoryTools.profile;
      case 'get_recent_memories':
        return MemoryTools.recent;
      case 'store_memory':
        return MemoryTools.store;
      case 'get_full_context':
        return MemoryTools.fullContext;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
