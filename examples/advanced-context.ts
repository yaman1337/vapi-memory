import { VapiMemory, ContextFormatter } from '../src';

// Example: Advanced context management with custom formatting

async function main() {
  const memory = new VapiMemory({
    apiKey: process.env.SUPERMEMORY_API_KEY || 'your-api-key-here',
    maxTokens: 4000,
    cacheEnabled: true,
    cacheTTL: 120000, // 2 minutes
  });

  console.log('VapiMemory initialized with advanced features\n');

  try {
    // Get user context
    const context = await memory.getContext({
      userId: '+1234567890',
      query: 'User calling for premium support',
      includeProfile: true,
      includeRecent: true,
      includeSearch: true,
    });

    console.log('=== Retrieved Context ===');
    console.log(`User ID: ${context.metadata.userId}`);
    console.log(`Retrieval time: ${context.metadata.retrievalTime}ms`);
    console.log(`Sources: ${context.metadata.sources.join(', ')}`);

    if (context.profile) {
      console.log('\n--- Profile ---');
      console.log(`Static facts (${context.profile.static.length}):`);
      context.profile.static.forEach((fact, i) => console.log(`  ${i + 1}. ${fact}`));

      console.log(`\nDynamic facts (${context.profile.dynamic.length}):`);
      context.profile.dynamic.forEach((fact, i) => console.log(`  ${i + 1}. ${fact}`));
    }

    if (context.recentMemories.length > 0) {
      console.log('\n--- Recent Memories ---');
      context.recentMemories.forEach((mem, i) => console.log(`  ${i + 1}. ${mem}`));
    }

    if (context.searchResults.length > 0) {
      console.log('\n--- Search Results ---');
      context.searchResults.forEach((mem, i) => console.log(`  ${i + 1}. ${mem}`));
    }

    console.log(`\nTotal estimated tokens: ${context.totalTokens}`);

    // Demonstrate cache performance
    const cacheStats = memory.getCacheStats();
    console.log('\n=== Cache Stats ===');
    console.log(`Cache size: ${cacheStats.size}/${cacheStats.maxSize}`);
    console.log(`Cache hit rate: ${(cacheStats.hitRate * 100).toFixed(2)}%`);

    // Clear cache example
    console.log('\n=== Clearing Cache ===');
    memory.clearCache();

    const secondContext = await memory.getContext({
      userId: '+1234567890',
      query: 'User calling again',
      includeProfile: true,
      includeRecent: false,
      includeSearch: false,
    });

    console.log(`Second context retrieval took: ${secondContext.metadata.retrievalTime}ms (no cache hit)`);

    console.log('\n✅ Advanced example completed!');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
