import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Default environment is Node (fast for server tests).
        // Frontend tests opt-in to jsdom per-file with:
        //   // @vitest-environment jsdom
        globals: false,
        include: ['tests/**/*.test.ts'],
    },
});
