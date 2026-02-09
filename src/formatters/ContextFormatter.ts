import { TokenCounter } from '../utils/token-counter';

export interface ContextSection {
  id: string;
  content: string;
  priority: number;
  tokens: number;
  source: string;
}

export interface FormatOptions {
  maxTokens: number;
  includeTokens: boolean;
  includeMetadata: boolean;
  separator?: string;
}

export interface FormattedOutput {
  formatted: string;
  usedTokens: number;
  sections: ContextSection[];
  metadata?: {
    totalItems: number;
    includedItems: number;
    excludedItems: number;
    sources: string[];
  };
}

export class ContextFormatter {
  static format(
    sections: ContextSection[],
    options: FormatOptions
  ): FormattedOutput {
    const { maxTokens, includeTokens, includeMetadata, separator = '\n\n' } = options;

    // Sort sections by priority (higher = more important)
    const sorted = [...sections].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // For same priority, sort by recency (we assume lower ID = older)
      return b.id.localeCompare(a.id);
    });

    // Deduplicate sections with similar content
    const deduplicated = this.deduplicate(sorted);

    // Select sections within token budget
    let usedTokens = 0;
    const included: ContextSection[] = [];
    const excluded: ContextSection[] = [];

    for (const section of deduplicated) {
      if (usedTokens + section.tokens > maxTokens) {
        excluded.push(section);
        continue;
      }
      usedTokens += section.tokens;
      included.push(section);
    }

    // Build formatted string
    let formatted = '';
    for (const section of included) {
      formatted += section.content;
      if (includeMetadata) {
        formatted += ` [${section.source}]`;
      }
      if (includeTokens) {
        formatted += ` [${section.tokens}t]`;
      }
      formatted += separator;
    }

    // Add summary line if tokens requested
    if (includeTokens) {
      formatted += `\nTotal: ${usedTokens}/${maxTokens} tokens`;
    }

    // Build metadata
    const sources = Array.from(new Set(included.map(s => s.source)));
    const metadata = {
      totalItems: deduplicated.length,
      includedItems: included.length,
      excludedItems: excluded.length,
      sources,
    };

    return {
      formatted: formatted.trim(),
      usedTokens,
      sections: included,
      metadata: includeMetadata ? metadata : undefined,
    };
  }

  private static deduplicate(sections: ContextSection[]): ContextSection[] {
    const seen = new Set<string>();
    const deduplicated: ContextSection[] = [];

    for (const section of sections) {
      // Normalize content for comparison
      const normalized = section.content.toLowerCase().trim();

      // Check for exact duplicates
      if (seen.has(normalized)) {
        continue;
      }

      // Check for semantic duplicates (similar content)
      const isDuplicate = deduplicated.some(
        s => {
          const similarity = this.calculateSimilarity(s.content, section.content);
          return similarity > 0.85;
        }
      );

      if (isDuplicate) {
        continue;
      }

      seen.add(normalized);
      deduplicated.push(section);
    }

    return deduplicated;
  }

  private static calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    // Jaccard similarity for word overlap
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  static createSection(
    id: string,
    content: string,
    source: string,
    priority: number = 1
  ): ContextSection {
    return {
      id,
      content,
      tokens: TokenCounter.estimate(content),
      priority,
      source,
    };
  }

  static createSections(
    items: Array<{ id: string; content: string }>,
    source: string,
    priority: number = 1
  ): ContextSection[] {
    return items.map(item =>
      this.createSection(item.id, item.content, source, priority)
    );
  }
}
