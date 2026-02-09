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
  query: 'User calling for support'
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

## 🚀 Complete Vapi Integration Guide

This guide shows you **exactly how** to integrate vapi-memory with your Vapi server to give your voice AI long-term memory.

### Step 1: Set Up Your Server URL

Configure your Vapi phone number to use your server instead of a fixed assistant:

1. Go to [Vapi Dashboard](https://dashboard.vapi.ai)
2. Select your phone number
3. Click "Server URL" or "Assistant"
4. Set URL to: `https://your-server.com/api/assistant-selector`

**Your server** will handle `assistant-request` messages from Vapi and return personalized assistant configurations.

### Step 2: Create Assistant Request Handler

Add this endpoint to your server:

```typescript
import { VapiMemory } from 'vapi-memory';

const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY
});

app.post('/api/assistant-selector', async (req, res) => {
  const { message, call } = req.body;

  // Vapi sends assistant-request when call comes in
  if (message?.type === 'assistant-request') {
    const phoneNumber = call.from.phoneNumber;

    console.log(`📞 Incoming call from: ${phoneNumber}`);

    // Get user's context from Supermemory (cached for speed!)
    const context = await memory.getContext({
      userId: phoneNumber,  // Use phone number as user ID
      query: 'Incoming call',  // Optional query for better results
      includeProfile: true,   // Get static + dynamic profile
      includeRecent: true,    // Get recent conversation history
      includeSearch: true      // Search for relevant memories
    });

    console.log(`✅ Context retrieved in ${context.metadata.retrievalTime}ms`);
    console.log(`📊 Profile: ${context.profile?.static.length || 0} static, ${context.profile?.dynamic.length || 0} dynamic`);

    // Return personalized assistant with context baked in
    const response = memory.createAssistantResponse(context, {
      name: 'Customer Support Agent',
      model: {
        provider: 'openai',
        model: 'gpt-4o'
      },
      voice: {
        provider: '11labs',
        voiceId: 'rachel'
      }
    });

    return res.json(response);
  }

  res.status(200).end();
});
```

### Step 3: Handle Call-Ended Events

Store conversations after calls end to build user profiles over time:

```typescript
app.post('/api/vapi-webhook', async (req, res) => {
  const { type, call, messages } = req.body;

  // Vapi sends call-ended when call finishes
  if (type === 'call-ended') {
    const phoneNumber = call.from.phoneNumber;

    console.log(`📞 Call ended: ${call.id}`);

    const memory = new VapiMemory({
      apiKey: process.env.SUPERMEMORY_API_KEY
    });

    // Store the full conversation to Supermemory
    await memory.storeConversation({
      callId: call.id,
      userId: phoneNumber,
      transcript: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.transcript?.transcriptedAt
      })),
      metadata: {
        duration: call.duration,
        endedReason: call.endedReason,
        timestamp: new Date().toISOString()
      }
    });

    console.log('✅ Conversation stored successfully');
  }

  res.status(200).end();
});
```

### Step 4: Optional - Add Memory Tools

Let your Vapi assistant proactively fetch memories during conversations:

```typescript
import { VapiToolFactory } from 'vapi-memory';

// Define a memory tool for your Vapi assistant
const memoryTool = {
  type: 'function' as const,
  name: 'get_user_memories',
  description: 'Retrieve relevant memories about the user from their history',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'What to search for in user history'
      }
    },
    required: ['query']
  }
};

// Add this tool to your assistant in Vapi dashboard
// When assistant needs context, it will call your server endpoint

// Handle tool requests from Vapi
app.post('/api/tools/get_user_memories', async (req, res) => {
  const { parameters, call } = req.body;

  const memory = new VapiMemory({
    apiKey: process.env.SUPERMEMORY_API_KEY
  });

  // Search for memories based on what user asked
  const context = await memory.getContext({
    userId: call.from.phoneNumber,
    query: parameters.query,
    includeSearch: true,
    includeRecent: false,
    includeProfile: false
  });

  return res.json({
    memories: context.searchResults.join('\n\n'),
    count: context.searchResults.length
  });
});
```

### Step 5: Complete Working Example

See [examples/vapi-bun-server.ts](examples/vapi-bun-server.ts) for a complete, production-ready implementation that includes:

- ✅ Assistant request handler with memory
- ✅ Tool handlers for all 5 memory tools
- ✅ Post-call webhook for conversation storage
- ✅ CORS support for development
- ✅ Error handling and logging
- ✅ Hot-reload for development

Run it:
```bash
cp .env.example .env
# Edit .env and add your SUPERMEMORY_API_KEY
bun run examples/vapi-bun-server.ts
```

### Complete Data Flow

```
User Calls Your Vapi Phone Number
         │
         ▼
Vapi sends assistant-request → Your Server (Step 2)
         │
         ├─ Get Context from Supermemory
         │  ├─ Cache check (sub-50ms if cached!)
         │  ├─ Profile lookup (static + dynamic facts)
         │  ├─ Recent memories (last conversations)
         │  └─ Semantic search (relevant to current query)
         │
         ▼
Return personalized assistant → Vapi (within 7.5s!)
         │
         ▼
AI responds with full context about the user
         │
         ├─ "Hi John! I see you're a VIP customer..."
         ├─ "Your last order was #12345..."
         ├─ "You love coffee, right?"
         └─ "...from your conversation last Tuesday"
         │
         ▼
Call ends → Vapi sends call-ended → Your Server (Step 3)
         │
         ▼
Store full conversation → Supermemory
         │
         ├─ Analyzes conversation
         ├─ Extracts key facts and preferences
         ├─ Updates user profile (static + dynamic)
         ├─ Adds to searchable memory
         └─ Caches for instant retrieval next call!
```

### Configuration Checklist

Before going to production, make sure you have:

- [ ] **Supermemory API Key** - Get from [supermemory.ai](https://supermemory.ai)
- [ ] **Server Endpoint** - Deploy your server (Railway, Vercel, AWS Lambda, etc.)
- [ ] **HTTPS** - Required for production Vapi integrations
- [ ] **Error Handling** - Handle API failures gracefully
- [ ] **Rate Limiting** - Don't overload Supermemory or Vapi
- [ ] **Monitoring** - Track memory retrieval times and error rates

### Performance Tips

1. **Enable Caching** - Profile lookups are cached by default (60s TTL)
2. **Use Phone Numbers as User IDs** - Easy to identify callers
3. **Set Appropriate Timeouts** - Vapi requires response within 7.5s
4. **Monitor Memory Usage** - Keep track of cache hit rates and API calls
5. **Handle Errors Gracefully** - If Supermemory is down, return a basic assistant

## 🧪 API Reference

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

##### `createAssistantResponse(context, baseAssistant?): AssistantResponse`

Creates a Vapi assistant response with formatted context.

##### `getUserProfile(userId: string): Promise<UserProfile>`

Gets complete user profile from Supermemory.

##### `addMemory(memory: Memory): Promise<void>`

Adds a single memory to user profile.

##### `buildWithTools(context, baseAssistant?, tools?): AssistantResponse`

Builds assistant with memory tools for dynamic retrieval.

##### `buildWithVariables(context, baseAssistant?): AssistantResponse`

Builds assistant with variable-based personalization (`{{userName}}`, etc.).

##### `getCacheStats()`

Returns cache statistics including hit rate and entry count.

##### `clearCache()`

Clears all cached profile data.

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
3. Set server URL to: `https://your-server.com/api/assistant-selector`
4. Configure your server to handle `assistant-request` messages (see Step 2 above)
5. Set webhook URL to: `https://your-server.com/api/vapi-webhook` (optional, for call-ended events)

### Vapi Tool Server Setup

1. Create tool endpoints at `/api/tools/{toolName}` on your server
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
