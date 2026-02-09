export class TokenCounter {
  private static readonly CHARS_PER_TOKEN = 4;
  private static readonly TOKENS_PER_WORD = 0.75;

  static estimate(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Method 1: Character-based estimation
    const charEstimate = Math.ceil(text.length / this.CHARS_PER_TOKEN);

    // Method 2: Word-based estimation
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordEstimate = Math.ceil(words.length * this.TOKENS_PER_WORD);

    // Use the higher estimate to be conservative
    return Math.max(charEstimate, wordEstimate);
  }

  static estimateMultiple(texts: string[]): number {
    return texts.reduce((total, text) => total + this.estimate(text), 0);
  }

  static formatWithinBudget(
    texts: string[],
    budget: number,
    separator: string = '\n'
  ): { formatted: string; usedTokens: number; includedCount: number } {
    let usedTokens = 0;
    const included: string[] = [];

    for (const text of texts) {
      const tokenCount = this.estimate(text);
      if (usedTokens + tokenCount > budget) {
        break;
      }
      usedTokens += tokenCount;
      included.push(text);
    }

    return {
      formatted: included.join(separator),
      usedTokens,
      includedCount: included.length,
    };
  }
}
