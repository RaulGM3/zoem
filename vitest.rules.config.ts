import { defineConfig } from 'vitest/config';

// Tests de Security Rules contra los emulators de Firestore/Storage.
// Se lanzan con `npm run test:rules` (firebase emulators:exec).
export default defineConfig({
  test: {
    include: ['rules-tests/**/*.spec.ts'],
    environment: 'node',
    // Un único emulator compartido: los ficheros no pueden correr en paralelo.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
