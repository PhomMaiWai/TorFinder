const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  // This file is CommonJS (ESLint loads it directly), so linting it with the
  // TypeScript rules only flags its own require() — skip it.
  { ignores: ["dist/**", "eslint.config.js"] },
  ...tseslint.configs.recommended,
);
