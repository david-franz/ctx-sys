/**
 * Dashboard service for analytics visualization.
 */

import { QueryLogger } from './query-logger';
import { FullContextEstimator } from './full-context-estimator';
import {
  DashboardData,
  SummaryCard,
  ChartData,
  RecentQueryItem,
  AnalyticsReport,
  UsageStats,
  DailyStats,
  QueryTypeStats
} from './types';

/**
 * Provides formatted data for analytics dashboards.
 */
export class DashboardService {
  constructor(
    private queryLogger: QueryLogger,
    private contextEstimator: FullContextEstimator
  ) {}

  /**
   * Get all dashboard data for rendering.
   */
  async getDashboardData(
    projectId: string,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<DashboardData> {
    const [currentStats, previousStats, recentLogs] = await Promise.all([
      this.queryLogger.getStats(projectId, period),
      this.queryLogger.getStats(projectId, this.getPreviousPeriod(period)),
      this.queryLogger.getRecentLogs(projectId, 10)
    ]);

    // Calculate trend
    const trend = this.calculateTrend(currentStats, previousStats);

    return {
      summary: {
        totalQueries: currentStats.totalQueries,
        tokensSaved: this.formatTokens(currentStats.totalTokensSaved),
        costSaved: this.formatCurrency(currentStats.totalCostSaved),
        savingsPercent: Math.round(currentStats.savingsPercent),
        avgRelevance: Math.round(currentStats.averageRelevance * 100) / 100,
        trend: trend.direction,
        trendValue: trend.value
      },

      savingsChart: {
        labels: currentStats.byDay.map(d => this.formatDate(d.date)),
        datasets: [
          {
            label: 'Tokens Retrieved',
            data: currentStats.byDay.map(d => d.tokensRetrieved),
            color: '#4CAF50'
          },
          {
            label: 'Tokens Saved',
            data: currentStats.byDay.map(d => d.tokensSaved),
            color: '#2196F3'
          }
        ]
      },

      queryTypesChart: {
        labels: Object.keys(currentStats.byQueryType),
        datasets: [{
          label: 'Queries',
          data: Object.values(currentStats.byQueryType).map(t => t.queries)
        }]
      },

      relevanceChart: {
        labels: currentStats.byDay.map(d => this.formatDate(d.date)),
        datasets: [{
          label: 'Average Relevance',
          data: currentStats.byDay.map(d => d.avgRelevance * 100),
          color: '#FF9800'
        }]
      },

      recentQueries: recentLogs.map(log => ({
        id: log.id,
        timestamp: this.formatTimestamp(log.timestamp),
        query: log.query?.substring(0, 50) || '[query not logged]',
        tokensSaved: log.tokensSaved,
        relevance: Math.round(log.relevanceScore * 100),
        wasUseful: log.wasUseful
      }))
    };
  }

  /**
   * Generate a report for export.
   */
  async generateReport(
    projectId: string,
    period: 'week' | 'month'
  ): Promise<AnalyticsReport> {
    const stats = await this.queryLogger.getStats(projectId, period);
    const estimate = await this.contextEstimator.getEstimate(projectId);

    return {
      generatedAt: new Date(),
      period,
      projectId,

      summary: {
        totalQueries: stats.totalQueries,
        totalTokensSaved: stats.totalTokensSaved,
        totalCostSaved: stats.totalCostSaved,
        savingsPercent: stats.savingsPercent,
        avgRelevance: stats.averageRelevance
      },

      comparison: estimate ? {
        fullContextSize: estimate.totalTokens,
        avgRetrievedSize: stats.totalQueries > 0
          ? Math.round(stats.totalTokensRetrieved / stats.totalQueries)
          : 0,
        compressionRatio: estimate.totalTokens > 0 && stats.totalQueries > 0
          ? (stats.totalTokensRetrieved / stats.totalQueries) / estimate.totalTokens
          : 0
      } : undefined,

      dailyBreakdown: stats.byDay,
      queryTypeBreakdown: stats.byQueryType
    };
  }

  /**
   * Get a summary for display in CLI or notifications.
   */
  async getQuickSummary(projectId: string): Promise<{
    queries: number;
    tokensSaved: string;
    costSaved: string;
    savings: string;
  }> {
    const stats = await this.queryLogger.getStats(projectId, 'week');

    return {
      queries: stats.totalQueries,
      tokensSaved: this.formatTokens(stats.totalTokensSaved),
      costSaved: this.formatCurrency(stats.totalCostSaved),
      savings: `${Math.round(stats.savingsPercent)}%`
    };
  }

  /**
   * Get the previous period for comparison.
   */
  private getPreviousPeriod(period: string): 'day' | 'week' | 'month' {
    // Return same period type for comparison
    return period as 'day' | 'week' | 'month';
  }

  /**
   * Calculate trend between current and previous periods.
   */
  private calculateTrend(
    current: UsageStats,
    previous: UsageStats
  ): { direction: 'up' | 'down' | 'stable'; value: number } {
    if (!previous.totalQueries) {
      return { direction: 'stable', value: 0 };
    }

    const currentAvgSavings = current.totalQueries > 0
      ? current.totalTokensSaved / current.totalQueries
      : 0;
    const previousAvgSavings = previous.totalQueries > 0
      ? previous.totalTokensSaved / previous.totalQueries
      : 0;

    const change = previousAvgSavings > 0
      ? ((currentAvgSavings - previousAvgSavings) / previousAvgSavings) * 100
      : 0;

    return {
      direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
      value: Math.abs(Math.round(change))
    };
  }

  /**
   * Format a token count with K/M suffix.
   */
  private formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  }

  /**
   * Format a currency amount.
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Format a date string for chart labels.
   */
  private formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
  }

  /**
   * Format a timestamp for display.
   */
  private formatTimestamp(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  }
}
