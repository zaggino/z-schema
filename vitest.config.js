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
      reporter: ['text', 'html', 'json-summary'],
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
          // The CI coverage run drives three browsers and the node project at once on one runner, and a browser
          // page can stall for several seconds there (a single-case WebKit test hit the 15s default). The tests
          // themselves take milliseconds; this only gives a stalled page room to resume.
          testTimeout: 60_000,
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
