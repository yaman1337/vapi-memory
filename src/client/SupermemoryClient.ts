import Supermemory from 'supermemory';
import type { Logger } from '../types';

export interface ClientOptions {
  apiKey: string;
  baseURL?: string;
  logger?: Logger;
}

export class SupermemoryClient {
  private client: InstanceType<typeof Supermemory>;
  private logger: Logger;

  /**
   * Sanitize a containerTag to only contain alphanumeric characters, hyphens, and underscores.
   * The Supermemory API rejects tags with special characters like '+' from phone numbers.
   */
  private sanitizeContainerTag(tag: string): string {
    return tag.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  constructor(options: ClientOptions) {
    this.logger = options.logger || console;

    this.client = new Supermemory({
      apiKey: options.apiKey,
      baseURL: options.baseURL || 'https://api.supermemory.ai',
    });

    this.logger.info('Supermemory client initialized');
  }

  async getProfile(containerTag: string, query?: string, threshold?: number) {
    try {
      this.logger.debug(`Fetching profile for ${containerTag}`);
      const result = await this.client.profile({
        containerTag: this.sanitizeContainerTag(containerTag),
        q: query,
      });
      return result;
    } catch (error) {
      this.logger.error('Error fetching profile:', error);
      throw new Error(`Failed to fetch profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async addMemory(content: string, containerTag: string, metadata?: Record<string, any>) {
    try {
      this.logger.debug(`Adding memory for ${containerTag}`);
      const result = await this.client.add({
        content,
        containerTag: this.sanitizeContainerTag(containerTag),
        metadata,
      });
      return result;
    } catch (error) {
      this.logger.error('Error adding memory:', error);
      throw new Error(`Failed to add memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchMemories(
    query: string,
    containerTag: string,
    threshold?: number,
    limit?: number
  ) {
    try {
      this.logger.debug(`Searching memories: ${query} in ${containerTag}`);
      const result = await this.client.search.memories({
        q: query,
        containerTag: this.sanitizeContainerTag(containerTag),
        threshold,
        limit: limit || 5,
      });
      return result;
    } catch (error) {
      this.logger.error('Error searching memories:', error);
      throw new Error(`Failed to search memories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchDocuments(query: string, containerTags: string[], limit?: number) {
    try {
      this.logger.debug(`Searching documents: ${query} in ${containerTags.join(', ')}`);
      const result = await this.client.search.documents({
        q: query,
        containerTags: containerTags.map(tag => this.sanitizeContainerTag(tag)),
        limit: limit || 5,
      });
      return result;
    } catch (error) {
      this.logger.error('Error searching documents:', error);
      throw new Error(`Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
