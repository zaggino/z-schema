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
          exclude: ['test/spec/RollupBuildSpec.{js,ts}', 'test/spec/RollupSmokeSpec.{js,ts}'],
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
