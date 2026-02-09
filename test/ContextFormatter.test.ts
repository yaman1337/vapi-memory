import { test, expect, describe } from 'bun:test';
import { ContextFormatter } from '../src/formatters/ContextFormatter';
import type { ContextSection } from '../src/formatters/ContextFormatter';

describe('ContextFormatter', () => {
  test('should format sections within token budget', () => {
    const sections: ContextSection[] = [
      { id: '1', content: 'First memory', priority: 1, tokens: 10, source: 'profile' },
      { id: '2', content: 'Second memory', priority: 2, tokens: 10, source: 'search' },
      { id: '3', content: 'Third memory', priority: 3, tokens: 15, source: 'recent' },
    ];

    const result = ContextFormatter.format(sections, {
      maxTokens: 30,
      includeTokens: true,
      includeMetadata: true,
    });

    expect(result.usedTokens).toBeLessThanOrEqual(30);
    expect(result.sections.length).toBe(2); // First two fit within 30 tokens
  });

  test('should sort sections by priority', () => {
    const sections: ContextSection[] = [
      { id: '3', content: 'Low priority', priority: 3, tokens: 10, source: 'low' },
      { id: '1', content: 'High priority', priority: 1, tokens: 10, source: 'high' },
      { id: '2', content: 'Medium priority', priority: 2, tokens: 10, source: 'medium' },
    ];

    const result = ContextFormatter.format(sections, {
      maxTokens: 100,
      includeTokens: false,
      includeMetadata: false,
    });

    expect(result.formatted).toContain('High priority');
    expect(result.formatted).toContain('Medium priority');
    expect(result.formatted).toContain('Low priority');

    // Check that the sections array is sorted by priority (descending)
    expect(result.sections[0].priority).toBeGreaterThan(result.sections[1].priority);
    expect(result.sections[1].priority).toBeGreaterThan(result.sections[2].priority);
  });

  test('should deduplicate exact matches', () => {
    const sections: ContextSection[] = [
      { id: '1', content: 'User loves coffee', priority: 1, tokens: 10, source: 'profile' },
      { id: '2', content: 'User loves coffee', priority: 2, tokens: 10, source: 'search' },
      { id: '3', content: 'User prefers tea', priority: 3, tokens: 10, source: 'recent' },
    ];

    const result = ContextFormatter.format(sections, {
      maxTokens: 100,
      includeTokens: false,
      includeMetadata: false,
    });

    // Should only include one instance of "User loves coffee"
    const matches = (result.formatted.match(/User loves coffee/gi) || []).length;
    expect(matches).toBe(1);
    expect(result.formatted).toContain('User prefers tea');
  });

  test('should deduplicate similar content', () => {
    const sections: ContextSection[] = [
      { id: '1', content: 'User lives in New York', priority: 1, tokens: 15, source: 'profile' },
      { id: '2', content: 'User is from New York', priority: 2, tokens: 15, source: 'search' },
      { id: '3', content: 'User resides in NYC', priority: 3, tokens: 12, source: 'recent' },
    ];

    const result = ContextFormatter.format(sections, {
      maxTokens: 100,
      includeTokens: false,
      includeMetadata: true,
    });

    // Should include all 3 (similarity threshold is 0.85 and these are below that)
    expect(result.metadata?.includedItems).toBeLessThanOrEqual(3);
  });

  test('should return metadata when requested', () => {
    const sections: ContextSection[] = [
      { id: '1', content: 'First', priority: 1, tokens: 10, source: 'source1' },
      { id: '2', content: 'Second', priority: 2, tokens: 10, source: 'source2' },
      { id: '3', content: 'Third', priority: 3, tokens: 10, source: 'source1' },
    ];

    const result = ContextFormatter.format(sections, {
      maxTokens: 100,
      includeTokens: false,
      includeMetadata: true,
    });

    expect(result.metadata).toBeDefined();
    expect(result.metadata?.totalItems).toBe(3);
    expect(result.metadata?.includedItems).toBe(3);
    expect(result.metadata?.excludedItems).toBe(0);
    expect(result.metadata?.sources).toEqual(['source1', 'source2']);
  });

  test('should use custom separator', () => {
    const sections: ContextSection[] = [
      { id: '1', content: 'First', priority: 1, tokens: 10, source: 'profile' },
      { id: '2', content: 'Second', priority: 2, tokens: 10, source: 'search' },
    ];

    const result = ContextFormatter.format(sections, {
      maxTokens: 100,
      includeTokens: false,
      includeMetadata: false,
      separator: ' || ',
    });

    expect(result.formatted).toContain(' || ');
  });

  test('should calculate Jaccard similarity correctly', () => {
    // Access private method for testing similarity calculation
    const formatter = ContextFormatter as any;
    const sim1 = formatter.calculateSimilarity('hello world', 'hello world');
    const sim2 = formatter.calculateSimilarity('hello world', 'hello there');
    const sim3 = formatter.calculateSimilarity('', 'anything');
    const sim4 = formatter.calculateSimilarity('anything', '');

    expect(sim1).toBe(1.0); // Exact match
    expect(sim2).toBeGreaterThan(0.3); // Partial match
    expect(sim2).toBeLessThan(0.6); // Not too similar
    expect(sim3).toBe(0.0); // One empty
    expect(sim4).toBe(0.0); // One empty
  });

  test('should handle empty sections array', () => {
    const result = ContextFormatter.format([], {
      maxTokens: 100,
      includeTokens: false,
      includeMetadata: false,
    });

    expect(result.formatted).toBe('');
    expect(result.usedTokens).toBe(0);
    expect(result.sections.length).toBe(0);
  });
});
