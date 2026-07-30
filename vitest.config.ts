import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Match the tsconfig `@/*` -> `./src/*` mapping so tests import the same way
    // application code does.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // `pricing.ts` reads these once at module load. Pin them to their documented
    // defaults here so the exact-value assertions don't depend on whatever a
    // developer happens to have in a local .env. The maths in the tests is
    // written against exactly these rates.
    env: {
      BOOKING_MARGIN_RATE: '0.05',
      BOOKING_EXTRAS_MARGIN_RATE: '0.15',
      BOOKING_ASSUMED_FEE_RATE: '0.029',
    },
  },
});
