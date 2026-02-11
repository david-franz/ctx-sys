import * as TreeSitter from 'web-tree-sitter';
import * as fs from 'fs';
import * as path from 'path';
import { ParseResult, ParseError, SupportedLanguage } from './types';
import {
  LanguageExtractor,
  TypeScriptExtractor,
  PythonExtractor,
  CppExtractor,
  CSharpExtractor,
  GenericExtractor
} from './extractors';

// Type aliases from web-tree-sitter
type Language = TreeSitter.Language;
type Tree = TreeSitter.Tree;

/**
 * Language to grammar file mapping.
 * Some languages share grammars (e.g., C uses cpp grammar).
 */
const GRAMMAR_MAP: Record<string, string> = {
  typescript: 'tree-sitter-typescript.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  python: 'tree-sitter-python.wasm',
  go: 'tree-sitter-go.wasm',
  rust: 'tree-sitter-rust.wasm',
  java: 'tree-sitter-java.wasm',
  c: 'tree-sitter-cpp.wasm',  // C uses cpp grammar (compatible)
  cpp: 'tree-sitter-cpp.wasm',
  csharp: 'tree-sitter-c_sharp.wasm'
};

/**
 * Get the default path to bundled grammars from @vscode/tree-sitter-wasm.
 */
function getDefaultGrammarsDir(): string {
  try {
    const vscodePath = require.resolve('@vscode/tree-sitter-wasm/package.json');
    return path.join(path.dirname(vscodePath), 'wasm');
  } catch {
    // Fallback to local grammars directory
    return path.join(__dirname, '..', '..', 'grammars');
  }
}

/**
 * File extension to language mapping.
 */
const EXTENSION_MAP: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.cs': 'csharp'
};

/**
 * AST Parser using web-tree-sitter.
 */

export class ASTParser {
  private initialized: boolean = false;
  private languages: Map<string, Language> = new Map();
  private grammarsDir: string;

  constructor(grammarsDir?: string) {
    this.grammarsDir = grammarsDir || getDefaultGrammarsDir();
  }

  /**
   * Initialize tree-sitter. Must be called before parsing.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await TreeSitter.Parser.init();
    this.initialized = true;
  }

  /**
   * Get language for a file extension.
   */
  getLanguage(filePath: string): SupportedLanguage | null {
    const ext = path.extname(filePath).toLowerCase();
    return EXTENSION_MAP[ext] || null;
  }

  /**
   * Check if a file extension is supported.
   */
  isSupported(filePath: string): boolean {
    return this.getLanguage(filePath) !== null;
  }

  /**
   * Parse a file.
   */
  async parseFile(filePath: string): Promise<ParseResult> {
    const language = this.getLanguage(filePath);
    if (!language) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    return this.parseContent(content, language, filePath);
  }

  /**
   * Parse content string.
   */
  async parseContent(
    content: string,
    language: SupportedLanguage,
    filePath?: string
  ): Promise<ParseResult> {
    await this.initialize();

    const parser = new TreeSitter.Parser();
    const lang = await this.loadLanguage(language);
    parser.setLanguage(lang);

    const tree = parser.parse(content);
    if (!tree) {
      return {
        filePath: filePath || '<inline>',
        language,
        symbols: [],
        imports: [],
        exports: [],
        errors: [{ message: 'Failed to parse content', startLine: 1, endLine: 1 }]
      };
    }

    const extractor = this.getExtractor(language);

    const symbols = extractor.extractSymbols(tree.rootNode, filePath);
    const imports = extractor.extractImports(tree.rootNode);
    const exports = extractor.extractExports(tree.rootNode);
    const errors = this.extractErrors(tree);

    return {
      filePath: filePath || '<inline>',
      language,
      symbols,
      imports,
      exports,
      errors
    };
  }

  /**
   * Load a language grammar.
   */
  private async loadLanguage(language: SupportedLanguage): Promise<Language> {
    if (this.languages.has(language)) {
      return this.languages.get(language)!;
    }

    const grammarFile = GRAMMAR_MAP[language];
    if (!grammarFile) {
      throw new Error(`No grammar available for language: ${language}`);
    }

    const wasmPath = path.join(this.grammarsDir, grammarFile);

    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Grammar file not found: ${wasmPath}. Install @vscode/tree-sitter-wasm or provide a custom grammars directory.`);
    }

    const lang = await TreeSitter.Language.load(wasmPath);
    this.languages.set(language, lang);
    return lang;
  }

  /**
   * Get the appropriate extractor for a language.
   */
  private getExtractor(language: SupportedLanguage): LanguageExtractor {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return new TypeScriptExtractor();
      case 'python':
        return new PythonExtractor();
      case 'c':
      case 'cpp':
        return new CppExtractor();
      case 'csharp':
        return new CSharpExtractor();
      default:
        return new GenericExtractor();
    }
  }

  /**
   * Extract parse errors from tree.
   */
  private extractErrors(tree: Tree): ParseError[] {
    const errors: ParseError[] = [];
    const cursor = tree.walk();

    const visit = (): void => {
      if (cursor.nodeType === 'ERROR') {
        errors.push({
          message: 'Parse error',
          startLine: cursor.startPosition.row + 1,
          endLine: cursor.endPosition.row + 1
        });
      }
      if (cursor.gotoFirstChild()) {
        do {
          visit();
        } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    };

    visit();
    return errors;
  }

  /**
   * Get list of supported file extensions.
   */
  getSupportedExtensions(): string[] {
    return Object.keys(EXTENSION_MAP);
  }

  /**
   * Get list of supported languages.
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return [...new Set(Object.values(EXTENSION_MAP))];
  }
}
