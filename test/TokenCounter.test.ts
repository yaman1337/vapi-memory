import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { TokenCounter } from '../src/utils/token-counter';

describe('TokenCounter', () => {
  test('should estimate tokens for empty string', () => {
    const tokens = TokenCounter.estimate('');
    expect(tokens).toBe(0);
  });

  test('should estimate tokens for short text', () => {
    const text = 'Hello';
    const tokens = TokenCounter.estimate(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10);
  });

  test('should estimate tokens for long text', () => {
    const text = 'This is a much longer text that contains many more words and characters to test the token estimation algorithm effectively.';
    const tokens = TokenCounter.estimate(text);
    expect(tokens).toBeGreaterThan(10);
    expect(tokens).toBeLessThan(100);
  });

  test('should estimate tokens for multiple strings', () => {
    const texts = ['Hello', 'World', 'Test'];
    const total = TokenCounter.estimateMultiple(texts);
    const individual = texts.map(t => TokenCounter.estimate(t)).reduce((sum, t) => sum + t, 0);
    expect(total).toBe(individual);
  });

  test('should format text within budget', () => {
    const texts = ['First item', 'Second item', 'Third item', 'Fourth item'];
    const budget = 20;

    const result = TokenCounter.formatWithinBudget(texts, budget);

    expect(result.usedTokens).toBeLessThanOrEqual(budget);
    expect(result.includedCount).toBeGreaterThan(0);
    expect(result.includedCount).toBeLessThanOrEqual(texts.length);
  });

  test('should include all items if budget allows', () => {
    const texts = ['One', 'Two', 'Three'];
    const budget = 100;

    const result = TokenCounter.formatWithinBudget(texts, budget);

    expect(result.includedCount).toBe(texts.length);
    expect(result.formatted).toContain('One');
    expect(result.formatted).toContain('Two');
    expect(result.formatted).toContain('Three');
  });

  test('should use custom separator', () => {
    const texts = ['First', 'Second'];
    const result = TokenCounter.formatWithinBudget(texts, 50, ' | ');

    expect(result.formatted).toContain(' | ');
  });
});
