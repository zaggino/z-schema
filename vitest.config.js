import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/spec/*.{js,ts}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browsers',
          include: ['test/spec/*.{js,ts}'],
          exclude: ['test/spec/rollup-build-spec.{js,ts}', 'test/spec/rollup-smoke-spec.{js,ts}'],
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
