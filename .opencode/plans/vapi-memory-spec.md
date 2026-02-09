# Vapi-Memory Specification

## Overview

**vapi-memory** is a Bun/TypeScript library that provides seamless memory integration for Vapi voice AI agents using Supermemory as the backend. It enables Vapi assistants to remember context across calls, maintain user profiles, and retrieve relevant memories for personalized conversations.

### Goals

- ✅ **Zero-config setup**: Get started with just 3 lines of code
- ✅ **Seamless Vapi integration**: Works with Vapi's server URL and tool patterns
- ✅ **TypeScript-first**: Full type safety and IntelliSense support
- ✅ **Performance**: < 100ms context retrieval for real-time voice conversations
- ✅ **Flexible memory management**: Per-call and per-user memory isolation
- ✅ **Production-ready**: Error handling, retries, logging, and monitoring

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Vapi Call                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ 1. Incoming Call (assistant-request)
                       ▼
              ┌─────────────────┐
              │   Your Server   │
              └────────┬────────┘
                       │
                       │ 2. Call vapi-memory.getContext(userId, query)
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
    │  │  - Variable formatting            │  │
    │  │  - Tool configuration              │  │
    │  └────────────────────────────────────┘  │
    └────────────────────┬─────────────────────┘
                         │
                         │ 3. Return context
                         ▼
    ┌──────────────────────────────────────────┐
    │         Supermemory API                 │
    │  (User profile + semantic search)        │
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
                       │ 7. Call vapi-memory.storeConversation(callId, transcript, userId)
                       ▼
    ┌──────────────────────────────────────────┐
    │           Vapi-Memory Library            │
    │  (Ingest conversation to Supermemory)    │
    └──────────────────────────────────────────┘
```

---

## Core API Design

### Class: `VapiMemory`

```typescript
class VapiMemory {
  constructor(options: VapiMemoryOptions)

  // Context Retrieval
  getContext(request: GetContextRequest): Promise<FormattedContext>

  // Conversation Storage
  storeConversation(call: StoreConversationRequest): Promise<void>

  // User Profile Management
  getUserProfile(userId: string): Promise<UserProfile>

  // Memory Operations
  addMemory(memory: Memory): Promise<void>
  forgetMemory(memoryId: string): Promise<void>

  // Vapi Integration Helpers
  createAssistantResponse(context: FormattedContext, baseAssistant?: Partial<Assistant>): AssistantResponse
  createContextMessage(context: FormattedContext): Message
}
```

### Types

```typescript
interface VapiMemoryOptions {
  apiKey: string                      // Supermemory API key
  baseUrl?: string                   // Default: https://api.supermemory.ai
  maxTokens?: number                 // Default: 2000
  searchThreshold?: number           // Default: 0.5 (0-1)
  cacheEnabled?: boolean             // Default: true
  cacheTTL?: number                  // Default: 60000 (ms)
  logger?: Logger                    // Default: console
}

interface GetContextRequest {
  userId: string                     // User identifier
  query?: string                     // Current user query/message
  callId?: string                    // Current call ID for per-call memory
  includeProfile?: boolean           // Default: true
  includeRecent?: boolean            // Default: true
  includeSearch?: boolean             // Default: true
  maxTokens?: number                 // Override default
}

interface FormattedContext {
  profile?: {
    static: string[]
    dynamic: string[]
  }
  recentMemories: string[]
  searchResults: string[]
  totalTokens: number
  metadata: {
    userId: string
    retrievalTime: number
    sources: string[]
  }
}

interface StoreConversationRequest {
  callId: string
  userId: string
  transcript: VapiTranscript[]
  metadata?: Record<string, any>
}

interface VapiTranscript {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
}

interface AssistantResponse {
  assistantId?: string
  assistant?: Assistant
  assistantOverrides?: AssistantOverrides
}
```

---

## Integration Patterns

### Pattern 1: Server-Side Assistant Selection (Recommended)

**Use case**: Dynamic assistant configuration per user/call

```typescript
// Your server endpoint
app.post('/api/assistant-selector', async (req, res) => {
  const { message, call } = req.body;

  if (message?.type === 'assistant-request') {
    const phoneNumber = call.from.phoneNumber;

    // 1. Get context from vapi-memory
    const memory = new VapiMemory({
      apiKey: process.env.SUPERMEMORY_API_KEY
    });

    const context = await memory.getContext({
      userId: phoneNumber,
      query: 'User calling',  // Initial greeting context
      includeProfile: true
    });

    // 2. Create assistant response with context
    const response = memory.createAssistantResponse(
      context,
      {
        name: 'Customer Support Agent',
        model: {
          provider: 'openai',
          model: 'gpt-4o'
        }
      }
    );

    return res.json(response);
  }
});
```

### Pattern 2: Memory Tool Integration

**Use case**: Dynamic memory retrieval during call via Vapi tools

```typescript
// Create memory tool for Vapi
const memoryTool = {
  type: 'function' as const,
  name: 'get_relevant_memories',
  description: 'Retrieve relevant memories about the user',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to search for' }
    },
    required: ['query']
  }
};

// Your server endpoint
app.post('/api/tools/get_relevant_memories', async (req, res) => {
  const { parameters, call } = req.body;

  const memory = new VapiMemory({
    apiKey: process.env.SUPERMEMORY_API_KEY
  });

  const context = await memory.getContext({
    userId: call.from.phoneNumber,
    query: parameters.query,
    includeSearch: true
  });

  return res.json({
    memories: context.searchResults.join('\n')
  });
});
```

### Pattern 3: Post-Call Conversation Storage

**Use case**: Store conversation after call ends

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
      })),
      metadata: {
        duration: call.endedReason === 'call-completed' ? call.duration : 0,
        timestamp: new Date().toISOString()
      }
    });
  }

  res.status(200).end();
});
```

---

## Examples

### Example 1: Simple Customer Support Bot

```typescript
// server.ts
import { VapiMemory } from 'vapi-memory';

const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY
});

app.post('/api/assistant-selector', async (req, res) => {
  const { call } = req.body;

  const context = await memory.getContext({
    userId: call.from.phoneNumber
  });

  return res.json(memory.createAssistantResponse(context, {
    name: 'Support Bot',
    model: { provider: 'openai', model: 'gpt-4o' },
    messages: [{
      role: 'system',
      content: `You are a helpful customer support agent.

About this customer:
${context.profile?.static.join('\n')}

Recent interactions:
${context.recentMemories.join('\n')}

Use this information to provide personalized support.`
    }]
  }));
});
```

### Example 2: Personal Assistant with Conversation History

```typescript
app.post('/api/assistant-selector', async (req, res) => {
  const { call } = req.body;
  const userId = call.from.phoneNumber;

  const context = await memory.getContext({
    userId,
    query: 'Personal assistant context',
    includeProfile: true,
    includeRecent: true,
    includeSearch: false
  });

  return res.json({
    assistantId: 'personal-assistant',
    assistantOverrides: {
      variableValues: {
        userName: context.profile?.static.find(f => f.includes('name')) || 'Friend',
        recentTasks: context.recentMemories.slice(0, 3).join('\n')
      }
    }
  });
});

app.post('/api/vapi-webhook', async (req, res) => {
  if (req.body.type === 'call-ended') {
    await memory.storeConversation({
      callId: req.body.call.id,
      userId: req.body.call.from.phoneNumber,
      transcript: req.body.messages,
      metadata: { type: 'personal-assistant' }
    });
  }
  res.status(200).end();
});
```

### Example 3: Multi-Tenant Application

```typescript
app.post('/api/assistant-selector', async (req, res) => {
  const { call } = req.body;

  // Get organization from phone number mapping
  const orgId = await getOrganizationByPhone(call.from.phoneNumber);

  const context = await memory.getContext({
    userId: call.from.phoneNumber,
    includeProfile: true
  });

  return res.json({
    assistantId: orgId === 'enterprise' ? 'enterprise-agent' : 'standard-agent',
    assistantOverrides: {
      messages: [{
        role: 'system',
        content: `You are helping ${orgId} customer.

Customer profile:
${context.profile?.static.join('\n')}

Remember this for the conversation.`
      }]
    }
  });
});
```

---

## Package Structure

```
vapi-memory/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── VapiMemory.ts               # Core class
│   ├── client/
│   │   └── SupermemoryClient.ts    # Supermemory API wrapper
│   ├── formatters/
│   │   └── ContextFormatter.ts     # Context formatting logic
│   ├── builders/
│   │   └── VapiResponseBuilder.ts  # Vapi response construction
│   ├── types/
│   │   └── index.ts                # TypeScript types
│   └── utils/
│       ├── cache.ts                # In-memory caching
│       ├── logger.ts               # Logging utilities
│       └── token-counter.ts        # Token counting
├── examples/
│   ├── basic-server.ts             # Simple example
│   ├── personal-assistant.ts       # Personal assistant example
│   ├── multi-tenant.ts             # Multi-tenant example
│   └── tool-integration.ts         # Vapi tool integration
├── test/
│   ├── VapiMemory.test.ts
│   ├── ContextFormatter.test.ts
│   └── integration.test.ts
├── package.json
├── tsconfig.json
├── bunfig.toml
├── README.md
├── CHANGELOG.md
└── LICENSE
```

---

## Development Roadmap

### Phase 1: Core Functionality (Week 1)
- [ ] Initialize Bun/TypeScript project
- [ ] Implement `VapiMemory` class skeleton
- [ ] Supermemory client wrapper with auth
- [ ] Basic `getContext()` implementation
- [ ] Basic `storeConversation()` implementation
- [ ] Unit tests for core methods

### Phase 2: Context Management (Week 2)
- [ ] Context formatter with token budgeting
- [ ] Relevance ranking algorithm
- [ ] Profile formatting (static/dynamic)
- [ ] Memory deduplication
- [ ] Caching layer with TTL
- [ ] Integration tests

### Phase 3: Vapi Integration (Week 3)
- [ ] Vapi response builder
- [ ] System message injection
- [ ] Variable formatting
- [ ] Tool integration helpers
- [ ] Complete example servers
- [ ] Documentation

### Phase 4: Advanced Features (Week 4)
- [ ] Token-aware progressive loading
- [ ] Memory summarization plugin
- [ ] Compression for long contexts
- [ ] Error handling & retries
- [ ] Monitoring & metrics
- [ ] Performance optimization

### Phase 5: Production Readiness (Week 5)
- [ ] Comprehensive test suite
- [ ] TypeScript types validation
- [ ] API documentation
- [ ] Migration guide
- [ ] CI/CD pipeline
- [ ] npm publishing

---

## Technical Decisions

### 1. Bun vs Node
**Decision: Bun**
- Faster build times and runtime
- Native TypeScript support
- Built-in test runner
- Better for library development

### 2. Supermemory SDK vs Direct API
**Decision: Supermemory SDK with wrapper**
- SDK handles auth, retries, errors
- We add Vapi-specific logic on top
- Easier to maintain

### 3. Cache Strategy
**Decision: In-memory LRU cache**
- Simple, no external dependencies
- Configurable TTL
- Profile data cached per user
- Search results not cached (user-specific)

### 4. Token Counting
**Decision: Estimation (GPT-4 tokenizer approximation)**
- Full tokenizer too heavy
- Approximate (4 chars ≈ 1 token)
- Sufficient for budgeting

### 5. Error Handling
**Decision: Structured errors with codes**
- Custom error classes
- Error codes for programmatic handling
- Retry logic for rate limits
- Graceful degradation

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Context retrieval | < 100ms | P95 |
| Profile lookup | < 50ms | Cached |
| Search query | < 100ms | Uncached |
| Conversation storage | < 500ms | Async |
| Memory overhead | < 10MB | Per instance |

---

## Security Considerations

1. **API Key Management**
   - Never commit API keys
   - Use environment variables
   - Support key rotation

2. **User Data Privacy**
   - Encrypt sensitive metadata
   - GDPR compliance options
   - Data retention policies

3. **Access Control**
   - Validate userId format
   - Rate limiting per user
   - Audit logging

---

## Testing Strategy

1. **Unit Tests**
   - Core methods (VapiMemory, formatters, builders)
   - Edge cases (empty results, errors)
   - Token counting accuracy

2. **Integration Tests**
   - Supermemory API integration
   - End-to-end Vapi flows
   - Webhook handling

3. **Performance Tests**
   - Latency benchmarks
   - Cache hit rates
   - Concurrent load

4. **Example Tests**
   - All examples run successfully
   - Documentation code verified

---

## Documentation Requirements

1. **README.md**
   - Quick start (5-minute setup)
   - Installation
   - Basic usage
   - Examples index

2. **API Reference**
   - All public methods
   - Type definitions
   - Parameters and returns
   - Examples

3. **Integration Guide**
   - Vapi server URL setup
   - Webhook configuration
   - Tool integration
   - Best practices

4. **Examples**
   - Complete working servers
   - Multiple use cases
   - Deployable configs

---

## License

MIT License - Permissive, easy to adopt

---

## Success Metrics

1. **Adoption**: 100+ npm downloads/month after 3 months
2. **Quality**: 100% test coverage, < 5% bug rate
3. **Performance**: < 100ms P95 retrieval latency
4. **Documentation**: Complete README + API docs + 5+ examples
5. **Community**: GitHub stars, issues, PR engagement
