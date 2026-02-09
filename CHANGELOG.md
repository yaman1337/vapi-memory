# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - Phase 2 Complete

### Added
- **Token Counter utility**: Accurate token estimation using character and word-based methods
- **LRU Cache**: In-memory cache with automatic expiration and statistics
- **Context Formatter**: Advanced context formatting with token budgeting and deduplication
- **Memory Deduplication**: Automatic removal of exact and semantically similar memories
- **Priority-based Ranking**: Sort context sections by importance
- **Cache Integration**: Profile caching in VapiMemory with configurable TTL
- **Cache Management**: Methods to clear cache and get statistics
- **33 Unit Tests**: Comprehensive tests for all utilities and caching
- **Advanced Examples**: Demonstrates cache performance and context management
- **Server Integration Example**: Complete Vapi server integration pattern

### Changed
- `getContext()` now uses cache for profile data
- `getContext()` uses `TokenCounter` for more accurate token estimation
- Cache automatically cleans up expired entries every 60 seconds
- Improved token budgeting with `TokenCounter.formatWithinBudget()`

## [0.1.0] - Phase 1 Complete

### Added
- Core `VapiMemory` class with context retrieval
- `getContext()` method for fetching user profiles and relevant memories
- `storeConversation()` method for saving call transcripts
- `getUserProfile()` method for retrieving user profiles
- `addMemory()` method for adding individual memories
- `createAssistantResponse()` helper for Vapi integration
- `createContextMessage()` helper for formatting context
- Supermemory client wrapper with error handling
- TypeScript type definitions
- Unit tests for core functionality
- Basic usage example
- Comprehensive README with API reference

### Changed
- Initial release

## [Unreleased]

### Planned
- Context formatter with token budgeting
- Relevance ranking algorithm
- Memory deduplication
- In-memory caching layer
- Vapi response builder
- System message injection
- Variable formatting
- Tool integration helpers
- Complete example servers
- Advanced features (summarization, compression)
- CI/CD pipeline
- npm publishing
