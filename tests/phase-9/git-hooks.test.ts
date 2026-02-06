/**
 * Tests for F9.2 Git Hooks
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { DatabaseConnection } from '../../src/db';
import {
  HookInstaller,
  HookHandler,
  ImpactAnalyzer,
  HookEvent,
  DEFAULT_HOOK_CONFIG
} from '../../src/hooks';

const PROJECT_ID = 'test-hooks-project';

describe('F9.2 Git Hooks', () => {
  let testDir: string;
  let db: DatabaseConnection;

  beforeEach(async () => {
    // Create temporary directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-hooks-'));
    const dbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(dbPath);
    await db.initialize();
    db.createProject(PROJECT_ID);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('HookInstaller', () => {
    let installer: HookInstaller;
    let repoPath: string;

    beforeEach(() => {
      installer = new HookInstaller();
      // Create a temporary git repository
      repoPath = path.join(testDir, 'repo');
      fs.mkdirSync(repoPath);
      execSync('git init', { cwd: repoPath, stdio: 'ignore' });
    });

    describe('install', () => {
      it('should install hooks successfully', async () => {
        const result = await installer.install(repoPath, {
          enablePreCommit: true,
          enablePostMerge: true,
          projectId: PROJECT_ID
        });

        expect(result.success).toBe(true);
        expect(result.installed).toContain('pre-commit');
        expect(result.installed).toContain('post-merge');
      });

      it('should make hooks executable', async () => {
        await installer.install(repoPath, {
          enablePreCommit: true,
          projectId: PROJECT_ID
        });

        const hookPath = path.join(repoPath, '.git', 'hooks', 'pre-commit');
        const stats = fs.statSync(hookPath);
        // Check executable bit is set
        expect(stats.mode & 0o111).toBeTruthy();
      });

      it('should save config file', async () => {
        const result = await installer.install(repoPath, {
          enablePreCommit: true,
          projectId: PROJECT_ID
        });

        expect(result.configPath).toContain('hooks.json');
        expect(fs.existsSync(result.configPath)).toBe(true);

        const savedConfig = JSON.parse(fs.readFileSync(result.configPath, 'utf-8'));
        expect(savedConfig.projectId).toBe(PROJECT_ID);
        expect(savedConfig.enablePreCommit).toBe(true);
      });

      it('should backup existing hooks', async () => {
        const hookPath = path.join(repoPath, '.git', 'hooks', 'pre-commit');
        fs.writeFileSync(hookPath, '#!/bin/bash\necho "existing hook"');

        await installer.install(repoPath, { enablePreCommit: true });

        const backupPath = `${hookPath}.pre-ctx-sys`;
        expect(fs.existsSync(backupPath)).toBe(true);
        const backup = fs.readFileSync(backupPath, 'utf-8');
        expect(backup).toContain('existing hook');
      });

      it('should not overwrite ctx-sys hooks', async () => {
        // Install once
        await installer.install(repoPath, { enablePreCommit: true, projectId: 'project1' });

        // Install again with different config
        await installer.install(repoPath, { enablePreCommit: true, projectId: 'project2' });

        // Should not have backup of ctx-sys hook
        const backupPath = path.join(repoPath, '.git', 'hooks', 'pre-commit.pre-ctx-sys');
        // If backup exists, it shouldn't contain ctx-sys marker
        if (fs.existsSync(backupPath)) {
          const content = fs.readFileSync(backupPath, 'utf-8');
          expect(content).not.toContain('ctx-sys-hook');
        }
      });

      it('should throw for non-git directory', async () => {
        const nonGitDir = path.join(testDir, 'not-git');
        fs.mkdirSync(nonGitDir);

        await expect(installer.install(nonGitDir)).rejects.toThrow('Not a git repository');
      });
    });

    describe('uninstall', () => {
      it('should remove ctx-sys hooks', async () => {
        await installer.install(repoPath, { enablePreCommit: true });

        await installer.uninstall(repoPath);

        const hookPath = path.join(repoPath, '.git', 'hooks', 'pre-commit');
        expect(fs.existsSync(hookPath)).toBe(false);
      });

      it('should restore backed up hooks', async () => {
        const hookPath = path.join(repoPath, '.git', 'hooks', 'pre-commit');
        const originalContent = '#!/bin/bash\necho "original"';
        fs.writeFileSync(hookPath, originalContent);

        await installer.install(repoPath, { enablePreCommit: true });
        await installer.uninstall(repoPath);

        const restored = fs.readFileSync(hookPath, 'utf-8');
        expect(restored).toBe(originalContent);
      });

      it('should not remove non-ctx-sys hooks', async () => {
        const hookPath = path.join(repoPath, '.git', 'hooks', 'pre-commit');
        fs.writeFileSync(hookPath, '#!/bin/bash\necho "other hook"');

        await installer.uninstall(repoPath);

        expect(fs.existsSync(hookPath)).toBe(true);
      });
    });

    describe('isInstalled', () => {
      it('should return true when hooks are installed', async () => {
        await installer.install(repoPath, { enablePreCommit: true });

        expect(installer.isInstalled(repoPath)).toBe(true);
      });

      it('should return false when hooks are not installed', () => {
        expect(installer.isInstalled(repoPath)).toBe(false);
      });
    });

    describe('getConfig', () => {
      it('should return saved configuration', async () => {
        await installer.install(repoPath, {
          enablePreCommit: true,
          enablePostMerge: false,
          asyncMode: true,
          projectId: PROJECT_ID
        });

        const config = installer.getConfig(repoPath);

        expect(config).not.toBeNull();
        expect(config!.enablePreCommit).toBe(true);
        expect(config!.enablePostMerge).toBe(false);
        expect(config!.asyncMode).toBe(true);
      });

      it('should return null when not installed', () => {
        expect(installer.getConfig(repoPath)).toBeNull();
      });
    });
  });

  describe('HookHandler', () => {
    let handler: HookHandler;
    let repoPath: string;

    beforeEach(() => {
      handler = new HookHandler(db, { projectId: PROJECT_ID });
      handler.ensureTablesExist();

      // Create a test git repo with some commits
      repoPath = path.join(testDir, 'repo');
      fs.mkdirSync(repoPath);
      execSync('git init', { cwd: repoPath, stdio: 'ignore' });
      execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: 'ignore' });
      execSync('git config user.name "Test User"', { cwd: repoPath, stdio: 'ignore' });
      fs.writeFileSync(path.join(repoPath, 'initial.txt'), 'initial content');
      execSync('git add . && git commit -m "initial"', { cwd: repoPath, stdio: 'ignore' });
    });

    describe('handle', () => {
      it('should handle pre-commit hook', async () => {
        // Stage a file
        fs.writeFileSync(path.join(repoPath, 'test.ts'), 'export const x = 1;');
        execSync('git add test.ts', { cwd: repoPath, stdio: 'ignore' });

        const result = await handler.handle({
          type: 'pre-commit',
          timestamp: new Date(),
          repository: repoPath,
          currentBranch: 'main',
          currentCommit: 'HEAD',
          stagedFiles: ['test.ts']
        });

        expect(result.success).toBe(true);
        expect(result.filesIndexed).toBe(1);
      });

      it('should skip indexing when too many files', async () => {
        const manyFiles = Array.from({ length: 150 }, (_, i) => `file${i}.ts`);

        const result = await handler.handle({
          type: 'pre-commit',
          timestamp: new Date(),
          repository: repoPath,
          currentBranch: 'main',
          currentCommit: 'HEAD',
          stagedFiles: manyFiles
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain('Too many files');
        expect(result.warnings).toHaveLength(1);
      });

      it('should handle post-merge hook', async () => {
        const result = await handler.handle({
          type: 'post-merge',
          timestamp: new Date(),
          repository: repoPath,
          currentBranch: 'main',
          currentCommit: 'HEAD',
          previousCommit: 'HEAD~1',
          mergedFiles: ['merged.ts']
        });

        expect(result.success).toBe(true);
        expect(result.impactReport).toBeDefined();
      });

      it('should handle pre-push hook with validation disabled', async () => {
        const result = await handler.handle({
          type: 'pre-push',
          timestamp: new Date(),
          repository: repoPath,
          currentBranch: 'main',
          currentCommit: 'HEAD'
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain('disabled');
      });

      it('should handle post-checkout hook', async () => {
        const result = await handler.handle({
          type: 'post-checkout',
          timestamp: new Date(),
          repository: repoPath,
          currentBranch: 'feature',
          currentCommit: 'abc123',
          previousCommit: 'def456'
        });

        expect(result.success).toBe(true);
      });

      it('should skip file checkout (no branch switch)', async () => {
        const result = await handler.handle({
          type: 'post-checkout',
          timestamp: new Date(),
          repository: repoPath,
          currentBranch: 'main',
          currentCommit: 'abc123',
          previousCommit: 'abc123' // Same commit
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain('File checkout');
      });
    });

    describe('getStagedFiles', () => {
      it('should return staged files', () => {
        fs.writeFileSync(path.join(repoPath, 'staged.ts'), 'const x = 1;');
        execSync('git add staged.ts', { cwd: repoPath, stdio: 'ignore' });

        const files = handler.getStagedFiles(repoPath);

        expect(files).toContain('staged.ts');
      });

      it('should return empty array for no staged files', () => {
        const files = handler.getStagedFiles(repoPath);
        expect(files).toEqual([]);
      });
    });

    describe('getRecentExecutions', () => {
      it('should return logged executions', async () => {
        // Trigger some hooks
        await handler.handle({
          type: 'pre-commit',
          timestamp: new Date(),
          repository: repoPath,
          currentBranch: 'main',
          currentCommit: 'HEAD',
          stagedFiles: ['test.ts']
        });

        const executions = await handler.getRecentExecutions(PROJECT_ID);

        expect(executions).toHaveLength(1);
        expect(executions[0].hookType).toBe('pre-commit');
        expect(executions[0].success).toBe(true);
      });

      it('should filter by hook type', async () => {
        await handler.handle({
          type: 'pre-commit',
          timestamp: new Date(),
          repository: repoPath,
          currentBranch: 'main',
          currentCommit: 'HEAD'
        });

        await handler.handle({
          type: 'post-merge',
          timestamp: new Date(),
          repository: repoPath,
          currentBranch: 'main',
          currentCommit: 'HEAD'
        });

        const preCommitOnly = await handler.getRecentExecutions(PROJECT_ID, 'pre-commit');
        expect(preCommitOnly).toHaveLength(1);
        expect(preCommitOnly[0].hookType).toBe('pre-commit');
      });
    });

    describe('configuration', () => {
      it('should use provided config', () => {
        const config = handler.getConfig();
        expect(config.projectId).toBe(PROJECT_ID);
      });

      it('should allow config updates', () => {
        handler.updateConfig({ asyncMode: true, maxFilesToIndex: 50 });
        const config = handler.getConfig();
        expect(config.asyncMode).toBe(true);
        expect(config.maxFilesToIndex).toBe(50);
      });
    });
  });

  describe('ImpactAnalyzer', () => {
    let analyzer: ImpactAnalyzer;
    let repoPath: string;

    beforeEach(() => {
      analyzer = new ImpactAnalyzer();

      // Create a test git repo with branches
      repoPath = path.join(testDir, 'impact-repo');
      fs.mkdirSync(repoPath);
      execSync('git init', { cwd: repoPath, stdio: 'ignore' });
      execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: 'ignore' });
      execSync('git config user.name "Test User"', { cwd: repoPath, stdio: 'ignore' });

      // Create initial commit on main
      fs.writeFileSync(path.join(repoPath, 'main.ts'), 'export const main = true;');
      execSync('git add . && git commit -m "initial"', { cwd: repoPath, stdio: 'ignore' });
    });

    describe('getChangedFiles', () => {
      it('should detect added files', () => {
        // Create feature branch with new file
        execSync('git checkout -b feature', { cwd: repoPath, stdio: 'ignore' });
        fs.writeFileSync(path.join(repoPath, 'new.ts'), 'export const x = 1;');
        execSync('git add . && git commit -m "add new file"', { cwd: repoPath, stdio: 'ignore' });

        const changes = analyzer.getChangedFiles(repoPath, 'main', 'feature');

        expect(changes.added).toContain('new.ts');
        expect(changes.modified).toHaveLength(0);
        expect(changes.deleted).toHaveLength(0);
      });

      it('should detect modified files', () => {
        execSync('git checkout -b feature', { cwd: repoPath, stdio: 'ignore' });
        fs.writeFileSync(path.join(repoPath, 'main.ts'), 'export const main = false;');
        execSync('git add . && git commit -m "modify main"', { cwd: repoPath, stdio: 'ignore' });

        const changes = analyzer.getChangedFiles(repoPath, 'main', 'feature');

        expect(changes.modified).toContain('main.ts');
      });

      it('should detect deleted files', () => {
        execSync('git checkout -b feature', { cwd: repoPath, stdio: 'ignore' });
        fs.unlinkSync(path.join(repoPath, 'main.ts'));
        execSync('git add . && git commit -m "delete main"', { cwd: repoPath, stdio: 'ignore' });

        const changes = analyzer.getChangedFiles(repoPath, 'main', 'feature');

        expect(changes.deleted).toContain('main.ts');
      });
    });

    describe('analyze', () => {
      it('should generate impact report', async () => {
        // Create feature branch with changes
        execSync('git checkout -b feature', { cwd: repoPath, stdio: 'ignore' });
        fs.writeFileSync(path.join(repoPath, 'feature.ts'), 'export const feature = true;');
        fs.writeFileSync(path.join(repoPath, 'main.ts'), 'export const main = false;');
        execSync('git add . && git commit -m "feature work"', { cwd: repoPath, stdio: 'ignore' });

        const report = await analyzer.analyze({
          projectId: PROJECT_ID,
          baseBranch: 'main',
          targetBranch: 'feature',
          repoPath
        });

        expect(report.baseBranch).toBe('main');
        expect(report.targetBranch).toBe('feature');
        expect(report.filesAdded).toContain('feature.ts');
        expect(report.filesModified).toContain('main.ts');
        expect(report.riskLevel).toBeDefined();
      });
    });

    describe('assessRisk', () => {
      it('should assess low risk for small changes', () => {
        const { riskLevel, reasons } = analyzer.assessRisk(
          { added: ['one.ts'], modified: [], deleted: [] },
          [],
          []
        );

        expect(riskLevel).toBe('low');
        expect(reasons).toHaveLength(0);
      });

      it('should assess medium risk for file deletions', () => {
        const { riskLevel, reasons } = analyzer.assessRisk(
          { added: [], modified: [], deleted: ['auth.ts', 'user.ts', 'api.ts'] },
          [],
          []
        );

        expect(riskLevel).toBe('medium');
        expect(reasons.some(r => r.includes('deleted'))).toBe(true);
      });

      it('should assess high risk for many changes', () => {
        const manyFiles = Array.from({ length: 20 }, (_, i) => `file${i}.ts`);
        const manyEntities = manyFiles.map((f, i) => ({
          entityId: `e${i}`,
          name: `Entity${i}`,
          type: 'class',
          filePath: f,
          changeType: 'modified' as const,
          usageCount: 10 // High usage
        }));

        const { riskLevel } = analyzer.assessRisk(
          { added: [], modified: manyFiles, deleted: [] },
          manyEntities,
          []
        );

        expect(riskLevel).toBe('high');
      });
    });

    describe('generateSuggestions', () => {
      it('should suggest reviewing widely-used entities', () => {
        const suggestions = analyzer.generateSuggestions(
          { added: [], modified: ['auth.ts'], deleted: [] },
          [{
            entityId: 'e1',
            name: 'authenticate',
            type: 'function',
            filePath: 'auth.ts',
            changeType: 'modified',
            usageCount: 15
          }],
          []
        );

        expect(suggestions.some(s => s.includes('widely-used'))).toBe(true);
      });

      it('should suggest verifying deleted entities', () => {
        const suggestions = analyzer.generateSuggestions(
          { added: [], modified: [], deleted: ['old.ts'] },
          [{
            entityId: 'e1',
            name: 'OldClass',
            type: 'class',
            filePath: 'old.ts',
            changeType: 'deleted',
            usageCount: 3
          }],
          []
        );

        expect(suggestions.some(s => s.includes('deleted'))).toBe(true);
      });

      it('should suggest splitting large PRs', () => {
        const manyFiles = Array.from({ length: 25 }, (_, i) => `file${i}.ts`);

        const suggestions = analyzer.generateSuggestions(
          { added: manyFiles, modified: [], deleted: [] },
          [],
          []
        );

        expect(suggestions.some(s => s.includes('splitting'))).toBe(true);
      });

      it('should suggest adding tests for new code', () => {
        const suggestions = analyzer.generateSuggestions(
          { added: ['feature.ts', 'utils.ts'], modified: [], deleted: [] },
          [],
          []
        );

        expect(suggestions.some(s => s.includes('tests'))).toBe(true);
      });
    });
  });

  describe('Integration', () => {
    it('should install hooks, handle events, and log executions', async () => {
      const installer = new HookInstaller();
      const repoPath = path.join(testDir, 'integration-repo');
      fs.mkdirSync(repoPath);
      execSync('git init', { cwd: repoPath, stdio: 'ignore' });
      execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: 'ignore' });
      execSync('git config user.name "Test"', { cwd: repoPath, stdio: 'ignore' });

      // Install hooks
      const installResult = await installer.install(repoPath, {
        enablePreCommit: true,
        projectId: PROJECT_ID
      });
      expect(installResult.success).toBe(true);

      // Create handler
      const handler = new HookHandler(db, { projectId: PROJECT_ID });
      handler.ensureTablesExist();

      // Stage a file and handle pre-commit
      fs.writeFileSync(path.join(repoPath, 'test.ts'), 'const x = 1;');
      execSync('git add test.ts', { cwd: repoPath, stdio: 'ignore' });

      const hookResult = await handler.handle({
        type: 'pre-commit',
        timestamp: new Date(),
        repository: repoPath,
        currentBranch: 'main',
        currentCommit: 'HEAD',
        stagedFiles: ['test.ts']
      });

      expect(hookResult.success).toBe(true);

      // Verify execution was logged
      const executions = await handler.getRecentExecutions(PROJECT_ID);
      expect(executions.length).toBeGreaterThan(0);
      expect(executions[0].hookType).toBe('pre-commit');
    });
  });
});
