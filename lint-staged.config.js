const lintStagedConfig = {
  '*.(ts|tsx|js|jsx|mjs|json|css|md)': ['eslint --fix --no-warn-ignored', 'prettier --write'],
};

export default lintStagedConfig;
