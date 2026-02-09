import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { VapiMemory } from '../src/VapiMemory';
import type { GetContextRequest, FormattedContext, StoreConversationRequest } from '../src/types';

describe('VapiMemory', () => {
  let memory: VapiMemory;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    };

    memory = new VapiMemory({
      apiKey: 'test-key',
      logger: mockLogger,
    });
  });

  afterEach(() => {
    // Cleanup if needed
  });

  test('should initialize with default options', () => {
    expect(memory).toBeDefined();
  });

  test('should initialize with custom options', () => {
    const customMemory = new VapiMemory({
      apiKey: 'custom-key',
      maxTokens: 4000,
      searchThreshold: 0.7,
      cacheEnabled: false,
      cacheTTL: 120000,
      logger: mockLogger,
    });

    expect(customMemory).toBeDefined();
  });

  test('should create context message correctly', () => {
    const context: FormattedContext = {
      profile: {
        static: ['User is 25 years old', 'User lives in New York'],
        dynamic: ['Called yesterday about order status', 'Interested in product X'],
      },
      recentMemories: ['User asked about pricing', 'User complained about delivery'],
      searchResults: ['User prefers email communication', 'User has a discount code'],
      totalTokens: 500,
      metadata: {
        userId: 'user123',
        retrievalTime: 100,
        sources: ['profile', 'recent-memories', 'search'],
      },
    };

    const message = memory.createContextMessage(context);

    expect(message.role).toBe('system');
    expect(message.content).toContain('User context:');
    expect(message.content).toContain('Static Profile:');
    expect(message.content).toContain('User is 25 years old');
    expect(message.content).toContain('Dynamic Profile:');
    expect(message.content).toContain('Recent Memories:');
    expect(message.content).toContain('Relevant Memories:');
    expect(message.content).toContain('500 estimated tokens');
    expect(message.content).toContain('100ms');
  });

  test('should create context message with minimal data', () => {
    const context: FormattedContext = {
      recentMemories: [],
      searchResults: [],
      totalTokens: 0,
      metadata: {
        userId: 'user123',
        retrievalTime: 50,
        sources: [],
      },
    };

    const message = memory.createContextMessage(context);

    expect(message.role).toBe('system');
    expect(message.content).toContain('User context:');
    expect(message.content).toContain('0 estimated tokens');
  });

  test('should create assistant response with context', () => {
    const context: FormattedContext = {
      profile: {
        static: ['User is VIP customer'],
        dynamic: [],
      },
      recentMemories: [],
      searchResults: [],
      totalTokens: 100,
      metadata: {
        userId: 'user123',
        retrievalTime: 50,
        sources: ['profile'],
      },
    };

    const response = memory.createAssistantResponse(context, {
      name: 'Support Agent',
      model: { provider: 'openai', model: 'gpt-4o' },
    });

    expect(response).toBeDefined();
    expect(response.assistant).toBeDefined();
    if (response.assistant) {
      expect(response.assistant.name).toBe('Support Agent');
      expect(response.assistant.messages).toBeDefined();
      expect(response.assistant.messages?.[0]?.role).toBe('system');
      expect(response.assistant.messages?.[0]?.content).toContain('User context:');
    }
  });

  test('should create assistant response without base assistant', () => {
    const context: FormattedContext = {
      recentMemories: [],
      searchResults: [],
      totalTokens: 0,
      metadata: {
        userId: 'user123',
        retrievalTime: 0,
        sources: [],
      },
    };

    const response = memory.createAssistantResponse(context);

    expect(response).toBeDefined();
    // With new implementation, returns either assistant or assistantOverrides
    if (response.assistant) {
      expect(response.assistant.messages).toBeDefined();
      expect(response.assistant.messages?.[0]).toBeDefined();
    } else if (response.assistantOverrides) {
      expect(response.assistantOverrides).toBeDefined();
      expect(response.assistantOverrides?.messages).toBeDefined();
    }
  });

  test('should estimate tokens correctly', () => {
    const shortText = 'Hello';
    const mediumText = 'Hello, how are you today? I hope you are doing well.';
    const longText = 'This is a much longer text that contains many more words and characters to test the token estimation algorithm.';

    const shortTokens = (memory as any).estimateTokens(shortText);
    const mediumTokens = (memory as any).estimateTokens(mediumText);
    const longTokens = (memory as any).estimateTokens(longText);

    expect(shortTokens).toBeGreaterThan(0);
    expect(mediumTokens).toBeGreaterThan(shortTokens);
    expect(longTokens).toBeGreaterThan(mediumTokens);
  });
});
