const lintStagedConfig = {
  '*.(ts|tsx|mts|cts|js|jsx|mjs|cjs|json|css|md|yml)': ['eslint --fix --no-warn-ignored', 'prettier --write'],
};

export default lintStagedConfig;
