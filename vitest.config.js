import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
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
