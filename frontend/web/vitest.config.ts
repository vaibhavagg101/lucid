import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node environment is enough — the frontend tests are all pure logic
    // or server actions with mocked Firebase, so no DOM is required.
    environment: 'node',
    include: ['app/**/*.test.{ts,tsx}'],
  },
});
