const lintStagedConfig = {
  '*.(ts|tsx|mts|cts|js|jsx|mjs|cjs)': ['oxlint --fix', 'oxfmt --write'],
  '!(*.(ts|tsx|mts|cts|js|jsx|mjs|cjs))': ['oxfmt --no-error-on-unmatched-pattern --write'],
};

export default lintStagedConfig;
