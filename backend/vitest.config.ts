import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@floq/types': path.resolve(__dirname, '../packages/types/dist/index.js'),
      '@floq/constants': path.resolve(__dirname, '../packages/constants/dist/index.js'),
      '@floq/utils': path.resolve(__dirname, '../packages/utils/dist/index.js'),
      '@floq/validation': path.resolve(__dirname, '../packages/validation/dist/index.js'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    singleThread: true,
    fileParallelism: false,
  },
});
