export { EmbeddingManager, IncrementalEmbedResult, EmbeddingStats } from './manager';
export { EmbeddingProviderFactory } from './factory';
export { OllamaEmbeddingProvider } from './ollama';
export { OpenAIEmbeddingProvider } from './openai';
export { MockEmbeddingProvider } from './mock';
export { hashEntityContent, buildEmbeddingContent, hashContent } from './content-hasher';
export {
  EmbeddingProvider,
  BatchOptions,
  StoredEmbedding,
  SimilarityResult,
  ProviderConfig
} from './types';
