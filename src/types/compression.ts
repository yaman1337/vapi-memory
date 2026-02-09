export interface CompressionConfig {
  enabled: boolean;
  provider: 'openai' | 'anthropic' | 'ollama' | 'none';
  model?: string;
  mode: 'aggressive' | 'balanced' | 'conservative';
  preserveProfile?: boolean;
  preserveKeyFacts?: string[];
  maxSummaryTokens?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

export interface CompressionResult {
  original: string;
  originalTokens: number;
  compressed: string;
  compressedTokens: number;
  compressionRatio: number;
  preservedFacts: string[];
  metadata: {
    provider: string;
    model: string;
    timestamp: string;
    processingTimeMs: number;
  };
}

export interface CompressionOptions {
  targetTokens?: number;
  preserveSpecificFacts?: string[];
  extractEntities?: boolean;
  includeMetadata?: boolean;
}

export interface SummaryRequest {
  memories: string[];
  context?: string;
  query?: string;
  preserveFacts?: string[];
  targetTokens?: number;
  memoryType?: 'static' | 'dynamic' | 'conversation';
}

export interface SummaryResult {
  summary: string;
  preservedFacts: string[];
  confidence: number;
  usedTechnique: string;
}

export interface KeyPoint {
  fact: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  category: 'name' | 'preference' | 'contact' | 'location' | 'date' | 'event' | 'relationship' | 'preference';
  source: string;
  extractedAt: string;
}
