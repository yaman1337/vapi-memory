# Vapi-Memory Compression Feature Plan (Phase 4)

## Executive Summary

This plan outlines the compression feature for vapi-memory Phase 4, designed to compress long context (memories, profiles) to fit within token limits while preserving the most valuable information for voice AI conversations.

---

## 1. Research: Context Compression Techniques for LLMs

### 1.1 Compression Strategies Overview

| Technique | Description | When to Use | Compression Ratio | Quality Impact |
|-----------|-------------|-------------|-------------------|----------------|
| **Summarization** | Generate concise summaries of long text | Old conversations, lengthy profiles | 3:1 to 10:1 | Moderate - may lose details |
| **Key Point Extraction** | Extract only important facts/sentences | Fact-based memories, profiles | 2:1 to 5:1 | Low - keeps original phrasing |
| **Semantic Clustering** | Group similar content, keep representatives | Many similar memories | 5:1 to 20:1 | Variable - depends on similarity |
| **Pruning** | Remove low-value content entirely | Large context sets | 2:1 to 10:1 | Low - removes noise |

### 1.2 Industry Best Practices

**From Research (LangGraph, AutoGPT, etc.):**

1. **Hierarchical Compression**
   - Compress older data more aggressively
   - Keep recent data near-original
   - Balance recency vs. information density

2. **Importance Scoring**
   - Semantic relevance to current query
   - User interaction signals (clicks, mentions)
   - Explicit importance tags
   - Temporal decay

3. **Multi-Stage Compression**
   - Stage 1: Deduplication (already implemented in ContextFormatter)
   - Stage 2: Low-importance pruning
   - Stage 3: Key point extraction
   - Stage 4: Summarization (last resort)

4. **Context Budgeting**
   - Reserve token budget for different sources
   - Profile: 20-30%
   - Recent: 30-40%
   - Search results: 30-50%
   - Adaptive based on query type

### 1.3 Compression Quality Metrics

**Preservation Metrics:**
- Semantic fidelity (embeddings similarity)
- Fact retention (key facts present)
- Coherence (readable text)
- Actionability (useful for AI)

**Efficiency Metrics:**
- Token reduction ratio
- Compression time (< 50ms target)
- Memory footprint

---

## 2. Compression Algorithm Design

### 2.1 Summarization Compressor

**Purpose:** Convert long text to concise summary while preserving meaning.

**Algorithm (Practical, No External LLM):**

```typescript
class SummarizationCompressor {
  // Statistical summarization - no external LLM dependency
  // Uses sentence ranking based on:
  // 1. Position (first/last sentences important)
  // 2. Sentence length (balanced)
  // 3. Keyword frequency
  // 4. Sentence connectivity (links to other sentences)

  compress(text: string, targetRatio: number): string {
    // 1. Split into sentences
    // 2. Score each sentence
    // 3. Select top N to hit target ratio
    // 4. Reorder for coherence
  }
}
```

**Sentence Scoring Formula:**

```
score = w1 * position_score +
        w2 * length_score +
        w3 * keyword_score +
        w4 * connectivity_score

Where:
- position_score: 1.0 for first/last, 0.5 for middle
- length_score: normalized to optimal length (15-25 words)
- keyword_score: contains important words (nouns, names, numbers)
- connectivity_score: shared words with other high-scoring sentences
```

**Use Cases:**
- Compressing old conversation histories
- Reducing lengthy profile descriptions
- Summarizing multiple related memories

**Target Compression:** 3:1 to 5:1 (reduce to 20-33% of original)

---

### 2.2 Key Point Extractor

**Purpose:** Extract only the most important facts/sentences.

**Algorithm:**

```typescript
class KeyPointExtractor {
  // Rule-based extraction for maximum precision
  // Patterns: names, dates, preferences, facts, decisions

  extract(text: string, maxPoints: number): string[] {
    // 1. Identify sentence types (fact, opinion, question)
    // 2. Extract named entities (people, dates, locations)
    // 3. Score based on information density
    // 4. Return top N key points
  }
}
```

**Sentence Type Detection:**

```typescript
// Fact patterns (high importance):
- "User is [preference/attribute]"
- "User [has/owns] [item]"
- "[Date]: [event/fact]"
- "User wants/needs/prefers [X]"

// Opinion patterns (medium importance):
- "User likes/dislikes [X]"
- "User feels [X]"

// Question patterns (low importance for context):
- "User asked about [X]"
- "User wanted to know [X]"
```

**Information Density Scoring:**

```
density = (# named entities + # numbers + # keywords) / word_count

High density (> 0.15): Keep
Medium density (0.05-0.15): Consider
Low density (< 0.05): Discard
```

**Use Cases:**
- Profile fact extraction
- Maintaining factual accuracy
- Quick reference context

**Target Compression:** 2:1 to 4:1 (reduce to 25-50% of original)

---

### 2.3 Semantic Clusterer

**Purpose:** Group similar items and keep representative content.

**Algorithm:**

```typescript
class SemanticClusterer {
  // Uses lightweight embeddings (optional) or Jaccard similarity
  // Clusters similar memories, keeps most representative

  cluster(items: string[], maxClusters: number): Cluster[] {
    // 1. Calculate pairwise similarities
    // 2. Build similarity graph
    // 3. Find clusters using connected components
    // 4. Select representative from each cluster
    //    - Most connected (centroid-like)
    //    - Longest (most detail)
    //    - Most recent
  }
}
```

**Similarity Calculation:**

```typescript
// Option 1: Jaccard (word overlap) - fast, no dependencies
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

// Option 2: Cosine (embeddings) - more accurate, requires embedding service
async function cosineSimilarity(a: string, b: string): Promise<number> {
  const embA = await generateEmbedding(a);
  const embB = await generateEmbedding(b);
  return dotProduct(embA, embB);
}
```

**Cluster Representation:**

```typescript
// Select best representative from cluster
function selectRepresentative(cluster: string[]): string {
  // Score each item:
  // - Centroid score: average similarity to others
  // - Length score: longer = more detail
  // - Recency score: newer = fresher

  const scores = cluster.map(item => ({
    item,
    centroid: averageSimilarity(item, cluster),
    length: item.length / cluster.map(i => i.length).reduce((a,b) => a+b) / cluster.length,
    recency: getRecencyScore(item) // from metadata
  }));

  return maxBy(scores, s => s.centroid * 0.5 + s.length * 0.3 + s.recency * 0.2).item;
}
```

**Use Cases:**
- Deduplicating similar memories
- Reducing repetitive information
- Summarizing multiple related conversations

**Target Compression:** 5:1 to 15:1 (reduce to 7-20% of original)

---

### 2.4 Pruning Strategy

**Purpose:** Remove low-value content entirely.

**Algorithm:**

```typescript
class PruningStrategy {
  // Rule-based filtering to remove low-value content

  prune(items: CompressibleItem[], criteria: PruningCriteria): CompressibleItem[] {
    // 1. Apply filters (age, importance, source, size)
    // 2. Sort by combined score
    // 3. Keep top N until token budget
  }
}

interface PruningCriteria {
  maxAge?: number;        // ms, older items removed
  minImportance?: number; // 0-1, below removed
  minRelevance?: number;   // 0-1, to query removed
  sources?: string[];      // only keep these sources
  maxItemsPerSource?: number;
}
```

**Scoring Formula:**

```
combined_score = w1 * recency_score +
                 w2 * importance_score +
                 w3 * relevance_score +
                 w4 * source_priority

Where:
- recency_score: 1.0 (newest) to 0.0 (oldest)
- importance_score: explicit tag or computed
- relevance_score: similarity to current query
- source_priority: profile (1.0) > recent (0.8) > search (0.6)
```

**Low-Value Patterns to Prune:**

```typescript
// Greetings/closings (low info):
- "Hello", "Hi there", "Goodbye", "Thanks"
- "How are you?", "Nice talking to you"

// Filler/acknowledgments:
- "Okay", "Sure", "I see", "Got it"
- "Alright", "Fine", "Okay then"

// Repetitions (handled by deduplication):
// Already in ContextFormatter

// Low-relevance search results:
- Relevance score < threshold
// Not related to current query topic
```

**Use Cases:**
- Quick context reduction
- Removing noise
- Meeting strict token limits

**Target Compression:** 2:1 to 10:1 (variable based on criteria)

---

### 2.5 Adaptive Pipeline

**Purpose:** Combine strategies intelligently based on context.

**Algorithm:**

```typescript
class AdaptiveCompressionPipeline {
  async compress(
    context: FormattedContext,
    targetTokens: number,
    options: CompressionOptions
  ): Promise<CompressedContext> {
    const currentTokens = context.totalTokens;

    if (currentTokens <= targetTokens) {
      return context; // No compression needed
    }

    const excessTokens = currentTokens - targetTokens;
    const excessRatio = excessTokens / currentTokens;

    // Choose strategy based on excess
    if (excessRatio < 0.2) {
      // < 20% excess: Light pruning
      return this.pruningStrategy.compress(context, options);
    } else if (excessRatio < 0.5) {
      // < 50% excess: Pruning + key points
      const pruned = await this.pruningStrategy.compress(context, options);
      return await this.keyPointExtractor.compress(pruned, options);
    } else {
      // > 50% excess: Full pipeline
      const pruned = await this.pruningStrategy.compress(context, options);
      const clustered = await this.semanticClusterer.compress(pruned, options);
      const extracted = await this.keyPointExtractor.compress(clustered, options);
      return await this.summarizationCompressor.compress(extracted, options);
    }
  }
}
```

**Strategy Selection Matrix:**

| Excess | Profile Strategy | Recent Strategy | Search Strategy |
|--------|------------------|-----------------|-----------------|
| 0-20% | Pruning | Pruning | Pruning |
| 20-40% | Key points | Pruning | Key points |
| 40-60% | Clustering | Key points | Clustering |
| 60%+ | Summarization | Summarization | Summarization |

---

## 3. Compression API Design

### 3.1 Core Types

```typescript
// src/types/index.ts - Add to existing

export interface CompressionOptions {
  enabled: boolean;
  strategy: 'auto' | 'aggressive' | 'conservative' | 'custom';
  targetRatio?: number;        // 0-1, target of original
  maxTokens?: number;           // override global max
  preserveProfile?: boolean;     // never compress profile
  preserveRecent?: boolean;      // never compress recent
  preserveKeyFacts?: boolean;    // keep named entities, numbers
  useEmbeddings?: boolean;       // use semantic similarity (if available)
  embeddingProvider?: 'openai' | 'cohere' | 'local';
}

export interface CompressedContext extends FormattedContext {
  compression: {
    applied: boolean;
    strategy: string;
    originalTokens: number;
    compressedTokens: number;
    reductionRatio: number;
    timeMs: number;
    details: {
      profile?: CompressionDetail;
      recent?: CompressionDetail;
      search?: CompressionDetail;
    };
  };
}

export interface CompressionDetail {
  method: 'none' | 'pruned' | 'keypoints' | 'clustered' | 'summarized';
  originalCount: number;
  compressedCount: number;
  originalTokens: number;
  compressedTokens: number;
  removedItems?: string[]; // IDs of removed items
}
```

### 3.2 Compressor Classes

```
src/compression/
├── index.ts                          # Main export
├── CompressionEngine.ts              # Orchestrator
├── strategies/
│   ├── SummarizationCompressor.ts    # Summarization
│   ├── KeyPointExtractor.ts         # Key point extraction
│   ├── SemanticClusterer.ts         # Clustering
│   ├── PruningStrategy.ts           # Pruning
│   └── AdaptivePipeline.ts          # Adaptive selection
├── utils/
│   ├── SentenceScorer.ts             # Sentence scoring
│   ├── TextAnalyzer.ts               # Text analysis (entities, patterns)
│   └── SimilarityCalculator.ts      # Jaccard/cosine similarity
└── types.ts                          # Compression-specific types
```

#### 3.2.1 CompressionEngine

```typescript
// src/compression/CompressionEngine.ts

export class CompressionEngine {
  private options: Required<CompressionOptions>;
  private summarizer: SummarizationCompressor;
  private extractor: KeyPointExtractor;
  private clusterer: SemanticClusterer;
  private pruner: PruningStrategy;
  private adaptive: AdaptiveCompressionPipeline;
  private logger: Logger;

  constructor(options: CompressionOptions, logger: Logger) {
    this.options = this.normalizeOptions(options);
    this.summarizer = new SummarizationCompressor(this.options);
    this.extractor = new KeyPointExtractor(this.options);
    this.clusterer = new SemanticClusterer(this.options);
    this.pruner = new PruningStrategy(this.options);
    this.adaptive = new AdaptiveCompressionPipeline({
      summarizer: this.summarizer,
      extractor: this.extractor,
      clusterer: this.clusterer,
      pruner: this.pruner
    }, this.options);
    this.logger = logger;
  }

  async compress(context: FormattedContext, maxTokens: number): Promise<CompressedContext> {
    const startTime = Date.now();

    if (!this.options.enabled) {
      return this.wrapCompressed(context, {
        applied: false,
        strategy: 'disabled',
        originalTokens: context.totalTokens,
        compressedTokens: context.totalTokens,
        reductionRatio: 0,
        timeMs: 0,
        details: {}
      });
    }

    // Check if compression needed
    if (context.totalTokens <= maxTokens) {
      this.logger.debug(`No compression needed: ${context.totalTokens}/${maxTokens} tokens`);
      return this.wrapCompressed(context, {
        applied: false,
        strategy: 'none',
        originalTokens: context.totalTokens,
        compressedTokens: context.totalTokens,
        reductionRatio: 0,
        timeMs: 0,
        details: {}
      });
    }

    this.logger.info(`Compressing context: ${context.totalTokens} -> ${maxTokens} tokens`);

    // Apply compression based on strategy
    const result = await this.applyCompression(context, maxTokens);

    const endTime = Date.now();
    result.compression.timeMs = endTime - startTime;

    this.logger.info(
      `Compression complete: ${result.compression.originalTokens} -> ` +
      `${result.compression.compressedTokens} tokens ` +
      `(${(result.compression.reductionRatio * 100).toFixed(1)}% reduction) ` +
      `in ${result.compression.timeMs}ms`
    );

    return result;
  }

  private async applyCompression(
    context: FormattedContext,
    maxTokens: number
  ): Promise<CompressedContext> {
    switch (this.options.strategy) {
      case 'auto':
        return await this.adaptive.compress(context, maxTokens);

      case 'aggressive':
        return await this.aggressiveCompression(context, maxTokens);

      case 'conservative':
        return await this.conservativeCompression(context, maxTokens);

      case 'custom':
        return await this.customCompression(context, maxTokens);

      default:
        throw new Error(`Unknown compression strategy: ${this.options.strategy}`);
    }
  }

  private async aggressiveCompression(
    context: FormattedContext,
    maxTokens: number
  ): Promise<CompressedContext> {
    // Aggressive: Use summarization heavily
    let result = { ...context };

    // Compress each section
    if (context.profile) {
      result.profile = {
        static: await this.summarizer.compressMultiple(
          context.profile.static,
          maxTokens * 0.2
        ),
        dynamic: await this.summarizer.compressMultiple(
          context.profile.dynamic,
          maxTokens * 0.2
        )
      };
    }

    result.recentMemories = await this.summarizer.compressMultiple(
      context.recentMemories,
      maxTokens * 0.3
    );

    result.searchResults = await this.summarizer.compressMultiple(
      context.searchResults,
      maxTokens * 0.5
    );

    return this.buildCompressedContext(result, context.totalTokens);
  }

  private async conservativeCompression(
    context: FormattedContext,
    maxTokens: number
  ): Promise<CompressedContext> {
    // Conservative: Only prune and extract key points
    let result = { ...context };

    // Prune first
    result.recentMemories = this.pruner.pruneMemories(
      context.recentMemories,
      maxTokens * 0.4
    );

    result.searchResults = this.pruner.pruneMemories(
      context.searchResults,
      maxTokens * 0.6
    );

    // Extract key points if still too large
    const recentTokens = TokenCounter.estimateMultiple(result.recentMemories);
    const searchTokens = TokenCounter.estimateMultiple(result.searchResults);

    if (recentTokens > maxTokens * 0.4) {
      result.recentMemories = await this.extractor.extractMultiple(
        result.recentMemories,
        Math.floor(maxTokens * 0.4 / 50) // ~50 tokens per item
      );
    }

    if (searchTokens > maxTokens * 0.6) {
      result.searchResults = await this.extractor.extractMultiple(
        result.searchResults,
        Math.floor(maxTokens * 0.6 / 50)
      );
    }

    return this.buildCompressedContext(result, context.totalTokens);
  }

  private async customCompression(
    context: FormattedContext,
    maxTokens: number
  ): Promise<CompressedContext> {
    // Custom: Use targetRatio
    const targetTokens = Math.floor(context.totalTokens * (this.options.targetRatio || 0.5));
    return await this.adaptive.compress(context, Math.min(targetTokens, maxTokens));
  }

  private buildCompressedContext(
    result: FormattedContext,
    originalTokens: number
  ): CompressedContext {
    const compressedTokens =
      TokenCounter.estimateMultiple(result.profile?.static || []) +
      TokenCounter.estimateMultiple(result.profile?.dynamic || []) +
      TokenCounter.estimateMultiple(result.recentMemories) +
      TokenCounter.estimateMultiple(result.searchResults);

    return this.wrapCompressed(result, {
      applied: true,
      strategy: this.options.strategy,
      originalTokens,
      compressedTokens,
      reductionRatio: (originalTokens - compressedTokens) / originalTokens,
      timeMs: 0, // Will be set by caller
      details: {}
    });
  }

  private wrapCompressed(
    context: FormattedContext,
    compression: CompressedContext['compression']
  ): CompressedContext {
    return {
      ...context,
      compression
    };
  }

  private normalizeOptions(options: CompressionOptions): Required<CompressionOptions> {
    return {
      enabled: options.enabled !== false,
      strategy: options.strategy || 'auto',
      targetRatio: options.targetRatio || 0.5,
      maxTokens: options.maxTokens,
      preserveProfile: options.preserveProfile !== false,
      preserveRecent: options.preserveRecent !== false,
      preserveKeyFacts: options.preserveKeyFacts !== false,
      useEmbeddings: options.useEmbeddings || false,
      embeddingProvider: options.embeddingProvider || 'openai'
    };
  }
}
```

#### 3.2.2 SummarizationCompressor

```typescript
// src/compression/strategies/SummarizationCompressor.ts

export class SummarizationCompressor {
  private options: CompressionOptions;
  private scorer: SentenceScorer;

  constructor(options: CompressionOptions) {
    this.options = options;
    this.scorer = new SentenceScorer();
  }

  async compress(text: string, targetTokens: number): Promise<string> {
    const sentences = this.splitSentences(text);
    if (sentences.length === 0) return text;

    // Score each sentence
    const scored = sentences.map(s => ({
      text: s,
      score: this.scorer.score(s),
      tokens: TokenCounter.estimate(s)
    }));

    // Sort by score and add until target
    scored.sort((a, b) => b.score - a.score);

    let usedTokens = 0;
    const selected: string[] = [];

    for (const item of scored) {
      if (usedTokens + item.tokens > targetTokens) continue;
      usedTokens += item.tokens;
      selected.push(item.text);
    }

    // Reorder for coherence (keep original order)
    const selectedSet = new Set(selected);
    const ordered = sentences.filter(s => selectedSet.has(s));

    return ordered.join(' ');
  }

  async compressMultiple(texts: string[], maxTokens: number): Promise<string[]> {
    // Distribute tokens proportionally
    const totalTokens = TokenCounter.estimateMultiple(texts);
    if (totalTokens <= maxTokens) return texts;

    const results: string[] = [];
    let usedTokens = 0;

    for (const text of texts) {
      const textTokens = TokenCounter.estimate(text);
      const availableTokens = maxTokens - usedTokens;

      if (availableTokens <= 0) break;

      if (textTokens <= availableTokens) {
        results.push(text);
        usedTokens += textTokens;
      } else {
        const targetRatio = availableTokens / textTokens;
        const compressed = await this.compress(text, Math.floor(availableTokens));
        results.push(compressed);
        break;
      }
    }

    return results;
  }

  private splitSentences(text: string): string[] {
    // Simple sentence splitting
    return text
      .replace(/([.!?])\s+/g, '$1|SPLIT|')
      .split('|SPLIT|')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}
```

#### 3.2.3 KeyPointExtractor

```typescript
// src/compression/strategies/KeyPointExtractor.ts

export class KeyPointExtractor {
  private options: CompressionOptions;
  private analyzer: TextAnalyzer;

  constructor(options: CompressionOptions) {
    this.options = options;
    this.analyzer = new TextAnalyzer();
  }

  async extract(text: string, maxPoints: number): Promise<string[]> {
    const sentences = this.splitSentences(text);
    const scored = sentences.map(s => ({
      text: s,
      score: this.calculateImportance(s),
      tokens: TokenCounter.estimate(s)
    }));

    // Sort by importance and take top N
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxPoints).map(s => s.text);
  }

  async extractMultiple(texts: string[], maxPoints: number): Promise<string[]> {
    // Extract key points from all texts, then deduplicate
    const allPoints: string[] = [];

    for (const text of texts) {
      const points = await this.extract(text, Math.ceil(maxPoints / texts.length));
      allPoints.push(...points);
    }

    // Deduplicate similar points
    return this.deduplicatePoints(allPoints, maxPoints);
  }

  private calculateImportance(sentence: string): number {
    let score = 0;

    // Named entities (names, numbers, dates)
    const entities = this.analyzer.extractNamedEntities(sentence);
    score += entities.length * 10;

    // Information density
    const words = sentence.split(/\s+/);
    const density = entities.length / words.length;
    score += density * 50;

    // Fact patterns
    if (this.isFactPattern(sentence)) score += 20;

    // Sentence length (prefer moderate length)
    if (words.length >= 8 && words.length <= 25) score += 10;

    // Keyword presence
    const keywords = ['prefer', 'want', 'need', 'like', 'dislike', 'is', 'has', 'owns'];
    const hasKeyword = keywords.some(kw => sentence.toLowerCase().includes(kw));
    if (hasKeyword) score += 15;

    return score;
  }

  private isFactPattern(sentence: string): boolean {
    const patterns = [
      /^user is/i,
      /^user has/i,
      /^user wants/i,
      /^user needs/i,
      /^user prefers/i,
      /^user likes/i,
      /^user dislikes/i
    ];

    return patterns.some(p => p.test(sentence));
  }

  private deduplicatePoints(points: string[], maxPoints: number): string[] {
    const deduplicated: string[] = [];
    const seen = new Set<string>();

    for (const point of points) {
      const normalized = point.toLowerCase().trim();

      // Check for exact duplicates
      if (seen.has(normalized)) continue;

      // Check for semantic duplicates
      const isDuplicate = deduplicated.some(
        d => this.calculateSimilarity(d, point) > 0.85
      );

      if (isDuplicate) continue;

      seen.add(normalized);
      deduplicated.push(point);

      if (deduplicated.length >= maxPoints) break;
    }

    return deduplicated;
  }

  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.size / union.size;
  }

  private splitSentences(text: string): string[] {
    return text
      .replace(/([.!?])\s+/g, '$1|SPLIT|')
      .split('|SPLIT|')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}
```

#### 3.2.4 SemanticClusterer

```typescript
// src/compression/strategies/SemanticClusterer.ts

export class SemanticClusterer {
  private options: CompressionOptions;
  private similarity: SimilarityCalculator;

  constructor(options: CompressionOptions) {
    this.options = options;
    this.similarity = new SimilarityCalculator(options);
  }

  async cluster(items: string[], maxClusters: number): Promise<ClusterResult> {
    if (items.length <= maxClusters) {
      return {
        clusters: items.map(item => ({ representative: item, members: [item] })),
        compressionRatio: 1
      };
    }

    // Build similarity matrix
    const similarities = await this.buildSimilarityMatrix(items);

    // Cluster using greedy approach
    const clusters = this.greedyCluster(items, similarities, maxClusters);

    const compressionRatio = items.length / clusters.length;

    return {
      clusters,
      compressionRatio
    };
  }

  private async buildSimilarityMatrix(items: string[]): Promise<number[][]> {
    const matrix: number[][] = [];

    for (let i = 0; i < items.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < items.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else if (j < i) {
          matrix[i][j] = matrix[j][i]; // Symmetric
        } else {
          matrix[i][j] = await this.similarity.calculate(items[i], items[j]);
        }
      }
    }

    return matrix;
  }

  private greedyCluster(
    items: string[],
    similarities: number[][],
    maxClusters: number
  ): Cluster[] {
    const clusters: Cluster[] = [];
    const used = new Set<number>();

    // Greedy: find most similar pair, cluster, repeat
    while (clusters.length < maxClusters && used.size < items.length) {
      let bestPair: [number, number] | null = null;
      let bestSimilarity = 0.8; // Threshold

      for (let i = 0; i < items.length; i++) {
        if (used.has(i)) continue;
        for (let j = i + 1; j < items.length; j++) {
          if (used.has(j)) continue;
          if (similarities[i][j] > bestSimilarity) {
            bestSimilarity = similarities[i][j];
            bestPair = [i, j];
          }
        }
      }

      if (bestPair) {
        // Create cluster
        const members = [items[bestPair[0]], items[bestPair[1]]];
        used.add(bestPair[0]);
        used.add(bestPair[1]);

        // Add similar items to cluster
        for (let i = 0; i < items.length; i++) {
          if (used.has(i)) continue;
          if (similarities[bestPair[0]][i] > 0.7) {
            members.push(items[i]);
            used.add(i);
          }
        }

        clusters.push({
          representative: this.selectRepresentative(members),
          members
        });
      } else {
        // No more similar pairs, add remaining as singletons
        for (let i = 0; i < items.length; i++) {
          if (!used.has(i)) {
            clusters.push({
              representative: items[i],
              members: [items[i]]
            });
            used.add(i);
            if (clusters.length >= maxClusters) break;
          }
        }
      }
    }

    return clusters;
  }

  private selectRepresentative(members: string[]): string {
    // Score each member
    const scored = members.map(member => ({
      member,
      centroidScore: this.averageSimilarity(member, members),
      lengthScore: member.length / Math.max(...members.map(m => m.length))
    }));

    // Return best
    scored.sort((a, b) =>
      (b.centroidScore * 0.7 + b.lengthScore * 0.3) -
      (a.centroidScore * 0.7 + a.lengthScore * 0.3)
    );

    return scored[0].member;
  }

  private async averageSimilarity(item: string, members: string[]): Promise<number> {
    let total = 0;
    for (const member of members) {
      total += await this.similarity.calculate(item, member);
    }
    return total / members.length;
  }
}

export interface Cluster {
  representative: string;
  members: string[];
}

export interface ClusterResult {
  clusters: Cluster[];
  compressionRatio: number;
}
```

#### 3.2.5 PruningStrategy

```typescript
// src/compression/strategies/PruningStrategy.ts

export class PruningStrategy {
  private options: CompressionOptions;

  constructor(options: CompressionOptions) {
    this.options = options;
  }

  prune(items: CompressibleItem[], maxTokens: number): CompressibleItem[] {
    if (TokenCounter.estimateMultiple(items.map(i => i.content)) <= maxTokens) {
      return items;
    }

    // Score and sort
    const scored = items.map(item => ({
      item,
      score: this.calculateScore(item)
    }));

    scored.sort((a, b) => b.score - a.score);

    // Add until token budget
    const result: CompressibleItem[] = [];
    let usedTokens = 0;

    for (const { item } of scored) {
      const tokens = TokenCounter.estimate(item.content);
      if (usedTokens + tokens > maxTokens) continue;
      usedTokens += tokens;
      result.push(item);
    }

    return result;
  }

  pruneMemories(memories: string[], maxTokens: number): string[] {
    const items: CompressibleItem[] = memories.map((content, index) => ({
      id: index.toString(),
      content,
      source: 'memory',
      priority: 1
    }));

    return this.prune(items, maxTokens).map(i => i.content);
  }

  private calculateScore(item: CompressibleItem): number {
    let score = item.priority * 10;

    // Recency (if timestamp in metadata)
    if (item.timestamp) {
      const age = Date.now() - new Date(item.timestamp).getTime();
      const recencyScore = Math.max(0, 1 - age / (30 * 24 * 60 * 60 * 1000)); // Decay over 30 days
      score += recencyScore * 20;
    }

    // Source priority
    const sourcePriorities: Record<string, number> = {
      'profile': 30,
      'recent': 25,
      'search': 20,
      'memory': 15
    };
    score += sourcePriorities[item.source] || 10;

    // Importance tag
    if (item.importance) {
      score += item.importance * 20;
    }

    // Relevance (if query context available)
    if (item.relevance) {
      score += item.relevance * 30;
    }

    return score;
  }
}

export interface CompressibleItem {
  id: string;
  content: string;
  source: string;
  priority: number;
  timestamp?: string;
  importance?: number;
  relevance?: number;
}
```

---

### 3.3 Integration with VapiMemory

#### 3.3.1 Update VapiMemory Constructor

```typescript
// src/VapiMemory.ts - Update

import { CompressionEngine } from './compression/CompressionEngine';
import type { CompressionOptions } from './types';

export class VapiMemory {
  private client: SupermemoryClient;
  private options: Required<VapiMemoryOptions>;
  private profileCache: LRUCache<string, any>;
  private cleanupInterval?: ReturnType<typeof setInterval>;
  private compressionEngine?: CompressionEngine; // NEW

  constructor(options: VapiMemoryOptions) {
    this.options = {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl || 'https://api.supermemory.ai',
      maxTokens: options.maxTokens || 2000,
      searchThreshold: options.searchThreshold || 0.5,
      cacheEnabled: options.cacheEnabled !== false,
      cacheTTL: options.cacheTTL || 60000,
      logger: options.logger || console,
      compression: options.compression || { // NEW
        enabled: false, // Disabled by default for backward compatibility
        strategy: 'auto'
      },
    };

    // ... existing code ...

    // Initialize compression if enabled
    if (this.options.compression.enabled) {
      this.compressionEngine = new CompressionEngine(
        this.options.compression,
        this.options.logger
      );
    }
  }
}
```

#### 3.3.2 Update getContext to Support Compression

```typescript
// src/VapiMemory.ts - Update getContext method

async getContext(request: GetContextRequest): Promise<FormattedContext> {
  const startTime = Date.now();
  const sources: string[] = [];

  // ... existing context retrieval logic ...

  const endTime = Date.now();
  context.metadata.retrievalTime = endTime - startTime;
  context.metadata.sources = sources;

  this.options.logger.info(`Context retrieved for ${request.userId} in ${context.metadata.retrievalTime}ms (${sources.join(', ')})`);

  // NEW: Apply compression if needed
  const maxTokens = request.maxTokens || this.options.maxTokens;

  if (this.compressionEngine && context.totalTokens > maxTokens) {
    const compressed = await this.compressionEngine.compress(context, maxTokens);
    this.options.logger.info(
      `Compressed context for ${request.userId}: ` +
      `${compressed.compression.originalTokens} -> ${compressed.compression.compressedTokens} tokens ` +
      `(${(compressed.compression.reductionRatio * 100).toFixed(1)}% reduction)`
    );
    return compressed;
  }

  return context;
}
```

#### 3.3.3 Add Compression-Specific Methods

```typescript
// src/VapiMemory.ts - Add new methods

async compressContext(
  context: FormattedContext,
  options?: Partial<CompressionOptions>
): Promise<CompressedContext> {
  if (!this.compressionEngine) {
    throw new Error('Compression is not enabled. Set compression.enabled in constructor options.');
  }

  const compressionOptions = options
    ? { ...this.options.compression, ...options }
    : this.options.compression;

  const engine = new CompressionEngine(compressionOptions, this.options.logger);
  return await engine.compress(context, compressionOptions.maxTokens || this.options.maxTokens);
}

getCompressionStats(): {
  enabled: boolean;
  strategy: string;
  lastCompressTime?: number;
} | null {
  if (!this.compressionEngine) return null;

  return {
    enabled: true,
    strategy: this.options.compression.strategy,
    // Could track statistics here
  };
}
```

---

## 4. Implementation Phases

### Phase 4.1: Core Compression (Week 1, Days 1-3)
- [ ] Create compression directory structure
- [ ] Implement SentenceScorer utility
- [ ] Implement TextAnalyzer utility
- [ ] Implement SimilarityCalculator utility (Jaccard only initially)
- [ ] Implement PruningStrategy
- [ ] Add compression types to types/index.ts

### Phase 4.2: Advanced Strategies (Week 1, Days 4-5)
- [ ] Implement KeyPointExtractor
- [ ] Implement SummarizationCompressor
- [ ] Implement SemanticClusterer
- [ ] Implement AdaptivePipeline
- [ ] Unit tests for each strategy

### Phase 4.3: Integration (Week 2, Days 1-2)
- [ ] Implement CompressionEngine orchestrator
- [ ] Update VapiMemory constructor
- [ ] Update getContext method
- [ ] Add compressContext method
- [ ] Integration tests

### Phase 4.4: Testing & Optimization (Week 2, Days 3-5)
- [ ] Performance benchmarks (< 50ms target)
- [ ] Edge case testing (empty, single item, etc.)
- [ ] Quality evaluation (fact retention tests)
- [ ] Documentation
- [ ] Examples

---

## 5. Testing Strategy

### 5.1 Unit Tests

```typescript
// test/compression/PruningStrategy.test.ts
import { describe, it, expect } from 'bun:test';
import { PruningStrategy } from '../src/compression/strategies/PruningStrategy';

describe('PruningStrategy', () => {
  it('should prune items within token budget', () => {
    const strategy = new PruningStrategy({ enabled: true, strategy: 'auto' });
    const items = [
      { id: '1', content: 'A', source: 'memory', priority: 1 },
      { id: '2', content: 'B', source: 'memory', priority: 2 },
      { id: '3', content: 'C', source: 'memory', priority: 3 },
    ];

    const result = strategy.prune(items, 10);
    expect(result.length).toBeLessThanOrEqual(items.length);
    expect(result).toContainEqual(items[2]); // Highest priority
  });

  it('should prioritize by source', () => {
    const strategy = new PruningStrategy({ enabled: true, strategy: 'auto' });
    const items = [
      { id: '1', content: 'Profile fact', source: 'profile', priority: 1 },
      { id: '2', content: 'Recent memory', source: 'recent', priority: 1 },
      { id: '3', content: 'Search result', source: 'search', priority: 1 },
    ];

    const result = strategy.prune(items, 5);
    expect(result[0].source).toBe('profile');
  });
});
```

### 5.2 Integration Tests

```typescript
// test/VapiMemory.compression.test.ts
import { describe, it, expect } from 'bun:test';
import { VapiMemory } from '../src/VapiMemory';

describe('VapiMemory Compression', () => {
  it('should compress large context', async () => {
    const memory = new VapiMemory({
      apiKey: 'test-key',
      compression: {
        enabled: true,
        strategy: 'auto',
        targetRatio: 0.5
      }
    });

    const largeContext: FormattedContext = {
      profile: {
        static: Array(100).fill('User has many facts about their preferences and history'),
        dynamic: Array(100).fill('User recently did many things')
      },
      recentMemories: Array(50).fill('Recent memory with lots of detail'),
      searchResults: Array(50).fill('Search result with relevant information'),
      totalTokens: 5000,
      metadata: {
        userId: 'test',
        retrievalTime: 100,
        sources: ['profile', 'recent', 'search']
      }
    };

    const compressed = await memory.compressContext(largeContext, { maxTokens: 1000 });

    expect(compressed.compression.applied).toBe(true);
    expect(compressed.compression.compressedTokens).toBeLessThanOrEqual(1000);
    expect(compressed.compression.reductionRatio).toBeGreaterThan(0.5);
  });

  it('should not compress small context', async () => {
    const memory = new VapiMemory({
      apiKey: 'test-key',
      compression: {
        enabled: true,
        strategy: 'auto'
      }
    });

    const smallContext: FormattedContext = {
      profile: {
        static: ['User likes coffee'],
        dynamic: ['User called yesterday']
      },
      recentMemories: ['Recent conversation'],
      searchResults: ['Search result'],
      totalTokens: 50,
      metadata: {
        userId: 'test',
        retrievalTime: 10,
        sources: ['profile', 'recent', 'search']
      }
    };

    const result = await memory.getContext({ userId: 'test' });
    expect(result.totalTokens).toBeLessThanOrEqual(2000);
  });
});
```

### 5.3 Performance Tests

```typescript
// test/compression/performance.test.ts
import { describe, it, expect } from 'bun:test';
import { CompressionEngine } from '../src/compression/CompressionEngine';

describe('Compression Performance', () => {
  it('should compress within 50ms', async () => {
    const engine = new CompressionEngine(
      { enabled: true, strategy: 'auto' },
      console
    );

    const largeContext: FormattedContext = {
      profile: {
        static: Array(200).fill('Long profile text with many details'),
        dynamic: Array(200).fill('Dynamic profile information')
      },
      recentMemories: Array(100).fill('Recent memory content'),
      searchResults: Array(100).fill('Search result content'),
      totalTokens: 10000,
      metadata: {
        userId: 'test',
        retrievalTime: 100,
        sources: ['profile', 'recent', 'search']
      }
    };

    const start = Date.now();
    const result = await engine.compress(largeContext, 2000);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(50);
  });

  it('should maintain quality', async () => {
    const engine = new CompressionEngine(
      { enabled: true, strategy: 'conservative' },
      console
    );

    const context: FormattedContext = {
      profile: {
        static: [
          'User name is John Doe',
          'User is 30 years old',
          'User lives in New York',
          'User works as a software engineer'
        ],
        dynamic: []
      },
      recentMemories: [],
      searchResults: [],
      totalTokens: 50,
      metadata: {
        userId: 'test',
        retrievalTime: 10,
        sources: ['profile']
      }
    };

    const compressed = await engine.compress(context, 30);

    // Check key facts are preserved
    const combined = [
      ...compressed.profile!.static,
      ...compressed.profile!.dynamic,
      ...compressed.recentMemories,
      ...compressed.searchResults
    ].join(' ');

    expect(combined).toContain('John');
    expect(combined).toContain('30');
  });
});
```

---

## 6. Configuration Examples

### 6.1 Basic Usage (Disabled by Default)

```typescript
import { VapiMemory } from 'vapi-memory';

const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY,
  // Compression disabled by default
});

const context = await memory.getContext({
  userId: '+1234567890',
  maxTokens: 2000
});
// No compression applied
```

### 6.2 Auto Compression

```typescript
const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY,
  compression: {
    enabled: true,
    strategy: 'auto', // Automatically selects best strategy
  }
});

const context = await memory.getContext({
  userId: '+1234567890',
  maxTokens: 2000
});
// Compressed if totalTokens > 2000
```

### 6.3 Conservative Mode (Preserve Quality)

```typescript
const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY,
  compression: {
    enabled: true,
    strategy: 'conservative',
    preserveProfile: true,      // Never compress profile
    preserveKeyFacts: true,      // Keep named entities, numbers
  }
});
```

### 6.4 Aggressive Mode (Max Compression)

```typescript
const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY,
  compression: {
    enabled: true,
    strategy: 'aggressive',
    targetRatio: 0.3, // Reduce to 30% of original
  }
});
```

### 6.5 Custom Compression

```typescript
const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY,
  compression: {
    enabled: false, // Disabled by default
  }
});

const context = await memory.getContext({ userId: '+1234567890' });

// Compress manually with custom options
const compressed = await memory.compressContext(context, {
  enabled: true,
  strategy: 'custom',
  targetRatio: 0.5,
  maxTokens: 1500
});
```

---

## 7. Performance Targets

| Metric | Target | Note |
|--------|--------|------|
| Compression time (small < 1000 tokens) | < 10ms | Very fast |
| Compression time (medium 1000-5000 tokens) | < 30ms | Fast |
| Compression time (large > 5000 tokens) | < 50ms | Acceptable |
| Token reduction (conservative) | 20-40% | High quality |
| Token reduction (auto) | 40-60% | Balanced |
| Token reduction (aggressive) | 60-80% | Maximum compression |
| Fact retention (conservative) | > 95% | Nearly all facts preserved |
| Fact retention (auto) | > 90% | Most facts preserved |
| Fact retention (aggressive) | > 80% | Key facts preserved |

---

## 8. Edge Cases & Considerations

### 8.1 Empty Context

```typescript
// Should handle gracefully
const empty: FormattedContext = {
  recentMemories: [],
  searchResults: [],
  totalTokens: 0,
  metadata: { userId: 'test', retrievalTime: 0, sources: [] }
};

const result = await engine.compress(empty, 1000);
// Result: empty, no compression applied
```

### 8.2 Single Item

```typescript
// Should not compress if below target
const single: FormattedContext = {
  recentMemories: ['Short message'],
  searchResults: [],
  totalTokens: 5,
  metadata: { userId: 'test', retrievalTime: 0, sources: ['recent'] }
};

const result = await engine.compress(single, 1000);
// Result: no compression, original returned
```

### 8.3 Very Small Target

```typescript
// Should handle gracefully, return minimal context
const large: FormattedContext = {
  profile: { static: ['Long profile'], dynamic: [] },
  recentMemories: Array(100).fill('Memory'),
  searchResults: Array(100).fill('Result'),
  totalTokens: 5000,
  metadata: { userId: 'test', retrievalTime: 0, sources: ['all'] }
};

const result = await engine.compress(large, 10); // Very small target
// Result: single most important item returned
```

### 8.4 Non-English Text

```typescript
// Should work with any language (simple sentence splitting)
const nonEnglish: FormattedContext = {
  recentMemories: ['Usuario prefiere español', '用户喜欢咖啡'],
  searchResults: [],
  totalTokens: 20,
  metadata: { userId: 'test', retrievalTime: 0, sources: ['recent'] }
};

// Uses character-based token estimation, works with any language
```

---

## 9. Documentation Requirements

### 9.1 README Updates

Add to README.md:

```markdown
## Context Compression

vapi-memory supports intelligent context compression to fit within token limits.

### Enabling Compression

```typescript
import { VapiMemory } from 'vapi-memory';

const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY,
  compression: {
    enabled: true,
    strategy: 'auto'
  }
});
```

### Compression Strategies

- **auto**: Automatically selects best strategy based on context size
- **conservative**: Prunes low-value items, preserves facts
- **aggressive**: Summarizes heavily for maximum compression
- **custom**: Use targetRatio to specify exact reduction

### Options

- `preserveProfile`: Never compress profile facts (default: true)
- `preserveRecent`: Never compress recent memories (default: true)
- `preserveKeyFacts`: Keep named entities and numbers (default: true)
- `useEmbeddings`: Use semantic similarity (requires API key, default: false)
```

### 9.2 API Documentation

Document all compression methods:

- `compressContext(context, options)` - Manual compression
- `getCompressionStats()` - Get compression configuration
- Compression options interface
- CompressedContext return type

### 9.3 Examples

Create example: `examples/compression-usage.ts`

```typescript
import { VapiMemory } from 'vapi-memory';

const memory = new VapiMemory({
  apiKey: process.env.SUPERMEMORY_API_KEY,
  maxTokens: 2000,
  compression: {
    enabled: true,
    strategy: 'auto',
    preserveProfile: true
  }
});

// Get compressed context
const context = await memory.getContext({
  userId: '+1234567890',
  maxTokens: 1500 // Override default
});

console.log(`Compression: ${(context.compression?.reductionRatio * 100).toFixed(1)}%`);
console.log(`Tokens: ${context.compression?.compressedTokens}/${context.compression?.originalTokens}`);
```

---

## 10. Success Metrics

### 10.1 Functional Metrics
- [ ] Compression reduces tokens within < 50ms
- [ ] Conservative mode retains > 95% of facts
- [ ] Auto mode balances quality and compression (40-60% reduction)
- [ ] Aggressive mode achieves > 60% reduction
- [ ] No data loss on repeated compression cycles

### 10.2 Quality Metrics
- [ ] Named entities preserved in all modes
- [ ] Recent memories prioritized over old
- [ ] Profile facts preserved when preserveProfile=true
- [ ] Semantic coherence maintained

### 10.3 Code Quality Metrics
- [ ] 100% unit test coverage for compression
- [ ] Integration tests pass
- [ ] Performance tests pass (< 50ms)
- [ ] TypeScript types complete
- [ ] Documentation complete

---

## 11. Future Enhancements (Beyond Phase 4)

1. **LLM-based Summarization** (Optional)
   - Use external LLM API for higher quality summaries
   - Trade-off: slower but better quality
   - Can be opt-in with embeddingProvider option

2. **Machine Learning Clustering**
   - Train models for better semantic clustering
   - Custom embeddings per user/application

3. **Progressive Loading**
   - Stream compressed context as conversation progresses
   - Dynamically adjust compression based on LLM needs

4. **Compression Caching**
   - Cache compressed results
   - Invalidate on new memories

5. **User Feedback Integration**
   - Learn which memories are important
   - Adjust compression weights dynamically

---

## Summary

This compression plan provides:

1. **Research-backed techniques**: Summarization, key points, clustering, pruning
2. **Practical algorithms**: No external LLM dependencies, fast execution
3. **Flexible API**: Multiple strategies, configurable options
4. **VapiMemory integration**: Seamless, backward-compatible
5. **Performance targets**: < 50ms compression, 40-60% reduction
6. **Quality guarantees**: Fact preservation, semantic coherence

The implementation is broken into manageable phases with clear testing requirements and documentation needs.
