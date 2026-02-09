import { VapiMemory } from '../src';

// Example: Complete Vapi server integration with memory

// Mock Vapi server handler (in real usage, use Express, Fastify, or Bun.serve)
async function handleAssistantRequest(request: any) {
  const { message, call } = request;

  if (message?.type === 'assistant-request') {
    const phoneNumber = call.from.phoneNumber;

    console.log(`Incoming call from: ${phoneNumber}`);

    // Initialize VapiMemory
    const memory = new VapiMemory({
      apiKey: process.env.SUPERMEMORY_API_KEY!,
      maxTokens: 2000,
      searchThreshold: 0.5,
      cacheEnabled: true,
    });

    try {
      // Get context from Supermemory
      const context = await memory.getContext({
        userId: phoneNumber,
        query: 'Incoming call',
        includeProfile: true,
        includeRecent: true,
        includeSearch: true,
      });

      console.log(`Context retrieved in ${context.metadata.retrievalTime}ms`);
      console.log(`Using ${context.totalTokens} tokens`);

      // Determine which assistant to use based on user tier
      const userTier = context.profile?.static.find(s => s.includes('VIP')) ? 'vip' : 'standard';

      // Return assistant configuration with context
      const response = memory.createAssistantResponse(context, {
        name: `${userTier === 'vip' ? 'VIP ' : ''}Customer Support Agent`,
        model: {
          provider: 'openai',
          model: 'gpt-4o',
        },
        voice: {
          provider: '11labs',
          voiceId: userTier === 'vip' ? 'rachel' : 'josh',
        },
      });

      return response;
    } catch (error) {
      console.error('Error getting context:', error);

      // Fallback to default assistant
      return {
        assistantId: 'default-support-agent',
      };
    }
  }

  return {
    error: 'Invalid request type',
  };
}

// Mock webhook handler for storing conversations
async function handleCallEnded(request: any) {
  const { type, call, messages } = request;

  if (type === 'call-ended') {
    console.log(`Call ended: ${call.id}`);

    const memory = new VapiMemory({
      apiKey: process.env.SUPERMEMORY_API_KEY!,
    });

    try {
      // Store conversation to build user profile
      await memory.storeConversation({
        callId: call.id,
        userId: call.from.phoneNumber,
        transcript: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
        metadata: {
          duration: call.duration || 0,
          endedReason: call.endedReason,
          timestamp: new Date().toISOString(),
        },
      });

      console.log('✅ Conversation stored successfully');
    } catch (error) {
      console.error('Error storing conversation:', error);
    }
  }

  return { status: 'ok' };
}

// Demo usage
async function main() {
  console.log('=== Vapi Server Integration Example ===\n');

  // Mock incoming call request
  const mockRequest = {
    message: {
      type: 'assistant-request',
    },
    call: {
      id: 'call_test_12345',
      from: {
        phoneNumber: '+1234567890',
      },
      to: {
        phoneNumber: '+0987654321',
      },
    },
  };

  console.log('Processing assistant-request...');
  const assistantResponse = await handleAssistantRequest(mockRequest);
  console.log('\nAssistant Response:');
  console.log(JSON.stringify(assistantResponse, null, 2));

  // Mock call-ended webhook
  const mockWebhook = {
    type: 'call-ended',
    call: {
      id: 'call_test_12345',
      from: { phoneNumber: '+1234567890' },
      duration: 180,
      endedReason: 'call-completed',
    },
    messages: [
      { role: 'user', content: 'I need help with my order' },
      { role: 'assistant', content: 'How can I help you today?' },
      { role: 'user', content: 'My order is ORDER-12345' },
      { role: 'assistant', content: 'Let me check that for you right away.' },
    ],
  };

  console.log('\nProcessing call-ended webhook...');
  await handleCallEnded(mockWebhook);

  console.log('\n✅ Example completed!');
  console.log('\n=== Usage with Bun.serve ===');
  console.log(`
In production, use Bun.serve like this:

import { VapiMemory } from 'vapi-memory';

const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY
});

Bun.serve({
  port: 3000,
  fetch: async (req) => {
    if (req.method === 'POST') {
      const body = await req.json();

      if (body.message?.type === 'assistant-request') {
        const context = await memory.getContext({
          userId: body.call.from.phoneNumber
        });

        return new Response(JSON.stringify(
          memory.createAssistantResponse(context, {
            name: 'Support Agent',
            model: { provider: 'openai', model: 'gpt-4o' }
          })
        ), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('OK', { status: 200 });
  }
});
  `);
}

main();
