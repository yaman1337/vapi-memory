export interface VapiMemoryOptions {
  apiKey: string;
  baseUrl?: string;
  maxTokens?: number;
  searchThreshold?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  logger?: Logger;
}

export interface GetContextRequest {
  userId: string;
  query?: string;
  callId?: string;
  includeProfile?: boolean;
  includeRecent?: boolean;
  includeSearch?: boolean;
  maxTokens?: number;
}

export interface FormattedContext {
  profile?: {
    static: string[];
    dynamic: string[];
  };
  recentMemories: string[];
  searchResults: string[];
  totalTokens: number;
  metadata: {
    userId: string;
    retrievalTime: number;
    sources: string[];
  };
}

export interface StoreConversationRequest {
  callId: string;
  userId: string;
  transcript: VapiTranscript[];
  metadata?: Record<string, any>;
}

export interface VapiTranscript {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface UserProfile {
  userId: string;
  static: string[];
  dynamic: string[];
}

export interface Memory {
  userId: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface AssistantResponse {
  assistantId?: string;
  assistant?: Assistant;
  assistantOverrides?: AssistantOverrides;
}

export interface Assistant {
  name?: string;
  model?: ModelConfig;
  messages?: Message[];
  voice?: VoiceConfig;
  tools?: Tool[];
}

export interface AssistantOverrides {
  messages?: Message[];
  variableValues?: Record<string, string>;
  tools?: Tool[];
  model?: ModelConfig;
  voice?: VoiceConfig;
}

export interface ModelConfig {
  provider: string;
  model: string;
  messages?: Message[];
}

export interface VoiceConfig {
  provider: string;
  voiceId: string;
}

export interface Tool {
  type: 'function' | 'code' | 'integration';
  name: string;
  description?: string;
  parameters?: any;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | any[];
  name?: string;
  toolCalls?: any[];
}

export interface Logger {
  info(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
  debug(...args: any[]): void;
}

export interface SupermemoryProfile {
  profile: {
    static: string[];
    dynamic: string[];
  };
  searchResults?: {
    results: Array<{
      memory: string;
      score: number;
      metadata?: Record<string, any>;
    }>;
    total: number;
    timing: number;
  };
}
