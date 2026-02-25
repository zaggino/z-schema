import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  optimizeDeps: {
    include: ['punycode/punycode.js'],
  },
  test: {
    coverage: {
      provider: 'istanbul',
      include: ['src/'],
      exclude: ['src/package.json', 'src/schemas/*.json'],
    },
    globals: true,
    globalSetup: 'test/vitest.setup.ts',
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/spec/*.(spec|node-spec).{js,ts}'],
          exclude: ['**/*.browser-spec.{js,ts}'],
        },
      },
      {
        extends: true,
        publicDir: 'test/public',
        test: {
          name: 'browser',
          include: ['test/spec/*.(spec|browser-spec).{js,ts}'],
          exclude: ['**/*.node-spec.{js,ts}'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            screenshotFailures: false,
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
          },
        },
      },
    ],
  },
});
