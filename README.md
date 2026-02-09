# vapi-memory

**Give your Vapi voice AI agents long-term memory.** Make them remember conversations across calls, maintain user profiles, and retrieve relevant context for personalized conversations every time.

## 🚀 Why vapi-memory?

Voice AI is powerful, but without memory, every call feels like talking to a stranger. vapi-memory solves this by:

- ✅ **Remember conversations** across calls - not just within a session
- ✅ **Build user profiles** with facts, preferences, and history
- ✅ **Retrieve relevant context** based on what's being discussed
- ✅ **Seamless Vapi integration** - just 3 lines of code to get started
- ✅ **Production-ready** - caching, error handling, and monitoring built-in

## ⚡ Quick Start

```typescript
import { VapiMemory } from 'vapi-memory';

const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY
});

// Get user context before/during call
const context = await memory.getContext({
  userId: '+1234567890',
  query: 'User calling about support'
});

// Return personalized assistant with context
return res.json(memory.createAssistantResponse(context, {
  name: 'Support Agent',
  model: { provider: 'openai', model: 'gpt-4o' }
}));

// Store conversation after call ends
await memory.storeConversation({
  callId: 'call_123',
  userId: '+1234567890',
  transcript: [
    { role: 'user', content: 'I need help with my order' },
    { role: 'assistant', content: 'How can I help you today?' }
  ]
});
```

## 📖 Installation

```bash
bun add vapi-memory
# or
npm install vapi-memory
```

## 💡 Usage with Vapi

### 1. Server-Side Assistant Selection (Recommended)

Configure your Vapi phone number's server URL to return a personalized assistant:

```typescript
import { VapiMemory } from 'vapi-memory';

const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY
});

app.post('/api/assistant-selector', async (req, res) => {
  const { message, call } = req.body;

  if (message?.type === 'assistant-request') {
    // Get user's context from Supermemory
    const context = await memory.getContext({
      userId: call.from.phoneNumber,
      query: 'Incoming call'
    });

    // Return assistant with context baked in
    return res.json(memory.createAssistantResponse(context, {
      name: 'Support Agent',
      model: { provider: 'openai', model: 'gpt-4o' }
    }));
  }
});
```

**How it works:**
1. User calls your Vapi phone number
2. Vapi sends `assistant-request` to your server
3. Your server fetches user's memory from Supermemory
4. You return a personalized assistant with that context
5. User talks to an AI that remembers them!

### 2. Tool-Based Memory Retrieval

Let your Vapi assistant proactively fetch memories during conversations:

```typescript
import { VapiToolFactory } from 'vapi-memory';

// Create memory tool
const memoryTool = VapiToolFactory.createSearchTool();

app.post('/api/tools/get_user_memories', async (req, res) => {
  const { parameters, call } = req.body;

  const memory = new VapiMemory({
    apiKey: process.env.SUPERMEMORY_API_KEY
  });

  // Search for relevant memories based on what user asked
  const context = await memory.getContext({
    userId: call.from.phoneNumber,
    query: parameters.query
  });

  return res.json({
    memories: context.searchResults.join('\n')
  });
});
```

**How it works:**
1. User asks: "What did we discuss about my order?"
2. Vapi calls your tool with query
3. Your tool searches Supermemory for order-related memories
4. Returns relevant memories to the AI
5. AI responds with accurate context

### 3. Post-Call Storage

Store conversations to build user profiles over time:

```typescript
import { VapiMemory } from 'vapi-memory';

app.post('/api/vapi-webhook', async (req, res) => {
  const { type, call, messages } = req.body;

  if (type === 'call-ended') {
    const memory = new VapiMemory({
      apiKey: process.env.SUPERMEMORY_API_KEY
    });

    // Store the full conversation
    await memory.storeConversation({
      callId: call.id,
      userId: call.from.phoneNumber,
      transcript: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      metadata: {
        duration: call.duration,
        timestamp: new Date().toISOString()
      }
    });
  }

  res.status(200).end();
});
```

**How it works:**
1. Call ends
2. Vapi sends `call-ended` webhook
3. Your server stores the full conversation to Supermemory
4. Supermemory's AI analyzes and adds it to the user's profile
5. Next call, the AI knows everything discussed previously!

## 📚 Examples

Complete working examples in the `examples/` directory:

| Example | Description | Link |
|---------|-------------|------|
| **[Basic Usage](examples/basic-usage.ts)** | Simple context retrieval and storage | [View](examples/basic-usage.ts) |
| **[Vapi Bun Server](examples/vapi-bun-server.ts)** | Complete Vapi server with all patterns | [View](examples/vapi-bun-server.ts) |
| **[Server Integration](examples/server-integration.ts)** | Server-side assistant selection | [View](examples/server-integration.ts) |
| **[Advanced Context](examples/advanced-context.ts)** | Cache performance and context management | [View](examples/advanced-context.ts) |

### Vapi Bun Server - Complete Example

The [vapi-bun-server.ts](examples/vapi-bun-server.ts) example shows the complete flow:

```
User Calls → Vapi → Your Server → Get Context → Supermemory
                                                      ↓
                                              Return Assistant → Vapi → AI Response
                                                      ↓
                                              Store Conversation → Supermemory
```

**What's included:**
- ✅ Assistant request handler with memory
- ✅ Tool handlers for all 5 memory tools
- ✅ Post-call webhook for conversation storage
- ✅ CORS support for production
- ✅ Hot-reload for development

Run it:
```bash
cp .env.example .env
# Edit .env and add your SUPERMEMORY_API_KEY
bun run examples/vapi-bun-server.ts
```

## 🔧 API Reference

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

##### `buildWithTools(context, baseAssistant?, tools?): AssistantResponse`

Builds assistant with memory tools for dynamic retrieval.

##### `buildWithVariables(context, baseAssistant?): AssistantResponse`

Builds assistant with variable-based personalization (`{{userName}}`, etc.).

##### `getCacheStats()`

Returns cache statistics including hit rate and entry count.

##### `clearCache()`

Clears all cached profile data.

##### `destroy()`

Cleans up resources and stops background tasks.

## ⚙️ Configuration

### Environment Variables

Set your Supermemory API key:

```bash
cp .env.example .env
# Edit .env and add your actual API key
export SUPERMEMORY_API_KEY="your-api-key-here"
```

### Vapi Server URL Setup

1. Go to your Vapi dashboard (https://dashboard.vapi.ai)
2. Select your phone number
3. Set server URL to your endpoint: `https://your-server.com/api/assistant-selector`
4. Configure your server to handle `assistant-request` messages
5. Set webhook URL to: `https://your-server.com/api/vapi-webhook`

### Vapi Tool Server Setup

1. Create tool server endpoints at `/api/tools/{toolName}`
2. Configure tools in Vapi assistant or server
3. Tools call your endpoints dynamically during conversations
4. Return memories from Supermemory in real-time

## 🧪 Development

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

## 📊 How It Works

```
┌─────────────────────────────────────────────────────┐
│                  Vapi Call                    │
└──────────────────┬──────────────────────────────┘
                   │
                   │ 1. Incoming Call (assistant-request)
                   ▼
          ┌─────────────────┐
          │   Your Server   │
          └────────┬────────┘
                   │
                   │ 2. Call vapi-memory.getContext(userId)
                   ▼
    ┌──────────────────────────────────────────┐
    │           Vapi-Memory Library            │
    │                                          │
    │  ┌────────────────────────────────────┐  │
    │  │  Supermemory Client Wrapper        │  │
    │  │  - profile()                       │  │
    │  │  - add()                           │  │
    │  │  - search.memories()               │  │
    │  └────────────────────────────────────┘  │
    │                                          │
    │  ┌────────────────────────────────────┐  │
    │  │  Context Formatter                │  │
    │  │  - Token budgeting                 │  │
    │  │  - Relevance ranking               │  │
    │  │  - Deduplication                  │  │
    │  └────────────────────────────────────┘  │
    │                                          │
    │  ┌────────────────────────────────────┐  │
    │  │  Vapi Response Builder            │  │
    │  │  - System message injection        │  │
    │  │  - Assistant configuration          │  │
    │  └────────────────────────────────────┘  │
    └────────────────────┬─────────────────────┘
                         │
                         │ 3. Return context
                         ▼
    ┌──────────────────────────────────────────┐
    │         Supermemory API                 │
    │  (User profile + semantic search)      │
    └──────────────────────────────────────────┘
                         │
                         │ 4. Formatted context
                         ▼
              ┌─────────────────┐
              │   Your Server   │
              └────────┬────────┘
                       │
                       │ 5. Return assistant with context to Vapi
                       ▼
              ┌─────────────────┐
              │      Vapi       │
              │  (AI responds)  │
              └─────────────────┘
                       │
                       │ 6. Call ends (call-ended event)
                       ▼
              ┌─────────────────┐
              │   Your Server   │
              └────────┬────────┘
                       │
                       │ 7. Call vapi-memory.storeConversation()
                       ▼
    ┌──────────────────────────────────────────┐
    │           Vapi-Memory Library            │
    │  (Ingest conversation to Supermemory)  │
    └──────────────────────────────────────────┘
```

## 📦 Package Contents

```
vapi-memory/
├── src/
│   ├── VapiMemory.ts              # Main library class
│   ├── client/
│   │   └── SupermemoryClient.ts   # Supermemory API wrapper
│   ├── builders/
│   │   └── VapiResponseBuilder.ts # Vapi response construction
│   ├── formatters/
│   │   ├── ContextFormatter.ts      # Context formatting & deduplication
│   │   └── VariableFormatter.ts     # Variable extraction & formatting
│   ├── tools/
│   │   ├── VapiToolFactory.ts     # Create Vapi tools
│   │   └── MemoryTools.ts          # Pre-built tool sets
│   ├── utils/
│   │   ├── cache.ts                # LRU cache implementation
│   │   └── token-counter.ts        # Token estimation
│   └── types/
│       └── index.ts                # TypeScript definitions
├── examples/
│   ├── basic-usage.ts             # Simple usage demonstration
│   ├── vapi-bun-server.ts         # Complete Vapi server ⭐
│   ├── server-integration.ts        # Server-side assistant selection
│   └── advanced-context.ts         # Cache performance demo
├── test/
│   ├── VapiMemory.test.ts         # Core library tests
│   ├── TokenCounter.test.ts        # Token counting tests
│   ├── LRUCache.test.ts           # Cache tests
│   └── ContextFormatter.test.ts    # Formatting tests
└── README.md                      # This file
```

## 🎯 Use Cases

- **Customer Support**: Remember previous issues, user preferences, VIP status
- **Personal Assistants**: Learn user habits, routines, and preferences
- **Sales**: Recall previous conversations, deals in progress, client history
- **Healthcare**: Remember patient history, medications, appointments
- **Education**: Track student progress, previous discussions, learning goals

## 🔒 Security

- Never commit API keys to version control
- Use environment variables for sensitive configuration
- Validate user IDs before querying Supermemory
- Use HTTPS for all API calls
- Enable rate limiting to prevent abuse

## 📝 License

MIT - Free to use in personal and commercial projects

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines.

- Fork the repository
- Create a feature branch
- Make your changes
- Write tests
- Submit a pull request

## 🆘 Support

- 📖 [Documentation](https://github.com/yourusername/vapi-memory)
- 🐛 [Issue Tracker](https://github.com/yourusername/vapi-memory/issues)
- 💬 [Discussions](https://github.com/yourusername/vapi-memory/discussions)

---

**Made with ❤️ for the Vapi community**
