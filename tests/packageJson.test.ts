/**
 * Tests for package.json Configuration
 * Validates project metadata, scripts, and dependencies
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const PACKAGE_JSON_PATH = join(process.cwd(), 'package.json');

describe('package.json Configuration', () => {
  let packageJson: any;

  beforeAll(() => {
    if (!existsSync(PACKAGE_JSON_PATH)) {
      throw new Error('package.json not found');
    }
    const content = readFileSync(PACKAGE_JSON_PATH, 'utf-8');
    packageJson = JSON.parse(content);
  });

  describe('Basic Metadata', () => {
    it('should exist', () => {
      expect(existsSync(PACKAGE_JSON_PATH)).toBe(true);
    });

    it('should have valid JSON format', () => {
      expect(packageJson).toBeDefined();
      expect(typeof packageJson).toBe('object');
    });

    it('should have name field', () => {
      expect(packageJson.name).toBeDefined();
      expect(typeof packageJson.name).toBe('string');
      expect(packageJson.name.length).toBeGreaterThan(0);
    });

    it('should have version field', () => {
      expect(packageJson.version).toBeDefined();
      expect(typeof packageJson.version).toBe('string');
      expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have description field', () => {
      expect(packageJson.description).toBeDefined();
      expect(typeof packageJson.description).toBe('string');
    });

    it('should use ES modules', () => {
      expect(packageJson.type).toBe('module');
    });
  });

  describe('Scripts Configuration', () => {
    it('should have scripts defined', () => {
      expect(packageJson.scripts).toBeDefined();
      expect(typeof packageJson.scripts).toBe('object');
    });

    it('should have start script', () => {
      expect(packageJson.scripts.start).toBeDefined();
    });

    it('should have dev script', () => {
      expect(packageJson.scripts.dev).toBeDefined();
    });

    it('should have test script', () => {
      expect(packageJson.scripts.test).toBeDefined();
    });

    it('should have test:watch script', () => {
      expect(packageJson.scripts['test:watch']).toBeDefined();
    });

    it('should have build script', () => {
      expect(packageJson.scripts.build).toBeDefined();
    });

    it('test script should use vitest', () => {
      expect(packageJson.scripts.test).toContain('vitest');
    });

    it('build script should use tsc', () => {
      expect(packageJson.scripts.build).toContain('tsc');
    });
  });

  describe('Docker Scripts', () => {
    it('should have docker:build script', () => {
      expect(packageJson.scripts['docker:build']).toBeDefined();
    });

    it('should have docker:test script', () => {
      expect(packageJson.scripts['docker:test']).toBeDefined();
    });

    it('should have docker:up script', () => {
      expect(packageJson.scripts['docker:up']).toBeDefined();
    });

    it('should have docker:down script', () => {
      expect(packageJson.scripts['docker:down']).toBeDefined();
    });

    it('docker:build should use docker build command', () => {
      expect(packageJson.scripts['docker:build']).toContain('docker build');
    });

    it('docker:build should tag image', () => {
      expect(packageJson.scripts['docker:build']).toMatch(/-t\s+[\w-]+/);
    });

    it('docker:test should chain build and run', () => {
      const script = packageJson.scripts['docker:test'];
      expect(script).toContain('docker:build');
      expect(script).toContain('&&');
      expect(script).toContain('docker run');
    });

    it('docker:up should use docker compose', () => {
      expect(packageJson.scripts['docker:up']).toContain('docker compose');
    });

    it('docker:down should use docker compose', () => {
      expect(packageJson.scripts['docker:down']).toContain('docker compose');
    });
  });

  describe('Preflight Script', () => {
    it('should have preflight script', () => {
      expect(packageJson.scripts.preflight).toBeDefined();
    });

    it('preflight should run test first', () => {
      const script = packageJson.scripts.preflight;
      const testIndex = script.indexOf('npm test');
      expect(testIndex).toBeGreaterThanOrEqual(0);
    });

    it('preflight should run build after test', () => {
      const script = packageJson.scripts.preflight;
      const testIndex = script.indexOf('npm test');
      const buildIndex = script.indexOf('npm run build');
      expect(buildIndex).toBeGreaterThan(testIndex);
    });

    it('preflight should run docker:build last', () => {
      const script = packageJson.scripts.preflight;
      const buildIndex = script.indexOf('npm run build');
      const dockerIndex = script.indexOf('docker:build');
      expect(dockerIndex).toBeGreaterThan(buildIndex);
    });

    it('preflight should use && for sequential execution', () => {
      expect(packageJson.scripts.preflight).toContain('&&');
    });
  });

  describe('Production Dependencies', () => {
    it('should have dependencies defined', () => {
      expect(packageJson.dependencies).toBeDefined();
      expect(typeof packageJson.dependencies).toBe('object');
    });

    it('should have express', () => {
      expect(packageJson.dependencies.express).toBeDefined();
    });

    it('should have cors', () => {
      expect(packageJson.dependencies.cors).toBeDefined();
    });

    it('should have express-rate-limit', () => {
      expect(packageJson.dependencies['express-rate-limit']).toBeDefined();
    });

    it('should have better-sqlite3 for persistence', () => {
      expect(packageJson.dependencies['better-sqlite3']).toBeDefined();
    });

    it('should have bull for job queue', () => {
      expect(packageJson.dependencies.bull).toBeDefined();
    });

    it('should have ioredis for Redis connection', () => {
      expect(packageJson.dependencies.ioredis).toBeDefined();
    });

    it('dependencies should use semantic versioning', () => {
      Object.values(packageJson.dependencies).forEach((version: any) => {
        expect(version).toMatch(/^[\^~]?\d+\.\d+\.\d+$/);
      });
    });
  });

  describe('Development Dependencies', () => {
    it('should have devDependencies defined', () => {
      expect(packageJson.devDependencies).toBeDefined();
      expect(typeof packageJson.devDependencies).toBe('object');
    });

    it('should have TypeScript', () => {
      expect(packageJson.devDependencies.typescript).toBeDefined();
    });

    it('should have vitest for testing', () => {
      expect(packageJson.devDependencies.vitest).toBeDefined();
    });

    it('should have tsx for TypeScript execution', () => {
      expect(packageJson.devDependencies.tsx).toBeDefined();
    });

    it('should have @types packages for TypeScript support', () => {
      const devDeps = Object.keys(packageJson.devDependencies);
      const hasTypes = devDeps.some(dep => dep.startsWith('@types/'));
      expect(hasTypes).toBe(true);
    });

    it('should have @types/express', () => {
      expect(packageJson.devDependencies['@types/express']).toBeDefined();
    });

    it('should have @types/node', () => {
      expect(packageJson.devDependencies['@types/node']).toBeDefined();
    });

    it('devDependencies should use semantic versioning', () => {
      Object.values(packageJson.devDependencies).forEach((version: any) => {
        expect(version).toMatch(/^[\^~]?\d+\.\d+\.\d+$/);
      });
    });
  });

  describe('Dependency Consistency', () => {
    it('should not have duplicate dependencies', () => {
      const deps = Object.keys(packageJson.dependencies || {});
      const devDeps = Object.keys(packageJson.devDependencies || {});
      const duplicates = deps.filter(dep => devDeps.includes(dep));
      expect(duplicates.length).toBe(0);
    });

    it('should have matching @types packages for runtime deps', () => {
      const hasExpress = packageJson.dependencies.express;
      const hasExpressTypes = packageJson.devDependencies['@types/express'];
      if (hasExpress) {
        expect(hasExpressTypes).toBeDefined();
      }
    });

    it('should not have unused @types packages', () => {
      const runtimeDeps = Object.keys(packageJson.dependencies || {});
      const typesDeps = Object.keys(packageJson.devDependencies || {})
        .filter(dep => dep.startsWith('@types/'));

      typesDeps.forEach(typesDep => {
        const packageName = typesDep.replace('@types/', '');
        // Special cases: node is always needed, better-sqlite3 is valid
        const isValidTypes = packageName === 'node' ||
                            runtimeDeps.includes(packageName) ||
                            runtimeDeps.includes(packageName.replace('-', ''));
        expect(isValidTypes).toBe(true);
      });
    });
  });

  describe('Script Integration', () => {
    it('start script should use tsx watch for hot reload', () => {
      expect(packageJson.scripts.start).toContain('tsx watch');
    });

    it('start and dev scripts should be equivalent', () => {
      expect(packageJson.scripts.start).toBe(packageJson.scripts.dev);
    });

    it('test script should run in CI mode (non-watch)', () => {
      expect(packageJson.scripts.test).toContain('vitest run');
    });

    it('test:watch should run in watch mode', () => {
      expect(packageJson.scripts['test:watch']).toContain('vitest');
      expect(packageJson.scripts['test:watch']).not.toContain('run');
    });
  });

  describe('Docker Image Configuration', () => {
    it('docker:build should build with local tag', () => {
      const script = packageJson.scripts['docker:build'];
      expect(script).toContain(':local');
    });

    it('docker:test should remove container after test', () => {
      const script = packageJson.scripts['docker:test'];
      expect(script).toContain('--rm');
    });

    it('docker:test should map port 3000', () => {
      const script = packageJson.scripts['docker:test'];
      expect(script).toMatch(/-p\s+3000:3000/);
    });

    it('docker:up should include --build flag', () => {
      const script = packageJson.scripts['docker:up'];
      expect(script).toContain('--build');
    });
  });

  describe('Edge Cases & Negative Tests', () => {
    it('should not have pre/post scripts that could cause issues', () => {
      const scripts = Object.keys(packageJson.scripts);
      const problematicPrefixes = ['preinstall', 'postinstall', 'prepare'];
      const hasProblematic = scripts.some(s =>
        problematicPrefixes.some(prefix => s.startsWith(prefix))
      );
      // This test ensures no unexpected lifecycle hooks
      expect(hasProblematic).toBe(false);
    });

    it('should not have wildcard version dependencies', () => {
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      Object.values(allDeps).forEach((version: any) => {
        expect(version).not.toBe('*');
        expect(version).not.toBe('latest');
      });
    });

    it('should not include node_modules in any configuration', () => {
      const configString = JSON.stringify(packageJson);
      expect(configString).not.toContain('node_modules');
    });

    it('name should be lowercase and hyphenated', () => {
      expect(packageJson.name).toMatch(/^[a-z0-9-]+$/);
    });

    it('should not have deprecated nodemon in production deps', () => {
      expect(packageJson.dependencies?.nodemon).toBeUndefined();
    });

    it('scripts should not use sudo', () => {
      Object.values(packageJson.scripts).forEach((script: any) => {
        expect(script).not.toContain('sudo');
      });
    });

    it('scripts should not have rm -rf / or other dangerous commands', () => {
      Object.values(packageJson.scripts).forEach((script: any) => {
        expect(script).not.toMatch(/rm\s+-rf\s+\//);
        expect(script).not.toContain('rm -rf *');
      });
    });
  });

  describe('TDD Workflow Compliance', () => {
    it('should support TDD workflow from feature_development.md', () => {
      // Verify all required scripts for TDD workflow exist
      expect(packageJson.scripts.test).toBeDefined();
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts['docker:build']).toBeDefined();
      expect(packageJson.scripts.preflight).toBeDefined();
    });

    it('preflight script should match TDD workflow order', () => {
      const script = packageJson.scripts.preflight;
      // Should follow: test -> build -> docker:build
      const parts = script.split('&&').map((s: string) => s.trim());
      expect(parts[0]).toContain('test');
      expect(parts[1]).toContain('build');
      expect(parts[2]).toContain('docker:build');
    });
  });
});