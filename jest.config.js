/** @type {import('jest').Config} */

// Base configuration shared by all projects (project-level options only)
const baseProjectConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  }
};

module.exports = {
  // Root-level options
  testTimeout: 10000,
  verbose: true,
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/cli/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Projects allow running subsets of tests
  projects: [
    // Phase 1 projects
    {
      ...baseProjectConfig,
      displayName: 'F1.1',
      testMatch: ['<rootDir>/tests/phase-1/F1.1-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F1.2',
      testMatch: ['<rootDir>/tests/phase-1/F1.2-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F1.3',
      testMatch: ['<rootDir>/tests/phase-1/F1.3-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F1.4',
      testMatch: ['<rootDir>/tests/phase-1/F1.4-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F1.5',
      testMatch: ['<rootDir>/tests/phase-1/F1.5-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'phase-1',
      testMatch: ['<rootDir>/tests/phase-1/**/*.test.ts']
    },

    // Phase 2 projects
    {
      ...baseProjectConfig,
      displayName: 'F2.1',
      testMatch: ['<rootDir>/tests/phase-2/F2.1-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F2.2',
      testMatch: ['<rootDir>/tests/phase-2/F2.2-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F2.3',
      testMatch: ['<rootDir>/tests/phase-2/F2.3-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F2.4',
      testMatch: ['<rootDir>/tests/phase-2/F2.4-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F2.5',
      testMatch: ['<rootDir>/tests/phase-2/F2.5-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'phase-2',
      testMatch: ['<rootDir>/tests/phase-2/**/*.test.ts']
    },

    // Phase 3 projects
    {
      ...baseProjectConfig,
      displayName: 'F3.1',
      testMatch: ['<rootDir>/tests/phase-3/F3.1-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F3.2',
      testMatch: ['<rootDir>/tests/phase-3/F3.2-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F3.3',
      testMatch: ['<rootDir>/tests/phase-3/F3.3-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F3.4',
      testMatch: ['<rootDir>/tests/phase-3/F3.4-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'phase-3',
      testMatch: ['<rootDir>/tests/phase-3/**/*.test.ts']
    },

    // Phase 4 projects
    {
      ...baseProjectConfig,
      displayName: 'F4.1',
      testMatch: ['<rootDir>/tests/phase-4/F4.1-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F4.2',
      testMatch: ['<rootDir>/tests/phase-4/F4.2-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F4.3',
      testMatch: ['<rootDir>/tests/phase-4/F4.3-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'phase-4',
      testMatch: ['<rootDir>/tests/phase-4/**/*.test.ts']
    },

    // Phase 5 projects
    {
      ...baseProjectConfig,
      displayName: 'F5.1',
      testMatch: ['<rootDir>/tests/phase-5/F5.1-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F5.2',
      testMatch: ['<rootDir>/tests/phase-5/F5.2-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F5.3',
      testMatch: ['<rootDir>/tests/phase-5/F5.3-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'phase-5',
      testMatch: ['<rootDir>/tests/phase-5/**/*.test.ts']
    },

    // Phase 6 projects
    {
      ...baseProjectConfig,
      displayName: 'F6.1',
      testMatch: ['<rootDir>/tests/phase-6/F6.1-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F6.2',
      testMatch: ['<rootDir>/tests/phase-6/F6.2-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F6.3',
      testMatch: ['<rootDir>/tests/phase-6/F6.3-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F6.4',
      testMatch: ['<rootDir>/tests/phase-6/F6.4-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'phase-6',
      testMatch: ['<rootDir>/tests/phase-6/**/*.test.ts']
    },

    // Phase 7 projects
    {
      ...baseProjectConfig,
      displayName: 'F7.1',
      testMatch: ['<rootDir>/tests/phase-7/F7.1-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F7.2',
      testMatch: ['<rootDir>/tests/phase-7/F7.2-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F7.3',
      testMatch: ['<rootDir>/tests/phase-7/F7.3-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'F7.4',
      testMatch: ['<rootDir>/tests/phase-7/F7.4-*.test.ts']
    },
    {
      ...baseProjectConfig,
      displayName: 'phase-7',
      testMatch: ['<rootDir>/tests/phase-7/**/*.test.ts']
    },

    // All tests
    {
      ...baseProjectConfig,
      displayName: 'all',
      testMatch: ['<rootDir>/tests/**/*.test.ts']
    }
  ]
};
