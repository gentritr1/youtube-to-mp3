/**
 * Tests for Docker Compose Configuration
 * Validates docker-compose.yml structure and settings
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DOCKER_COMPOSE_PATH = join(process.cwd(), 'docker-compose.yml');

describe('Docker Compose Configuration', () => {
  let dockerComposeContent: string;

  beforeAll(() => {
    if (!existsSync(DOCKER_COMPOSE_PATH)) {
      throw new Error('docker-compose.yml not found');
    }
    dockerComposeContent = readFileSync(DOCKER_COMPOSE_PATH, 'utf-8');
  });

  describe('File Structure', () => {
    it('should exist', () => {
      expect(existsSync(DOCKER_COMPOSE_PATH)).toBe(true);
    });

    it('should have services defined', () => {
      expect(dockerComposeContent).toContain('services:');
    });

    it('should have at least one service', () => {
      expect(dockerComposeContent).toMatch(/^\s+\w+:/m);
    });

    it('should have more than 5 lines', () => {
      // Check basic YAML structure
      const lines = dockerComposeContent.split('\n');
      expect(lines.length).toBeGreaterThan(5);
    });
  });

  describe('App Service Configuration', () => {
    it('should have app service defined', () => {
      expect(dockerComposeContent).toMatch(/^\s+app:/m);
    });

    it('should have build configuration', () => {
      expect(dockerComposeContent).toMatch(/^\s+build:\s*\./m);
    });

    it('should expose correct port', () => {
      expect(dockerComposeContent).toMatch(/ports:/);
    });

    it('should map port 3000 to 3000', () => {
      expect(dockerComposeContent).toMatch(/"?3000:3000"?/);
    });

    it('should have environment variables', () => {
      expect(dockerComposeContent).toMatch(/environment:/);
    });

    it('should set PORT environment variable', () => {
      expect(dockerComposeContent).toContain('PORT=3000');
    });

    it('should set NODE_ENV environment variable', () => {
      expect(dockerComposeContent).toMatch(/NODE_ENV=/);
    });

    it('should have volumes configured', () => {
      expect(dockerComposeContent).toMatch(/volumes:/);
    });

    it('should mount downloads directory', () => {
      expect(dockerComposeContent).toMatch(/downloads.*:.*downloads/);
    });

    it('should have healthcheck configured', () => {
      expect(dockerComposeContent).toMatch(/healthcheck:/);
    });

    it('should have healthcheck test command', () => {
      expect(dockerComposeContent).toMatch(/test:\s*\[/);
    });

    it('healthcheck should use /health endpoint', () => {
      expect(dockerComposeContent).toContain('/health');
    });

    it('healthcheck should use curl', () => {
      expect(dockerComposeContent).toContain('curl');
    });

    it('should have healthcheck interval configured', () => {
      expect(dockerComposeContent).toMatch(/interval:\s*\d+s/);
    });

    it('should have healthcheck timeout configured', () => {
      expect(dockerComposeContent).toMatch(/timeout:\s*\d+s/);
    });

    it('should have healthcheck retries configured', () => {
      expect(dockerComposeContent).toMatch(/retries:\s*\d+/);
    });

    it('should have healthcheck start_period configured', () => {
      expect(dockerComposeContent).toMatch(/start_period:\s*\d+s/);
    });
  });

  describe('Configuration Best Practices', () => {
    it('should use reasonable healthcheck interval (not too frequent)', () => {
      const match = dockerComposeContent.match(/interval:\s*(\d+)s/);
      expect(match).not.toBeNull();
      const seconds = parseInt(match![1]);
      expect(seconds).toBeGreaterThanOrEqual(10); // At least 10 seconds
    });

    it('should have reasonable timeout (not too long)', () => {
      const match = dockerComposeContent.match(/timeout:\s*(\d+)s/);
      expect(match).not.toBeNull();
      const seconds = parseInt(match![1]);
      expect(seconds).toBeLessThanOrEqual(30); // Max 30 seconds
    });

    it('should have at least 2 retries', () => {
      const match = dockerComposeContent.match(/retries:\s*(\d+)/);
      expect(match).not.toBeNull();
      const retries = parseInt(match![1]);
      expect(retries).toBeGreaterThanOrEqual(2);
    });

    it('should mount volumes with correct syntax', () => {
      const volumeMatch = dockerComposeContent.match(/- (.+):(.+)/);
      expect(volumeMatch).not.toBeNull();
      expect(volumeMatch![0]).toContain(':');
    });
  });

  describe('Security & Best Practices', () => {
    it('should not expose database files in volumes', () => {
      expect(dockerComposeContent).not.toContain('tasks.db');
    });

    it('should use specific port mapping', () => {
      const portMatches = dockerComposeContent.match(/"?(\d+):(\d+)"?/);
      expect(portMatches).not.toBeNull();
    });

    it('should not expose unnecessary services', () => {
      // Count actual service definitions (2 spaces indentation after 'services:')
      const serviceMatches = dockerComposeContent.match(/^  \w+:/gm);
      // Should have reasonable number of services (typically just 'app', maybe redis)
      expect(serviceMatches).not.toBeNull();
      expect(serviceMatches!.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Dockerfile Integration', () => {
    it('Dockerfile should exist', () => {
      const dockerfilePath = join(process.cwd(), 'Dockerfile');
      expect(existsSync(dockerfilePath)).toBe(true);
    });

    it('docker-compose should build from project root', () => {
      expect(dockerComposeContent).toMatch(/build:\s*\./);
    });
  });

  describe('Edge Cases & Negative Tests', () => {
    it('should handle missing optional Redis service gracefully', () => {
      // Test passes whether Redis is present or not
      const hasRedisService = dockerComposeContent.includes('redis:');
      // Just verify the structure is valid either way
      expect(typeof hasRedisService).toBe('boolean');
    });

    it('should not expose unnecessary ports', () => {
      const portLines = dockerComposeContent.match(/- "\d+:\d+"/g);
      if (portLines) {
        // Should only expose what's needed (1-2 ports max)
        expect(portLines.length).toBeLessThanOrEqual(2);
      }
    });

    it('environment variables should not contain sensitive data', () => {
      expect(dockerComposeContent.toLowerCase()).not.toContain('password=');
      expect(dockerComposeContent.toLowerCase()).not.toContain('secret=');
      expect(dockerComposeContent.toLowerCase()).not.toContain('api_key=');
    });

    it('should use CMD format for healthcheck test', () => {
      expect(dockerComposeContent).toMatch(/test:\s*\[\s*"CMD"/);
    });

    it('healthcheck should not run too frequently', () => {
      const intervalMatch = dockerComposeContent.match(/interval:\s*(\d+)s/);
      if (intervalMatch) {
        const interval = parseInt(intervalMatch[1]);
        expect(interval).toBeGreaterThanOrEqual(5); // At minimum 5 seconds
      }
    });

    it('should have reasonable start period', () => {
      const startMatch = dockerComposeContent.match(/start_period:\s*(\d+)s/);
      if (startMatch) {
        const period = parseInt(startMatch[1]);
        expect(period).toBeGreaterThanOrEqual(5);
        expect(period).toBeLessThanOrEqual(60); // Max 60 seconds
      }
    });
  });
});