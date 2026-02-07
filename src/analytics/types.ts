/**
 * Analytics types for token usage tracking and ROI calculation.
 */

/**
 * Log entry for a single query with token metrics.
 */
export interface QueryLog {
  id: string;
  projectId: string;
  sessionId?: string;
  timestamp: Date;

  // Query details
  query?: string;
  queryType: 'context' | 'search' | 'decision' | 'entity';

  // Token metrics
  tokensRetrieved: number;
  tokensEstimatedFull: number;
  tokensSaved: number;

  // Cost estimates (in dollars)
  costActual: number;
  costEstimatedFull: number;
  costSaved: number;

  // Quality metrics
  relevanceScore: number;
  itemCount: number;
  wasUseful?: boolean;

  // Performance
  latencyMs: number;

  // Retrieval details
  retrievalStrategies: string[];
  itemTypes: Record<string, number>;
}

/**
 * Aggregated usage statistics for a time period.
 */
export interface UsageStats {
  period: 'day' | 'week' | 'month' | 'all';
  startDate: Date;
  endDate: Date;

  // Aggregate metrics
  totalQueries: number;
  totalTokensRetrieved: number;
  totalTokensSaved: number;
  totalTokensEstimatedFull: number;

  // Cost metrics (in dollars)
  totalCostActual: number;
  totalCostSaved: number;
  savingsPercent: number;

  // F10c.6: Multiple comparison baselines
  /** Savings vs grep+read workflow (more realistic) */
  savingsPercentVsGrep: number;
  /** Estimated tokens for a grep+read workflow */
  grepReadBaseline: number;
  /** Quality-adjusted savings (savings * relevance) */
  qualityAdjustedSavings: number;

  // Quality metrics
  averageRelevance: number;
  usefulnessRate: number | null;

  // Breakdowns
  byDay: DailyStats[];
  byQueryType: Record<string, QueryTypeStats>;
  byProject: Record<string, ProjectStats>;
}

/**
 * Daily statistics for trend analysis.
 */
export interface DailyStats {
  date: string; // YYYY-MM-DD
  queries: number;
  tokensRetrieved: number;
  tokensSaved: number;
  costSaved: number;
  avgRelevance: number;
}

/**
 * Statistics broken down by query type.
 */
export interface QueryTypeStats {
  queryType: string;
  queries: number;
  avgTokens: number;
  avgSavings: number;
  avgRelevance: number;
}

/**
 * Statistics for a single project.
 */
export interface ProjectStats {
  projectId: string;
  projectName: string;
  queries: number;
  tokensSaved: number;
  costSaved: number;
}

/**
 * Token pricing configuration.
 */
export interface TokenPricing {
  inputTokens: number; // Price per 1k input tokens
  outputTokens: number; // Price per 1k output tokens
  modelId: string; // Which model this applies to
}

/**
 * Analytics configuration.
 */
export interface AnalyticsConfig {
  // Pricing
  pricing: TokenPricing;

  // Full context estimation
  estimationMethod: 'measured' | 'heuristic' | 'manual';
  fullContextSize?: number; // Manual override

  // Retention
  retentionDays: number; // How long to keep detailed logs
  aggregateAfterDays: number; // When to roll up to daily

  // Privacy
  logQueries: boolean; // Store actual query text
  anonymize: boolean; // Strip identifying info
}

/**
 * Full context size estimate for a project.
 */
export interface FullContextEstimate {
  projectId: string;
  measuredAt: Date;

  // What full context would include
  totalFiles: number;
  totalLines: number;
  totalTokens: number;

  // Breakdown by file type
  codeTokens: number;
  docTokens: number;
  configTokens: number;

  // Compression scenarios
  withSummaries: number; // Using file summaries
  withFiltering: number; // Excluding tests, etc.
  minimal: number; // Only entry points
}

/**
 * Query result for logging purposes.
 */
export interface QueryResult {
  items: Array<{ type?: string; [key: string]: unknown }>;
  totalTokens: number;
  averageRelevance: number;
  strategiesUsed: string[];
}

/**
 * Options for logging a query.
 */
export interface LogOptions {
  sessionId?: string;
  queryType?: 'context' | 'search' | 'decision' | 'entity';
  latencyMs?: number;
}

/**
 * Dashboard data for UI rendering.
 */
export interface DashboardData {
  summary: SummaryCard;
  savingsChart: ChartData;
  queryTypesChart: ChartData;
  relevanceChart: ChartData;
  recentQueries: RecentQueryItem[];
  projectComparison?: ProjectComparison[];
}

/**
 * Summary card for dashboard.
 */
export interface SummaryCard {
  totalQueries: number;
  tokensSaved: string; // Formatted with K/M suffix
  costSaved: string; // Formatted as currency
  savingsPercent: number;
  /** F10c.6: Savings vs grep+read (more realistic) */
  savingsPercentVsGrep: number;
  /** F10c.6: Quality-adjusted savings (savings * relevance) */
  qualityAdjustedSavings: number;
  avgRelevance: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

/**
 * Chart data for visualization.
 */
export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color?: string;
  }>;
}

/**
 * Recent query item for display.
 */
export interface RecentQueryItem {
  id: string;
  timestamp: string;
  query: string;
  tokensSaved: number;
  relevance: number;
  wasUseful?: boolean;
}

/**
 * Project comparison for cross-project analytics.
 */
export interface ProjectComparison {
  projectId: string;
  projectName: string;
  queries: number;
  tokensSaved: number;
  costSaved: number;
  avgRelevance: number;
}

/**
 * Analytics report for export.
 */
export interface AnalyticsReport {
  generatedAt: Date;
  period: 'week' | 'month';
  projectId: string;

  summary: {
    totalQueries: number;
    totalTokensSaved: number;
    totalCostSaved: number;
    savingsPercent: number;
    avgRelevance: number;
  };

  comparison?: {
    fullContextSize: number;
    avgRetrievedSize: number;
    compressionRatio: number;
  };

  dailyBreakdown: DailyStats[];
  queryTypeBreakdown: Record<string, QueryTypeStats>;
}

/**
 * Default analytics configuration.
 */
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  pricing: {
    inputTokens: 0.03, // $0.03 per 1k input tokens (GPT-4 pricing)
    outputTokens: 0.06,
    modelId: 'gpt-4'
  },
  estimationMethod: 'heuristic',
  retentionDays: 90,
  aggregateAfterDays: 7,
  logQueries: true,
  anonymize: false
};
