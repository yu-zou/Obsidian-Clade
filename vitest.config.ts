import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, 'tests/obsidian-stub.ts'),
    },
  },
});
