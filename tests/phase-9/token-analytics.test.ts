/**
 * Tests for F9.1 Token Analytics
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db';
import {
  QueryLogger,
  FullContextEstimator,
  DashboardService,
  QueryResult,
  DEFAULT_ANALYTICS_CONFIG
} from '../../src/analytics';

const PROJECT_ID = 'test-analytics-project';

describe('F9.1 Token Analytics', () => {
  let db: DatabaseConnection;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary database
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-analytics-'));
    const dbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(dbPath);
    await db.initialize();
    db.createProject(PROJECT_ID);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('QueryLogger', () => {
    let logger: QueryLogger;

    beforeEach(() => {
      logger = new QueryLogger(db);
      logger.ensureTablesExist();
    });

    describe('logQuery', () => {
      it('should log a query with token metrics', async () => {
        const result: QueryResult = {
          items: [{ type: 'function' }, { type: 'class' }],
          totalTokens: 5000,
          averageRelevance: 0.8,
          strategiesUsed: ['semantic', 'keyword']
        };

        const log = await logger.logQuery(PROJECT_ID, 'test query', result);

        expect(log.id).toMatch(/^qlog_/);
        expect(log.projectId).toBe(PROJECT_ID);
        expect(log.tokensRetrieved).toBe(5000);
        expect(log.relevanceScore).toBe(0.8);
        expect(log.itemCount).toBe(2);
        expect(log.retrievalStrategies).toEqual(['semantic', 'keyword']);
      });

      it('should calculate token savings correctly', async () => {
        const result: QueryResult = {
          items: [],
          totalTokens: 5000,
          averageRelevance: 0.8,
          strategiesUsed: ['semantic']
        };

        const log = await logger.logQuery(PROJECT_ID, 'test query', result);

        expect(log.tokensRetrieved).toBe(5000);
        expect(log.tokensEstimatedFull).toBe(100000); // Default estimate
        expect(log.tokensSaved).toBe(95000);
      });

      it('should calculate cost savings', async () => {
        const result: QueryResult = {
          items: [],
          totalTokens: 5000,
          averageRelevance: 0.8,
          strategiesUsed: []
        };

        const log = await logger.logQuery(PROJECT_ID, 'test query', result);

        // At $0.03/1k tokens
        expect(log.costActual).toBeCloseTo(0.15, 2);
        expect(log.costEstimatedFull).toBeCloseTo(3.0, 2);
        expect(log.costSaved).toBeCloseTo(2.85, 2);
      });

      it('should count items by type', async () => {
        const result: QueryResult = {
          items: [
            { type: 'function' },
            { type: 'function' },
            { type: 'class' },
            { type: 'method' }
          ],
          totalTokens: 1000,
          averageRelevance: 0.7,
          strategiesUsed: []
        };

        const log = await logger.logQuery(PROJECT_ID, 'test', result);

        expect(log.itemTypes).toEqual({
          function: 2,
          class: 1,
          method: 1
        });
      });

      it('should respect privacy settings for query logging', async () => {
        const privateLogger = new QueryLogger(db, { logQueries: false });
        privateLogger.ensureTablesExist();

        const result: QueryResult = {
          items: [],
          totalTokens: 1000,
          averageRelevance: 0.5,
          strategiesUsed: []
        };

        const log = await privateLogger.logQuery(PROJECT_ID, 'sensitive query', result);

        expect(log.query).toBeUndefined();
      });
    });

    describe('recordFeedback', () => {
      it('should record positive feedback', async () => {
        const result: QueryResult = {
          items: [],
          totalTokens: 1000,
          averageRelevance: 0.5,
          strategiesUsed: []
        };

        const log = await logger.logQuery(PROJECT_ID, 'test', result);
        await logger.recordFeedback(log.id, true);

        const retrieved = (await logger.getRecentLogs(PROJECT_ID, 1))[0];
        expect(retrieved.wasUseful).toBe(true);
      });

      it('should record negative feedback', async () => {
        const result: QueryResult = {
          items: [],
          totalTokens: 1000,
          averageRelevance: 0.5,
          strategiesUsed: []
        };

        const log = await logger.logQuery(PROJECT_ID, 'test', result);
        await logger.recordFeedback(log.id, false);

        const retrieved = (await logger.getRecentLogs(PROJECT_ID, 1))[0];
        expect(retrieved.wasUseful).toBe(false);
      });
    });

    describe('getStats', () => {
      it('should aggregate stats correctly', async () => {
        // Log several queries
        for (let i = 0; i < 10; i++) {
          await logger.logQuery(PROJECT_ID, `query ${i}`, {
            items: [],
            totalTokens: 5000 + i * 100,
            averageRelevance: 0.7 + i * 0.02,
            strategiesUsed: []
          });
        }

        const stats = await logger.getStats(PROJECT_ID, 'day');

        expect(stats.totalQueries).toBe(10);
        expect(stats.totalTokensRetrieved).toBe(54500); // Sum of 5000+5100+...+5900
      });

      it('should calculate savings percent', async () => {
        await logger.logQuery(PROJECT_ID, 'test', {
          items: [],
          totalTokens: 10000,
          averageRelevance: 0.5,
          strategiesUsed: []
        });

        const stats = await logger.getStats(PROJECT_ID, 'day');

        // 10000 retrieved out of 100000 full = 90% savings
        expect(stats.savingsPercent).toBe(90);
      });

      it('should track usefulness rate', async () => {
        for (let i = 0; i < 4; i++) {
          const log = await logger.logQuery(PROJECT_ID, `q${i}`, {
            items: [],
            totalTokens: 1000,
            averageRelevance: 0.5,
            strategiesUsed: []
          });
          // 3 useful, 1 not useful = 75% usefulness
          await logger.recordFeedback(log.id, i < 3);
        }

        const stats = await logger.getStats(PROJECT_ID, 'day');

        expect(stats.usefulnessRate).toBe(75);
      });

      it('should break down by query type', async () => {
        await logger.logQuery(PROJECT_ID, 'q1', {
          items: [],
          totalTokens: 1000,
          averageRelevance: 0.8,
          strategiesUsed: []
        }, { queryType: 'context' });

        await logger.logQuery(PROJECT_ID, 'q2', {
          items: [],
          totalTokens: 2000,
          averageRelevance: 0.6,
          strategiesUsed: []
        }, { queryType: 'search' });

        await logger.logQuery(PROJECT_ID, 'q3', {
          items: [],
          totalTokens: 1500,
          averageRelevance: 0.7,
          strategiesUsed: []
        }, { queryType: 'context' });

        const stats = await logger.getStats(PROJECT_ID, 'day');

        expect(stats.byQueryType.context.queries).toBe(2);
        expect(stats.byQueryType.search.queries).toBe(1);
        expect(stats.byQueryType.context.avgTokens).toBe(1250);
      });
    });

    describe('getRecentLogs', () => {
      it('should return logs with valid data', async () => {
        for (let i = 0; i < 5; i++) {
          await logger.logQuery(PROJECT_ID, `query ${i}`, {
            items: [],
            totalTokens: 1000 * (i + 1),
            averageRelevance: 0.5,
            strategiesUsed: []
          });
        }

        const logs = await logger.getRecentLogs(PROJECT_ID, 3);

        expect(logs).toHaveLength(3);
        // All logs should have valid data
        for (const log of logs) {
          expect(log.id).toMatch(/^qlog_/);
          expect(log.projectId).toBe(PROJECT_ID);
          expect(log.tokensRetrieved).toBeGreaterThan(0);
          expect(log.timestamp).toBeInstanceOf(Date);
        }
      });

      it('should respect limit parameter', async () => {
        for (let i = 0; i < 10; i++) {
          await logger.logQuery(PROJECT_ID, `query ${i}`, {
            items: [],
            totalTokens: 1000,
            averageRelevance: 0.5,
            strategiesUsed: []
          });
        }

        const logs = await logger.getRecentLogs(PROJECT_ID, 5);
        expect(logs).toHaveLength(5);
      });
    });

    describe('configuration', () => {
      it('should use default config', () => {
        const config = logger.getConfig();
        expect(config.pricing.inputTokens).toBe(0.03);
        expect(config.retentionDays).toBe(90);
      });

      it('should allow config updates', () => {
        logger.updateConfig({ retentionDays: 30 });
        const config = logger.getConfig();
        expect(config.retentionDays).toBe(30);
      });
    });
  });

  describe('FullContextEstimator', () => {
    let estimator: FullContextEstimator;
    let projectDir: string;

    beforeEach(() => {
      estimator = new FullContextEstimator(db);
      estimator.ensureTableExists();

      // Create a test project directory
      projectDir = path.join(testDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });
    });

    describe('measureProject', () => {
      it('should count files and tokens', async () => {
        // Create test files
        fs.writeFileSync(
          path.join(projectDir, 'file1.ts'),
          'export function hello() { return "world"; }'
        );
        fs.writeFileSync(
          path.join(projectDir, 'file2.ts'),
          'export const value = 42;'
        );

        const estimate = await estimator.measureProject(PROJECT_ID, projectDir);

        expect(estimate.totalFiles).toBe(2);
        expect(estimate.totalTokens).toBeGreaterThan(0);
        expect(estimate.codeTokens).toBeGreaterThan(0);
      });

      it('should categorize by file type', async () => {
        // Create different file types
        fs.writeFileSync(
          path.join(projectDir, 'code.ts'),
          'export function test() { return true; }'
        );
        fs.writeFileSync(
          path.join(projectDir, 'README.md'),
          '# Test Project\n\nThis is a test.'
        );
        fs.writeFileSync(
          path.join(projectDir, 'config.json'),
          '{"name": "test"}'
        );

        const estimate = await estimator.measureProject(PROJECT_ID, projectDir);

        expect(estimate.codeTokens).toBeGreaterThan(0);
        expect(estimate.docTokens).toBeGreaterThan(0);
        expect(estimate.configTokens).toBeGreaterThan(0);
      });

      it('should calculate compression scenarios', async () => {
        fs.writeFileSync(
          path.join(projectDir, 'large.ts'),
          'const x = 1;\n'.repeat(100)
        );

        const estimate = await estimator.measureProject(PROJECT_ID, projectDir);

        // withSummaries should be ~15% of total
        expect(estimate.withSummaries).toBeLessThan(estimate.totalTokens);
        expect(estimate.withSummaries).toBeCloseTo(estimate.totalTokens * 0.15, -1);

        // minimal should be ~5% of total
        expect(estimate.minimal).toBeLessThan(estimate.withSummaries);
      });

      it('should ignore node_modules', async () => {
        // Create main file
        fs.writeFileSync(path.join(projectDir, 'index.ts'), 'console.log("main");');

        // Create node_modules with files
        const nodeModules = path.join(projectDir, 'node_modules', 'pkg');
        fs.mkdirSync(nodeModules, { recursive: true });
        fs.writeFileSync(
          path.join(nodeModules, 'index.js'),
          'module.exports = {};'
        );

        const estimate = await estimator.measureProject(PROJECT_ID, projectDir);

        // Should only count the main file
        expect(estimate.totalFiles).toBe(1);
      });

      it('should skip binary files', async () => {
        fs.writeFileSync(path.join(projectDir, 'code.ts'), 'const x = 1;');
        fs.writeFileSync(path.join(projectDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4E, 0x47]));

        const estimate = await estimator.measureProject(PROJECT_ID, projectDir);

        expect(estimate.totalFiles).toBe(1);
      });
    });

    describe('getEstimate', () => {
      it('should retrieve stored estimate', async () => {
        fs.writeFileSync(path.join(projectDir, 'code.ts'), 'const x = 1;');

        const measured = await estimator.measureProject(PROJECT_ID, projectDir);
        const retrieved = await estimator.getEstimate(PROJECT_ID);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.totalFiles).toBe(measured.totalFiles);
        expect(retrieved!.totalTokens).toBe(measured.totalTokens);
      });

      it('should return null for unknown project', async () => {
        const estimate = await estimator.getEstimate('unknown-project');
        expect(estimate).toBeNull();
      });
    });

    describe('hasRecentEstimate', () => {
      it('should return true for fresh estimate', async () => {
        fs.writeFileSync(path.join(projectDir, 'code.ts'), 'const x = 1;');
        await estimator.measureProject(PROJECT_ID, projectDir);

        const hasRecent = await estimator.hasRecentEstimate(PROJECT_ID);
        expect(hasRecent).toBe(true);
      });

      it('should return false for stale estimate', async () => {
        fs.writeFileSync(path.join(projectDir, 'code.ts'), 'const x = 1;');
        await estimator.measureProject(PROJECT_ID, projectDir);

        // Wait a bit then check with very short max age
        await new Promise(resolve => setTimeout(resolve, 10));
        const hasRecent = await estimator.hasRecentEstimate(PROJECT_ID, 5);
        expect(hasRecent).toBe(false);
      });
    });
  });

  describe('DashboardService', () => {
    let logger: QueryLogger;
    let estimator: FullContextEstimator;
    let dashboard: DashboardService;

    beforeEach(() => {
      logger = new QueryLogger(db);
      logger.ensureTablesExist();
      estimator = new FullContextEstimator(db);
      estimator.ensureTableExists();
      dashboard = new DashboardService(logger, estimator);
    });

    describe('getDashboardData', () => {
      it('should return formatted dashboard data', async () => {
        // Log some queries
        for (let i = 0; i < 5; i++) {
          await logger.logQuery(PROJECT_ID, `query ${i}`, {
            items: [],
            totalTokens: 5000,
            averageRelevance: 0.8,
            strategiesUsed: []
          });
        }

        const data = await dashboard.getDashboardData(PROJECT_ID, 'week');

        expect(data.summary.totalQueries).toBe(5);
        expect(data.summary.tokensSaved).toContain('K'); // Should be formatted
        expect(data.summary.costSaved).toContain('$');
        expect(data.summary.savingsPercent).toBe(95);
        expect(data.recentQueries).toHaveLength(5);
      });

      it('should include chart data', async () => {
        await logger.logQuery(PROJECT_ID, 'test', {
          items: [],
          totalTokens: 5000,
          averageRelevance: 0.8,
          strategiesUsed: []
        });

        const data = await dashboard.getDashboardData(PROJECT_ID);

        expect(data.savingsChart.labels).toBeDefined();
        expect(data.savingsChart.datasets).toHaveLength(2);
        expect(data.queryTypesChart).toBeDefined();
        expect(data.relevanceChart).toBeDefined();
      });

      it('should calculate trend', async () => {
        // Log queries with consistent savings
        for (let i = 0; i < 3; i++) {
          await logger.logQuery(PROJECT_ID, `query ${i}`, {
            items: [],
            totalTokens: 5000,
            averageRelevance: 0.8,
            strategiesUsed: []
          });
        }

        const data = await dashboard.getDashboardData(PROJECT_ID);

        expect(['up', 'down', 'stable']).toContain(data.summary.trend);
        expect(typeof data.summary.trendValue).toBe('number');
      });
    });

    describe('generateReport', () => {
      it('should generate exportable report', async () => {
        // Set up estimate
        const projectDir = path.join(testDir, 'report-project');
        fs.mkdirSync(projectDir);
        fs.writeFileSync(path.join(projectDir, 'code.ts'), 'const x = 1;'.repeat(100));
        await estimator.measureProject(PROJECT_ID, projectDir);

        // Log queries
        for (let i = 0; i < 5; i++) {
          await logger.logQuery(PROJECT_ID, `query ${i}`, {
            items: [],
            totalTokens: 1000,
            averageRelevance: 0.7,
            strategiesUsed: []
          });
        }

        const report = await dashboard.generateReport(PROJECT_ID, 'week');

        expect(report.period).toBe('week');
        expect(report.projectId).toBe(PROJECT_ID);
        expect(report.summary.totalQueries).toBe(5);
        expect(report.comparison).toBeDefined();
        expect(report.comparison!.fullContextSize).toBeGreaterThan(0);
      });
    });

    describe('getQuickSummary', () => {
      it('should return formatted summary', async () => {
        await logger.logQuery(PROJECT_ID, 'test', {
          items: [],
          totalTokens: 5000,
          averageRelevance: 0.8,
          strategiesUsed: []
        });

        const summary = await dashboard.getQuickSummary(PROJECT_ID);

        expect(summary.queries).toBe(1);
        expect(summary.tokensSaved).toBeDefined();
        expect(summary.costSaved).toContain('$');
        expect(summary.savings).toContain('%');
      });
    });
  });

  describe('Integration', () => {
    it('should provide accurate ROI metrics', async () => {
      const logger = new QueryLogger(db);
      logger.ensureTablesExist();
      const estimator = new FullContextEstimator(db);
      estimator.ensureTableExists();

      // Create project files
      const projectDir = path.join(testDir, 'roi-project');
      fs.mkdirSync(projectDir);
      // Create ~10000 tokens worth of content
      fs.writeFileSync(
        path.join(projectDir, 'main.ts'),
        '// Code comment\n'.repeat(2500)
      );

      // Measure project
      await estimator.measureProject(PROJECT_ID, projectDir);

      // Log some queries retrieving small amounts
      for (let i = 0; i < 5; i++) {
        await logger.logQuery(PROJECT_ID, `query ${i}`, {
          items: [],
          totalTokens: 500, // Much less than full context
          averageRelevance: 0.8,
          strategiesUsed: ['semantic']
        });
      }

      const stats = await logger.getStats(PROJECT_ID, 'day');

      // Verify significant savings
      expect(stats.savingsPercent).toBeGreaterThan(50);
      expect(stats.totalTokensSaved).toBeGreaterThan(stats.totalTokensRetrieved);
    });
  });
});
