import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      // Run tests straight from workspace sources — no pre-build required.
      '@vortex/core': path.resolve(__dirname, '../../packages/vortex-core/src/index.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
