/**
 * F10.12: Query Decomposition.
 * Breaks complex multi-part queries into sub-queries for better retrieval.
 */

export interface SubQuery {
  text: string;
  weight: number;
}

export interface DecompositionResult {
  subQueries: SubQuery[];
  wasDecomposed: boolean;
}

// Patterns that indicate multi-part queries
const CONJUNCTION_PATTERNS = [
  /\band\b/i,
  /\balso\b/i,
  /\bas well as\b/i,
  /\bplus\b/i,
  /\balong with\b/i,
];

const SEQUENTIAL_PATTERNS = [
  /\bthen\b/i,
  /\bafter\b/i,
  /\bfollowed by\b/i,
  /\bbefore\b/i,
];

const QUESTION_SEPARATORS = [
  /\?\s+/,
  /;\s+/,
];

export class QueryDecomposer {
  /**
   * Decompose a complex query into sub-queries.
   * Single-topic queries are returned as-is.
   */
  decompose(query: string): DecompositionResult {
    const trimmed = query.trim();
    if (!trimmed) {
      return { subQueries: [{ text: trimmed, weight: 1.0 }], wasDecomposed: false };
    }

    // Try question-based splitting first (most reliable delimiter)
    const questionParts = this.splitByQuestions(trimmed);
    if (questionParts.length > 1) {
      return {
        subQueries: questionParts.map(text => ({ text, weight: 1.0 })),
        wasDecomposed: true,
      };
    }

    // Try conjunction-based splitting
    const conjunctionParts = this.splitByConjunctions(trimmed);
    if (conjunctionParts.length > 1) {
      return {
        subQueries: conjunctionParts.map(text => ({ text, weight: 1.0 })),
        wasDecomposed: true,
      };
    }

    // Try sequential splitting
    const sequentialParts = this.splitBySequential(trimmed);
    if (sequentialParts.length > 1) {
      return {
        subQueries: sequentialParts.map((text, i) => ({
          text,
          weight: 1.0 - (i * 0.1), // Later steps get slightly less weight
        })),
        wasDecomposed: true,
      };
    }

    // Single-topic query — no decomposition needed
    return { subQueries: [{ text: trimmed, weight: 1.0 }], wasDecomposed: false };
  }

  private splitByQuestions(query: string): string[] {
    for (const sep of QUESTION_SEPARATORS) {
      const parts = query.split(sep).map(s => s.trim()).filter(s => s.length > 3);
      if (parts.length > 1) return parts;
    }
    return [query];
  }

  private splitByConjunctions(query: string): string[] {
    for (const pattern of CONJUNCTION_PATTERNS) {
      const parts = query.split(pattern).map(s => s.trim()).filter(s => s.length > 3);
      if (parts.length > 1 && this.areIndependentTopics(parts)) {
        return parts;
      }
    }
    return [query];
  }

  private splitBySequential(query: string): string[] {
    for (const pattern of SEQUENTIAL_PATTERNS) {
      const parts = query.split(pattern).map(s => s.trim()).filter(s => s.length > 3);
      if (parts.length > 1 && this.areIndependentTopics(parts)) {
        return parts;
      }
    }
    return [query];
  }

  /**
   * Heuristic: parts are independent topics if they don't share
   * significant keywords (pronouns and short words excluded).
   */
  private areIndependentTopics(parts: string[]): boolean {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'it', 'its', 'this', 'that', 'how', 'what',
      'where', 'when', 'which', 'who', 'why', 'i', 'me', 'my', 'we', 'our', 'you',
      'your', 'they', 'their', 'them']);

    const keywordSets = parts.map(part => {
      const words = part.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w));
      return new Set(words);
    });

    // Check overlap between consecutive parts
    for (let i = 0; i < keywordSets.length - 1; i++) {
      const setA = keywordSets[i];
      const setB = keywordSets[i + 1];
      let overlap = 0;
      for (const word of setA) {
        if (setB.has(word)) overlap++;
      }
      // If more than 50% overlap, they're likely the same topic
      const minSize = Math.min(setA.size, setB.size);
      if (minSize > 0 && overlap / minSize > 0.5) {
        return false;
      }
    }

    return true;
  }
}
