import { VapiMemory, VapiToolFactory } from '../src';
import type { FormattedContext, Tool } from '../src/types';

// Initialize VapiMemory
const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY!,
  maxTokens: 2000,
  cacheEnabled: true,
  cacheTTL: 120000,
});

// Create memory tools
const toolDefinitions = VapiToolFactory.createToolSet();
const tools = toolDefinitions.map(t => {
  const tool: Tool = {
    type: t.type as Tool['type'],
    name: t.name,
    parameters: t.parameters,
  };

  if (t.description) {
    (tool as any).description = t.description;
  }

  return tool;
});

console.log('🚀 Vapi Memory Server starting on port 3000...');
console.log('📦 Tools available:', tools.map(t => t.name).join(', '));

// Mock user database (in production, use your real database)
const userDatabase = new Map<string, {
  name: string;
  tier: string;
  location: string;
  preferences: string[];
}>();

userDatabase.set('+1234567890', {
  name: 'John Doe',
  tier: 'VIP',
  location: 'New York',
  preferences: ['Prefers email communication', 'Loves coffee'],
});

// Tool handlers for Vapi
const toolHandlers: Record<string, (params: any, userId: string) => Promise<any>> = {
  search_memories: async (params, userId) => {
    const results = await memory.getContext({
      userId,
      query: params.query,
      includeSearch: true,
      includeRecent: false,
      includeProfile: false,
    });

    return {
      memories: results.searchResults.slice(0, params.limit || 5),
      count: results.searchResults.length,
      sources: results.metadata.sources,
    };
  },

  get_user_profile: async (params, userId) => {
    const profile = await memory.getUserProfile(userId);
    return {
      static: profile.static,
      dynamic: profile.dynamic,
      total: profile.static.length + profile.dynamic.length,
    };
  },

  get_recent_memories: async (params, userId) => {
    const context = await memory.getContext({
      userId,
      includeRecent: true,
      includeProfile: false,
      includeSearch: false,
    });

    return {
      memories: context.recentMemories,
      count: context.recentMemories.length,
      timestamp: new Date().toISOString(),
    };
  },

  store_memory: async (params, userId) => {
    await memory.addMemory({
      userId,
      content: params.content,
      metadata: params.metadata,
    });

    return {
      success: true,
      timestamp: new Date().toISOString(),
      content: params.content,
    };
  },

  get_full_context: async (params, userId) => {
    const context = await memory.getContext({
      userId,
      query: params.query,
      includeProfile: params.includeProfile !== false,
      includeRecent: params.includeRecent !== false,
      includeSearch: params.includeSearch !== false,
    });

    return {
      ...context,
      formattedAt: new Date().toISOString(),
    };
  },
};

Bun.serve({
  port: 3000,
  development: {
    hmr: true,
  },
  fetch: async (req) => {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Handle POST requests
    if (req.method === 'POST') {
      const body = await req.json();

      // Assistant request from Vapi
      if (path === '/api/assistant-selector') {
        if (body.message?.type === 'assistant-request') {
          const phoneNumber = body.call.from.phoneNumber;
          const userId = phoneNumber;

          console.log(`📞 Incoming call from: ${phoneNumber}`);

          try {
            // Get context from Supermemory
            const context = await memory.getContext({
              userId,
              query: 'Incoming call',
              includeProfile: true,
              includeRecent: true,
              includeSearch: true,
            });

            console.log(`✅ Context retrieved in ${context.metadata.retrievalTime}ms`);
            console.log(`📊 Using ${context.totalTokens} tokens from ${context.metadata.sources.length} sources`);

            // Get user info from database
            const userInfo = userDatabase.get(userId) || { name: 'Customer', tier: 'standard' };

            // Build assistant with tools
            const response = memory.buildWithTools(context, {
              name: `${userInfo.tier === 'VIP' ? 'VIP ' : ''}Support Agent`,
              model: {
                provider: 'openai',
                model: 'gpt-4o',
              },
            }, tools as any[]);

            return new Response(JSON.stringify(response), {
              headers: corsHeaders,
              status: 200,
            });
          } catch (error) {
            console.error('❌ Error handling assistant request:', error);

            return new Response(
              JSON.stringify({ error: 'Failed to get context' }),
              { status: 500, headers: corsHeaders }
            );
          }
        }
      }

      // Assistant request using existing Vapi assistant ID (assistantId path)
      // Route: POST /api/assistant/:assistantId
      // Use this when you have a pre-built assistant in the Vapi dashboard
      if (path.startsWith('/api/assistant/')) {
        const assistantId = path.replace('/api/assistant/', '');

        if (!assistantId) {
          return new Response(
            JSON.stringify({ error: 'Missing assistantId in URL' }),
            { status: 400, headers: corsHeaders }
          );
        }

        if (body.message?.type === 'assistant-request') {
          const phoneNumber = body.call.from.phoneNumber;
          const userId = phoneNumber;

          console.log(`📞 Incoming call from: ${phoneNumber} (assistant: ${assistantId})`);

          try {
            const context = await memory.getContext({
              userId,
              query: 'Incoming call',
              includeProfile: true,
              includeRecent: true,
              includeSearch: true,
            });

            console.log(`✅ Context retrieved in ${context.metadata.retrievalTime}ms`);

            // Option A: Context only -- inject memory as system message override
            // const response = memory.buildWithOverrides(context, assistantId);

            // Option B: Context + tools -- inject memory and attach memory tools
            const response = memory.buildWithToolsAndOverrides(
              context,
              assistantId,
              tools as any[],
            );

            // Option C: Minimal -- just select the assistant with context
            // const response = memory.selectAssistant(context, assistantId);

            return new Response(JSON.stringify(response), {
              headers: corsHeaders,
              status: 200,
            });
          } catch (error) {
            console.error('❌ Error handling assistant override request:', error);

            return new Response(
              JSON.stringify({ error: 'Failed to get context' }),
              { status: 500, headers: corsHeaders }
            );
          }
        }
      }

      // Tool request from Vapi
      if (path.startsWith('/api/tools/')) {
        const toolName = path.replace('/api/tools/', '');
        const handler = toolHandlers[toolName];

        if (!handler) {
          return new Response(
            JSON.stringify({ error: 'Unknown tool' }),
            { status: 404, headers: corsHeaders }
          );
        }

        try {
          const userId = body.call?.from?.phoneNumber || body.phoneNumber;

          console.log(`🔧 Tool '${toolName}' called by: ${userId}`);
          console.log('📥 Parameters:', JSON.stringify(body.parameters));

          const result = await handler(body.parameters, userId);

          console.log(`✅ Tool '${toolName}' completed successfully`);

          return new Response(JSON.stringify(result), {
            headers: corsHeaders,
            status: 200,
          });
        } catch (error) {
          console.error(`❌ Tool '${toolName}' failed:`, error);

          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      // Webhook for call ended
      if (path === '/api/webhook') {
        if (body.type === 'call-ended') {
          const phoneNumber = body.call.from.phoneNumber;
          const userId = phoneNumber;

          console.log(`📞 Call ended: ${body.call.id}`);

          try {
            await memory.storeConversation({
              callId: body.call.id,
              userId,
              transcript: body.messages.map((m: any) => ({
                role: m.role,
                content: m.content,
              })),
              metadata: {
                duration: body.call.duration,
                endedReason: body.call.endedReason,
                timestamp: new Date().toISOString(),
              },
            });

            console.log('✅ Conversation stored successfully');

            return new Response(JSON.stringify({ status: 'ok' }), {
              headers: corsHeaders,
              status: 200,
            });
          } catch (error) {
            console.error('❌ Error storing conversation:', error);

            return new Response(
              JSON.stringify({ error: 'Failed to store conversation' }),
              { status: 500, headers: corsHeaders }
            );
          }
        }
      }
    }

    // GET request - return server info
    return new Response(
      JSON.stringify({
        status: 'running',
        version: '1.0.0',
        tools: tools.map(t => ({ name: t.name, description: t.description })),
        endpoints: {
          assistant: 'POST /api/assistant-selector (full dynamic assistant)',
          assistantOverride: 'POST /api/assistant/:assistantId (existing assistant + context overrides)',
          tools: 'POST /api/tools/{toolName}',
          webhook: 'POST /api/webhook',
        },
        cacheStats: memory.getCacheStats(),
      }),
      { headers: corsHeaders }
    );
  },
});

console.log('\n=== Vapi Memory Server ===');
console.log('Endpoints:');
console.log('  POST /api/assistant-selector     - Full dynamic assistant (builds assistant from scratch)');
console.log('  POST /api/assistant/:assistantId - Existing assistant + context overrides (uses assistantId)');
console.log('  POST /api/tools/{name}        - Handle Vapi tool calls');
console.log('  POST /api/webhook             - Handle call-ended webhooks');
console.log('\n📖 See README for usage examples');
console.log('\n⚠️  Set SUPERMEMORY_API_KEY environment variable');
console.log('===============================\n');
