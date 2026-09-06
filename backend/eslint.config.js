const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  { ignores: ["dist/**"] },
  ...tseslint.configs.recommended,
);
