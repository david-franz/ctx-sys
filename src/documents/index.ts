export { MarkdownParser } from './markdown-parser';
export { RequirementExtractor } from './requirement-extractor';
export { DocumentLinker } from './document-linker';
export { DocumentIndexer } from './document-indexer';
export { chunkSections, ChunkingOptions } from './document-chunker';
export type { DocumentIndexOptions, DocumentIndexResult, DirectoryIndexOptions, DirectoryIndexResult } from './document-indexer';
export {
  MarkdownDocument,
  MarkdownSection,
  CodeBlock,
  Link,
  Requirement,
  RequirementInput,
  RequirementSource,
  CodeReference,
  LinkingResult
} from './types';
