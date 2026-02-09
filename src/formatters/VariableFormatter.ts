export interface ExtractOptions {
  includeProfile?: boolean;
  includeRecent?: boolean;
  includeSearch?: boolean;
}

export class VariableFormatter {
  private static readonly VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

  static extractVariables(template: string): string[] {
    const matches = template.match(this.VARIABLE_PATTERN);
    if (!matches) {
      return [];
    }

    return matches.map(match => match.replace(this.VARIABLE_PATTERN, '$1'));
  }

  static formatTemplate(
    template: string,
    variables: Record<string, string | string[] | null | undefined>
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      if (value === undefined || value === null) {
        continue;
      }
      const pattern = this.VARIABLE_PATTERN;
      const replacement = this.formatValue(value);
      const regex = new RegExp(`\\{\\{${this.escapeRegExp(key)}\\}\\}`, 'g');
      result = result.replace(regex, replacement);
    }

    return result;
  }

  static extractFromContext(
    context: any,
    options: ExtractOptions = {}
  ): Record<string, string> {
    const variables: Record<string, string> = {};

    if (options.includeProfile !== false && context.profile) {
      variables.userName = this.extractUserName(context.profile);
      variables.userTier = this.extractUserTier(context.profile);
      variables.userLocation = this.extractUserLocation(context.profile);
      variables.userAge = this.extractUserAge(context.profile);
      variables.userPreferences = this.extractUserPreferences(context.profile);

      const staticProfile = context.profile.static as string[] | undefined;
      const dynamicProfile = context.profile.dynamic as string[] | undefined;

      variables.profileStatic = staticProfile ? this.formatProfile(staticProfile) : '';
      variables.profileDynamic = dynamicProfile ? this.formatProfile(dynamicProfile) : '';
    }

    if (options.includeRecent !== false && context.recentMemories) {
      variables.recentMemoriesCount = String(context.recentMemories.length);
      variables.recentMemories = this.formatMemories(context.recentMemories);
      variables.lastInteraction = context.recentMemories[0] || '';
    }

    if (options.includeSearch !== false && context.searchResults) {
      variables.searchResultsCount = String(context.searchResults.length);
      variables.searchResults = this.formatMemories(context.searchResults);
      variables.topSearchResult = context.searchResults[0] || '';
    }

    return variables;
  }

  private static formatValue(value: string | string[]): string {
    if (Array.isArray(value)) {
      return value.join('\n');
    }

    return String(value);
  }

  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private static extractUserName(profile: any): string {
    if (!profile.static) return '';

    const nameFact = profile.static.find((s: string) =>
      s.toLowerCase().includes('name') || s.match(/is\s+\w+/i)
    );

    return this.extractNameFromFact(nameFact || '');
  }

  private static extractNameFromFact(fact: string): string {
    if (!fact) return '';

    const matches = fact.match(/(?:is|named|called)\s+(?:[A-Z][a-z]+|\w+)/i);
    return matches ? (matches[1] || fact) : fact;
  }

  private static extractUserTier(profile: any): string {
    if (!profile.static) return 'standard';

    const tierKeywords = profile.static.filter((s: string) =>
      ['vip', 'premium', 'gold', 'platinum', 'enterprise'].some(t => s.toLowerCase().includes(t))
    );

    return tierKeywords.length > 0 ? tierKeywords[0].toLowerCase() : 'standard';
  }

  private static extractUserLocation(profile: any): string {
    if (!profile.static) return '';

    const locationFact = profile.static.find((s: string) =>
      ['lives', 'located', 'based in', 'resides in'].some(loc => s.toLowerCase().includes(loc))
    );

    if (!locationFact) return '';

    const location = locationFact.replace(/(?:lives|located|based in|resides in)\s+/i, '');
    return location;
  }

  private static extractUserAge(profile: any): string {
    if (!profile.static) return '';

    const ageFact = profile.static.find((s: string) => s.match(/\d+\s*(?:years?|y\.o\.?)/i));
    return ageFact || '';
  }

  private static extractUserPreferences(profile: any): string {
    if (!profile.static) return '';

    const preferenceFacts = profile.static.filter((s: string) =>
      ['likes', 'loves', 'prefers', 'enjoys', 'hates', 'dislikes'].some(pref => s.toLowerCase().includes(pref))
    );

    return preferenceFacts.join('; ');
  }

  private static formatProfile(items: any): string {
    if (!items || items.length === 0) return '';

    return items.join('\n');
  }

  private static formatMemories(memories: any): string {
    if (!memories || memories.length === 0) return '';

    return memories.slice(0, 5).join('\n');
  }
}
