import type { FormattedContext } from '../types';
import type { Assistant, AssistantOverrides, AssistantResponse, Message } from '../types';

export interface BuildAssistantOptions {
  context: FormattedContext;
  baseAssistant?: Partial<Assistant>;
  injectContext?: boolean;
  contextTemplate?: string;
}

export interface BuildOverridesOptions {
  context: FormattedContext;
  assistantId?: string;
  additionalOverrides?: Partial<AssistantOverrides>;
}

export interface BuildSelectionOptions {
  context: FormattedContext;
  assistantId: string;
  includeContext?: boolean;
}

export class VapiResponseBuilder {
  private static readonly DEFAULT_CONTEXT_TEMPLATE = `
User context:

{{#profile.static}}
Static Profile:
{{/profile.static}}
{{profile.static.join('\\n')}}

{{/profile.static}}

{{#profile.dynamic}}
Dynamic Profile:
{{/profile.dynamic}}
{{profile.dynamic.join('\\n')}}

{{/profile.dynamic}}

{{#recentMemories}}
Recent Memories:
{{/recentMemories}}
{{recentMemories.join('\\n')}}

{{/recentMemories}}

{{#searchResults}}
Relevant Memories:
{{/searchResults}}
{{searchResults.join('\\n')}}

{{/searchResults}}

Context info: {{totalTokens}} tokens retrieved in {{retrievalTime}}ms from {{sources.join(', ')}}.
`;

  static buildAssistant(options: BuildAssistantOptions): AssistantResponse {
    const { context, baseAssistant, injectContext = true } = options;

    // Build system message with context if requested
    let messages = baseAssistant?.messages || [];

    if (injectContext) {
      const systemMessage = this.buildSystemMessage(context);
      messages = [systemMessage, ...messages];
    }

    // Return full assistant configuration
    return {
      assistant: baseAssistant ? {
        ...baseAssistant,
        messages,
      } : {
        messages,
      },
    };
  }

  static buildOverrides(options: BuildOverridesOptions): AssistantResponse {
    const { context, assistantId, additionalOverrides } = options;

    // Build system message with context
    const systemMessage = this.buildSystemMessage(context);

    const overrides: AssistantOverrides = {
      messages: [systemMessage],
      ...additionalOverrides,
    };

    // Return with assistant selection
    return {
      assistantId,
      assistantOverrides: overrides,
    };
  }

  static buildAssistantSelection(options: BuildSelectionOptions): AssistantResponse {
    const { context, assistantId, includeContext = true } = options;

    // Return just the assistant ID if no context injection
    if (!includeContext) {
      return {
        assistantId,
      };
    }

    // Build system message with context
    const systemMessage = this.buildSystemMessage(context);

    const overrides: AssistantOverrides = {
      messages: [systemMessage],
    };

    return {
      assistantId,
      assistantOverrides: overrides,
    };
  }

  static buildSystemMessage(context: FormattedContext): Message {
    const content = this.formatContextString(context);
    return {
      role: 'system',
      content,
    };
  }

  static injectContextToMessages(
    messages: Message[],
    context: FormattedContext,
    position: 'before' | 'after' = 'before'
  ): Message[] {
    const systemMessage = this.buildSystemMessage(context);

    if (position === 'before') {
      return [systemMessage, ...messages];
    } else {
      return [...messages, systemMessage];
    }
  }

  private static formatContextString(context: FormattedContext): string {
    let parts: string[] = ['User context:\n'];

    if (context.profile?.static && context.profile.static.length > 0) {
      parts.push('Static Profile:');
      parts.push(...context.profile.static);
      parts.push('');
    }

    if (context.profile?.dynamic && context.profile.dynamic.length > 0) {
      parts.push('Dynamic Profile:');
      parts.push(...context.profile.dynamic);
      parts.push('');
    }

    if (context.recentMemories && context.recentMemories.length > 0) {
      parts.push('Recent Memories:');
      parts.push(...context.recentMemories);
      parts.push('');
    }

    if (context.searchResults && context.searchResults.length > 0) {
      parts.push('Relevant Memories:');
      parts.push(...context.searchResults);
      parts.push('');
    }

    parts.push(`Context includes ${context.totalTokens} estimated tokens.`);
    parts.push(`Retrieved in ${context.metadata.retrievalTime}ms from sources: ${context.metadata.sources.join(', ')}.`);

    return parts.join('\n');
  }

  static extractVariableValues(context: FormattedContext): Record<string, string> {
    const values: Record<string, string> = {};

    // Extract from profile
    if (context.profile?.static) {
      values.userName = this.extractValue(context.profile.static, ['name', 'Name']);
      values.userTier = this.extractValue(context.profile.static, ['VIP', 'vip', 'premium', 'standard']);
      values.userLocation = this.extractValue(context.profile.static, ['lives', 'location', 'in']);
      values.userAge = this.extractValue(context.profile.static, ['years old', 'age']);
    }

    // Extract recent activities
    if (context.recentMemories && context.recentMemories.length > 0) {
      values.recentActivities = context.recentMemories.slice(0, 3).join('; ');
    }

    return values;
  }

  private static extractValue(facts: string[], keywords: string[]): string {
    for (const fact of facts) {
      const lowerFact = fact.toLowerCase();
      for (const keyword of keywords) {
        if (lowerFact.includes(keyword)) {
          return fact;
        }
      }
    }
    return '';
  }
}
