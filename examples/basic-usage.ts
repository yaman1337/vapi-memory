import { VapiMemory } from '../src';

// Example: Basic customer support bot with memory

async function main() {
  const memory = new VapiMemory({
    apiKey: process.env.SUPERMEMORY_API_KEY || 'your-api-key-here',
    maxTokens: 2000,
    searchThreshold: 0.5,
  });

  console.log('VapiMemory initialized');

  try {
    // Get context for a user
    const context = await memory.getContext({
      userId: '+1234567890', // User's phone number
      query: 'Customer calling about support',
      includeProfile: true,
      includeRecent: true,
      includeSearch: true,
    });

    console.log('\nRetrieved Context:');
    console.log('==================');
    console.log(`Profile (static): ${context.profile?.static.join(', ') || 'None'}`);
    console.log(`Profile (dynamic): ${context.profile?.dynamic.join(', ') || 'None'}`);
    console.log(`Recent memories: ${context.recentMemories.length}`);
    console.log(`Search results: ${context.searchResults.length}`);
    console.log(`Total tokens: ${context.totalTokens}`);
    console.log(`Retrieval time: ${context.metadata.retrievalTime}ms`);
    console.log(`Sources: ${context.metadata.sources.join(', ')}`);

    // Create assistant response with context
    const assistantResponse = memory.createAssistantResponse(context, {
      name: 'Customer Support Agent',
      model: {
        provider: 'openai',
        model: 'gpt-4o',
      },
    });

    console.log('\nAssistant Response:');
    console.log('==================');
    console.log(JSON.stringify(assistantResponse, null, 2));

    // Store a conversation after call ends
    await memory.storeConversation({
      callId: 'call_12345',
      userId: '+1234567890',
      transcript: [
        { role: 'user', content: 'I need help with my order' },
        { role: 'assistant', content: 'I can help you with that. What is your order number?' },
        { role: 'user', content: 'It is ORDER-12345' },
        { role: 'assistant', content: 'Thank you. Let me check the status of ORDER-12345 for you.' },
      ],
      metadata: {
        duration: 180,
        sentiment: 'neutral',
      },
    });

    console.log('\n✅ Conversation stored successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
