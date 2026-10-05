import { defineConfig } from 'vitest/config';

// Tests de security rules: necesitan emuladores (Firestore + Storage). Ver README en el spec.
//   npx firebase emulators:exec --only firestore,storage --project demo-zoem "npx vitest run --config rules-tests/vitest.config.ts"
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.rules.spec.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
