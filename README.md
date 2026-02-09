# vapi-memory

Memory provider for Vapi voice AI agents using Supermemory as backend. Enable your Vapi assistants to remember context across calls, maintain user profiles, and retrieve relevant memories for personalized conversations.

## Features

- ✅ **Zero-config setup**: Get started in 3 lines of code
- ✅ **Seamless Vapi integration**: Works with Vapi's server URL and tool patterns
- ✅ **TypeScript-first**: Full type safety and IntelliSense support
- ✅ **Context management**: Automatic token budgeting and context formatting
- ✅ **User profiles**: Maintains static and dynamic user information
- ✅ **Semantic search**: Retrieves relevant memories based on queries
- ✅ **Intelligent caching**: LRU cache with automatic cleanup for performance
- ✅ **Memory deduplication**: Removes duplicate and similar memories automatically
- ✅ **Priority-based ranking**: Sorts context by importance
- ✅ **Production-ready**: Error handling, logging, and monitoring

## Installation

```bash
bun add vapi-memory
# or
npm install vapi-memory
```

## Advanced Usage

### Token Counting

Use the `TokenCounter` utility for accurate token estimation:

```typescript
import { TokenCounter } from 'vapi-memory';

const text = 'Hello world!';
const tokens = TokenCounter.estimate(text); // ~3 tokens

// Format multiple texts within budget
const result = TokenCounter.formatWithinBudget(
  ['First', 'Second', 'Third'],
  20
);

console.log(result.formatted); // Text within 20 tokens
console.log(result.usedTokens); // Actual tokens used
console.log(result.includedCount); // Number of items included
```

### Caching

Use the `LRUCache` class for in-memory caching:

```typescript
import { LRUCache } from 'vapi-memory';

const cache = new LRUCache<string, number>(100);

cache.set('key1', 1);
cache.set('key2', 2);

const value = cache.get('key1'); // 1

// Get cache statistics
const stats = cache.getStats();
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);

// Cleanup expired entries
cache.cleanup(60000); // Remove entries older than 60s
```

### Context Formatting

Use `ContextFormatter` for advanced context management:

```typescript
import { ContextFormatter } from 'vapi-memory';

const sections = [
  { id: '1', content: 'User loves coffee', priority: 1, tokens: 10, source: 'profile' },
  { id: '2', content: 'Recent complaint', priority: 2, tokens: 15, source: 'recent' },
];

const result = ContextFormatter.format(sections, {
  maxTokens: 100,
  includeTokens: true,
  includeMetadata: true,
});

console.log(result.formatted); // Formatted context within budget
console.log(result.usedTokens); // Tokens used
console.log(result.metadata); // { totalItems, includedItems, excludedItems, sources }
```

## Quick Start

```bash
bun add vapi-memory
# or
npm install vapi-memory
```

## Quick Start

```typescript
import { VapiMemory } from 'vapi-memory';

const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY
});

// Get user context
const context = await memory.getContext({
  userId: '+1234567890',
  query: 'User calling for support'
});

// Store conversation after call
await memory.storeConversation({
  callId: 'call_123',
  userId: '+1234567890',
  transcript: [
    { role: 'user', content: 'I need help' },
    { role: 'assistant', content: 'How can I help?' }
  ]
});
```

## Usage with Vapi

### Server-Side Assistant Selection

Configure your Vapi phone number's server URL to return a personalized assistant:

```typescript
app.post('/api/assistant-selector', async (req, res) => {
  const { message, call } = req.body;

  if (message?.type === 'assistant-request') {
    const memory = new VapiMemory({
      apiKey: process.env.SUPERMEMORY_API_KEY
    });

    // Get context from Supermemory
    const context = await memory.getContext({
      userId: call.from.phoneNumber
    });

    // Return assistant with context
    return res.json(memory.createAssistantResponse(context, {
      name: 'Support Agent',
      model: { provider: 'openai', model: 'gpt-4o' }
    }));
  }
});
```

### Post-Call Storage

Store conversations after they end to build user profiles:

```typescript
app.post('/api/vapi-webhook', async (req, res) => {
  const { type, call, messages } = req.body;

  if (type === 'call-ended') {
    const memory = new VapiMemory({
      apiKey: process.env.SUPERMEMORY_API_KEY
    });

    await memory.storeConversation({
      callId: call.id,
      userId: call.from.phoneNumber,
      transcript: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    });
  }

  res.status(200).end();
});
```

### Memory Tool Integration

Create a tool for dynamic memory retrieval during calls:

```typescript
const memoryTool = {
  type: 'function' as const,
  name: 'get_user_memories',
  description: 'Retrieve relevant memories about the user',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' }
    },
    required: ['query']
  }
};

app.post('/api/tools/get_user_memories', async (req, res) => {
  const { parameters, call } = req.body;

  const memory = new VapiMemory({
    apiKey: process.env.SUPERMEMORY_API_KEY
  });

  const context = await memory.getContext({
    userId: call.from.phoneNumber,
    query: parameters.query
  });

  return res.json({
    memories: context.searchResults.join('\n')
  });
});
```

## API Reference

### `VapiMemory`

Main class for managing Vapi agent memory.

#### Constructor

```typescript
new VapiMemory(options: VapiMemoryOptions)
```

**Options:**
- `apiKey` (required): Supermemory API key
- `baseUrl` (optional): Custom base URL, default: 'https://api.supermemory.ai'
- `maxTokens` (optional): Maximum context tokens, default: 2000
- `searchThreshold` (optional): Search relevance threshold (0-1), default: 0.5
- `cacheEnabled` (optional): Enable caching, default: true
- `cacheTTL` (optional): Cache TTL in ms, default: 60000
- `logger` (optional): Custom logger, default: console

#### Methods

##### `getContext(request: GetContextRequest): Promise<FormattedContext>`

Retrieves context for a user including profile, recent memories, and search results.

**Request:**
- `userId` (required): User identifier
- `query` (optional): Current query for search
- `callId` (optional): Call ID for per-call memory
- `includeProfile` (optional): Include user profile, default: true
- `includeRecent` (optional): Include recent memories, default: true
- `includeSearch` (optional): Include search results, default: true

**Returns:**
```typescript
{
  profile?: {
    static: string[];      // Long-term facts
    dynamic: string[];     // Recent memories
  };
  recentMemories: string[];   // Latest interactions
  searchResults: string[];     // Semantically relevant
  totalTokens: number;          // Estimated token count
  metadata: {
    userId: string;
    retrievalTime: number;   // Time in ms
    sources: string[];       // Where data came from
  };
}
```

##### `storeConversation(call: StoreConversationRequest): Promise<void>`

Stores a conversation to build user profile.

**Request:**
- `callId` (required): Vapi call ID
- `userId` (required): User identifier
- `transcript` (required): Array of message objects with `role` and `content`
- `metadata` (optional): Additional metadata (duration, sentiment, etc.)

##### `getUserProfile(userId: string): Promise<UserProfile>`

Gets complete user profile from Supermemory.

##### `addMemory(memory: Memory): Promise<void>`

Adds a single memory to user profile.

##### `createAssistantResponse(context: FormattedContext, baseAssistant?): AssistantResponse`

Creates a Vapi assistant response with formatted context.

##### `createContextMessage(context: FormattedContext): Message`

Creates a system message with formatted context.

## Configuration

### Environment Variables

Set your Supermemory API key:

```bash
export SUPERMEMORY_API_KEY="your-api-key-here"
```

### Vapi Server URL Setup

1. Go to your Vapi dashboard
2. Select your phone number
3. Set server URL to your endpoint (e.g., `https://your-server.com/api/assistant-selector`)
4. Configure your server to handle `assistant-request` messages

## Examples

See `examples/` directory for complete working examples:

- `basic-usage.ts` - Simple usage demonstration
- `server-integration.ts` - Vapi server integration
- `tool-integration.ts` - Tool-based memory retrieval
- `multi-tenant.ts` - Multi-tenant application

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build
bun run build

# Watch mode
bun run dev
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines.

## Support

- 📖 [Documentation](https://github.com/yourusername/vapi-memory)
- 🐛 [Issue Tracker](https://github.com/yourusername/vapi-memory/issues)
