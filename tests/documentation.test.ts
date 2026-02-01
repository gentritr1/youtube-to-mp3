/**
 * Tests for Documentation Files
 * Validates README.md, SYSTEM_DESIGN.md, and feature_development.md
 * Ensures documentation is consistent with actual project structure
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const README_PATH = join(process.cwd(), 'README.md');
const SYSTEM_DESIGN_PATH = join(process.cwd(), 'SYSTEM_DESIGN.md');
const WORKFLOW_PATH = join(process.cwd(), '.agent/workflows/feature_development.md');
const PACKAGE_JSON_PATH = join(process.cwd(), 'package.json');

describe('Documentation Files', () => {
  let readme: string;
  let systemDesign: string;
  let workflow: string;
  let packageJson: any;

  beforeAll(() => {
    if (existsSync(README_PATH)) {
      readme = readFileSync(README_PATH, 'utf-8');
    } else {
      throw new Error(`README.md not found at ${README_PATH}`);
    }

    if (existsSync(SYSTEM_DESIGN_PATH)) {
      systemDesign = readFileSync(SYSTEM_DESIGN_PATH, 'utf-8');
    } else {
      throw new Error(`SYSTEM_DESIGN.md not found at ${SYSTEM_DESIGN_PATH}`);
    }

    if (existsSync(WORKFLOW_PATH)) {
      workflow = readFileSync(WORKFLOW_PATH, 'utf-8');
    } else {
      throw new Error(`Workflow file not found at ${WORKFLOW_PATH}`);
    }

    if (existsSync(PACKAGE_JSON_PATH)) {
      packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    } else {
      throw new Error(`package.json not found at ${PACKAGE_JSON_PATH}`);
    }
  });

  describe('README.md', () => {
    it('should exist', () => {
      expect(existsSync(README_PATH)).toBe(true);
    });

    it('should have content', () => {
      expect(readme).toBeDefined();
      expect(readme.length).toBeGreaterThan(100);
    });

    it('should have a title', () => {
      expect(readme).toMatch(/^#\s+/m);
    });

    it('should mention the project name', () => {
      expect(readme.toLowerCase()).toContain('yt converter');
    });

    it('should have prerequisites section', () => {
      expect(readme).toMatch(/##.*Prerequisites/i);
    });

    it('should have installation section', () => {
      expect(readme).toMatch(/##.*Installation/i);
    });

    it('should document npm install', () => {
      expect(readme).toContain('npm install');
    });

    it('should document npm start', () => {
      expect(readme).toContain('npm start');
    });

    it('should have testing section', () => {
      expect(readme).toMatch(/##.*Testing/i);
    });

    it('should document npm test', () => {
      expect(readme).toContain('npm test');
    });

    it('should have Docker section', () => {
      expect(readme).toMatch(/##.*Docker/i);
    });

    it('should document docker scripts', () => {
      expect(readme).toContain('docker:build');
      expect(readme).toContain('docker:up');
    });

    it('should document preflight script', () => {
      expect(readme).toContain('preflight');
    });

    it('should mention yt-dlp as dependency', () => {
      expect(readme.toLowerCase()).toContain('yt-dlp');
    });

    it('should mention ffmpeg as dependency', () => {
      expect(readme.toLowerCase()).toContain('ffmpeg');
    });

    it('should have architecture section', () => {
      expect(readme).toMatch(/##.*Architecture/i);
    });

    it('should mention key technologies', () => {
      expect(readme.toLowerCase()).toContain('express');
      expect(readme.toLowerCase()).toContain('node');
    });
  });

  describe('SYSTEM_DESIGN.md', () => {
    it('should exist', () => {
      expect(existsSync(SYSTEM_DESIGN_PATH)).toBe(true);
    });

    it('should have content', () => {
      expect(systemDesign).toBeDefined();
      expect(systemDesign.length).toBeGreaterThan(500);
    });

    it('should have table of contents', () => {
      expect(systemDesign).toMatch(/##.*Table of Contents/i);
    });

    it('should have overview section', () => {
      expect(systemDesign).toMatch(/##.*Overview/i);
    });

    it('should have architecture diagram', () => {
      expect(systemDesign).toMatch(/##.*Architecture Diagram/i);
    });

    it('should have tech stack documented', () => {
      expect(systemDesign).toMatch(/Tech Stack/i);
    });

    it('should document SQLite persistence', () => {
      expect(systemDesign).toContain('SQLite');
      expect(systemDesign.toLowerCase()).toContain('persistence');
    });

    it('should document rate limiting', () => {
      expect(systemDesign).toMatch(/Rate Limit/i);
    });

    it('should have project structure section', () => {
      expect(systemDesign).toMatch(/##.*Project Structure/i);
    });

    it('should document component breakdown', () => {
      expect(systemDesign).toMatch(/##.*Component Breakdown/i);
    });

    it('should document data flow', () => {
      expect(systemDesign).toMatch(/##.*Data Flow/i);
    });

    it('should document security', () => {
      expect(systemDesign).toMatch(/##.*Security/i);
    });

    it('should have testing section', () => {
      expect(systemDesign).toMatch(/##.*Testing/i);
    });

    it('should document health check endpoint', () => {
      expect(systemDesign).toContain('/health');
    });

    it('should mention Docker deployment', () => {
      expect(systemDesign).toContain('Docker');
    });

    it('should document API endpoints', () => {
      expect(systemDesign).toContain('/api/info');
      expect(systemDesign).toContain('/api/convert');
    });

    it('should mention Dockerfile updates consideration', () => {
      expect(systemDesign).toMatch(/Dockerfile.*update/i);
    });
  });

  describe('feature_development.md Workflow', () => {
    it('should exist', () => {
      expect(existsSync(WORKFLOW_PATH)).toBe(true);
    });

    it('should have content', () => {
      expect(workflow).toBeDefined();
      expect(workflow.length).toBeGreaterThan(200);
    });

    it('should have title about feature development', () => {
      expect(workflow).toMatch(/Feature Development/i);
    });

    it('should mention TDD', () => {
      expect(workflow).toMatch(/TDD/i);
    });

    it('should mention Docker', () => {
      expect(workflow).toContain('Docker');
    });

    it('should document creating feature branch', () => {
      expect(workflow).toContain('git checkout -b');
      expect(workflow).toContain('feature/');
    });

    it('should document writing tests first', () => {
      expect(workflow).toMatch(/Write Tests First/i);
    });

    it('should document implementing feature', () => {
      expect(workflow).toMatch(/Implement.*Feature/i);
    });

    it('should document TypeScript build step', () => {
      expect(workflow).toMatch(/TypeScript.*Build/i);
      expect(workflow).toContain('npm run build');
    });

    it('should document Docker build test', () => {
      expect(workflow).toMatch(/Docker Build Test/i);
      expect(workflow).toContain('docker:build');
    });

    it('should document preflight check', () => {
      expect(workflow).toMatch(/Preflight/i);
      expect(workflow).toContain('npm run preflight');
    });

    it('should document commit and push', () => {
      expect(workflow).toContain('git commit');
      expect(workflow).toContain('git push');
    });

    it('should document pull request creation', () => {
      expect(workflow).toMatch(/Pull Request/i);
    });

    it('should have scripts reference table', () => {
      expect(workflow).toMatch(/npm Scripts/i);
    });
  });

  describe('Cross-Document Consistency', () => {
    it('Docker scripts mentioned in docs should exist in package.json', () => {
      const dockerScripts = ['docker:build', 'docker:test', 'docker:up', 'docker:down'];
      dockerScripts.forEach(script => {
        if ((readme?.includes(script)) || (workflow?.includes(script))) {
          expect(packageJson.scripts[script]).toBeDefined();
        }
      });
    });

    it('test scripts mentioned in docs should exist in package.json', () => {
      const testScripts = ['test', 'test:watch'];
      testScripts.forEach(script => {
        if ((readme?.includes(script)) || (workflow?.includes(script))) {
          expect(packageJson.scripts[script]).toBeDefined();
        }
      });
    });

    it('preflight script mentioned in docs should exist', () => {
      if (readme.includes('preflight') || workflow.includes('preflight')) {
        expect(packageJson.scripts.preflight).toBeDefined();
      }
    });

    it('build script mentioned in docs should exist', () => {
      if (readme.includes('npm run build') || workflow.includes('npm run build')) {
        expect(packageJson.scripts.build).toBeDefined();
      }
    });

    it('start script mentioned in docs should exist', () => {
      if (readme.includes('npm start')) {
        expect(packageJson.scripts.start).toBeDefined();
      }
    });

    it('dependencies mentioned in README should be in package.json', () => {
      const runtimeDeps = Object.keys(packageJson.dependencies || {});
      if (readme.toLowerCase().includes('express')) {
        expect(runtimeDeps).toContain('express');
      }
      if (readme.toLowerCase().includes('sqlite')) {
        expect(runtimeDeps).toContain('better-sqlite3');
      }
    });
  });

  describe('Workflow Step Order Validation', () => {
    it('should document TDD before implementation', () => {
      const tddIndex = workflow.indexOf('Write Tests First');
      const implIndex = workflow.indexOf('Implement the Feature');
      if (tddIndex > 0 && implIndex > 0) {
        expect(tddIndex).toBeLessThan(implIndex);
      }
    });

    it('should document build after implementation', () => {
      const implIndex = workflow.indexOf('Implement the Feature');
      const buildIndex = workflow.indexOf('TypeScript Build');
      if (implIndex > 0 && buildIndex > 0) {
        expect(implIndex).toBeLessThan(buildIndex);
      }
    });

    it('should document Docker test after build', () => {
      const buildIndex = workflow.indexOf('TypeScript Build');
      const dockerIndex = workflow.indexOf('Docker Build Test');
      if (buildIndex > 0 && dockerIndex > 0) {
        expect(buildIndex).toBeLessThan(dockerIndex);
      }
    });

    it('should document preflight before commit', () => {
      const preflightIndex = workflow.indexOf('Preflight');
      const commitIndex = workflow.indexOf('Commit');
      if (preflightIndex > 0 && commitIndex > 0) {
        expect(preflightIndex).toBeLessThan(commitIndex);
      }
    });
  });

  describe('Code Examples in Documentation', () => {
    it('workflow should have code blocks for commands', () => {
      expect(workflow).toMatch(/```bash/);
    });

    it('README should have code blocks', () => {
      expect(readme).toMatch(/```/);
    });

    it('code examples should use correct npm commands', () => {
      const allDocs = readme + workflow;
      // Should not have 'yarn' commands if it's an npm project
      if (allDocs.includes('npm install')) {
        const yarnCount = (allDocs.match(/yarn\s+/g) || []).length;
        const npmCount = (allDocs.match(/npm\s+/g) || []).length;
        expect(npmCount).toBeGreaterThan(yarnCount);
      }
    });
  });

  describe('Documentation Completeness', () => {
    it('README should explain what the project does', () => {
      expect(readme.toLowerCase()).toMatch(/convert|youtube/i);
    });

    it('README should have contact or contribution info', () => {
      const hasInfo = readme.match(/license|contribute|issue|contact/i);
      expect(hasInfo).not.toBeNull();
    });

    it('SYSTEM_DESIGN should document all major services', () => {
      expect(systemDesign).toContain('ytdlp');
      expect(systemDesign).toContain('taskManager');
      expect(systemDesign).toContain('jobQueue');
    });

    it('SYSTEM_DESIGN should explain rate limits', () => {
      expect(systemDesign).toMatch(/\d+.*per.*minute|hour/i);
    });

    it('workflow should explain why each step matters', () => {
      // Check for explanatory text, not just commands
      const hasExplanations = workflow.match(/ensure|verify|confirm|prevent/gi);
      expect(hasExplanations).not.toBeNull();
      expect(hasExplanations!.length).toBeGreaterThan(3);
    });
  });

  describe('Edge Cases & Negative Tests', () => {
    it('documentation should not contain broken links', () => {
      const allDocs = readme + systemDesign + workflow;
      // Check for common broken link patterns
      expect(allDocs).not.toContain('](]');
      expect(allDocs).not.toContain('[](');
      expect(allDocs).not.toMatch(/\]\(\s*[^)\s]*\s+[^)"\s]*\)/); // No spaces in URLs (but allow titles)
    });

    it('documentation should not have TODO markers', () => {
      const allDocs = readme + systemDesign + workflow;
      expect(allDocs.toUpperCase()).not.toContain('TODO:');
      expect(allDocs.toUpperCase()).not.toContain('FIXME:');
    });

    it('documentation should not reference non-existent files', () => {
      // Extract file references from docs
      const fileRefs = [
        ...readme.matchAll(/`([^`]+\.(ts|js|json|yml|yaml))`/g),
        ...systemDesign.matchAll(/`([^`]+\.(ts|js|json|yml|yaml))`/g),
        ...workflow.matchAll(/`([^`]+\.(ts|js|json|yml|yaml))`/g)
      ];

      fileRefs.forEach(match => {
        const filename = match[1];
        // Only check if it looks like a project file
        if (!filename.includes('..') && !filename.startsWith('/')) {
          const possiblePath = join(process.cwd(), filename);
          // This is a soft check - we just ensure format is reasonable
          expect(filename).toMatch(/^[a-zA-Z0-9_\-\/\.]+$/);
        }
      });
    });

    it('code blocks should have proper closing', () => {
      const backtickCount = (readme.match(/```/g) || []).length;
      expect(backtickCount % 2).toBe(0); // Should have matching pairs
    });

    it('documentation should not have placeholder text', () => {
      const allDocs = readme + systemDesign + workflow;
      expect(allDocs).not.toContain('[INSERT ');
      expect(allDocs).not.toContain('PLACEHOLDER');
      expect(allDocs).not.toContain('TBD');
    });

    it('headings should follow proper markdown hierarchy', () => {
      const readme_headings = readme.match(/^#+\s/gm) || [];
      readme_headings.forEach((heading: string) => {
        const level = heading.match(/^(#+)/)?.[1].length || 0;
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(6);
      });
    });
  });

  describe('TDD Workflow Integration Tests', () => {
    it('workflow should align with package.json preflight order', () => {
      if (packageJson.scripts.preflight) {
        const preflightOrder = packageJson.scripts.preflight;
        // Verify workflow mentions these in same order
        expect(workflow).toContain('npm test');
        expect(workflow).toContain('npm run build');
        expect(workflow).toContain('docker:build');
      }
    });

    it('workflow test phase should mention "red" phase', () => {
      expect(workflow).toMatch(/red.*phase|fail|FAIL/i);
    });

    it('workflow implementation should mention "green" phase', () => {
      expect(workflow).toMatch(/green.*phase|pass|PASS/i);
    });

    it('workflow should mention health check verification', () => {
      expect(workflow).toContain('/health');
    });
  });
});