/**
 * Token Estimator
 *
 * Estimates token counts for LLM context.
 */

export class TokenEstimator {
  estimate(text: string): number {
    throw new Error('Not implemented');
  }

  estimateBatch(texts: string[]): number[] {
    throw new Error('Not implemented');
  }
}
