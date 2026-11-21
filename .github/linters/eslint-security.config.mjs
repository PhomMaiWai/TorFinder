// Security-focused lint pass for .github/workflows/security.yml (docs/SECURITY.md §6).
// Kept apart from each app's own eslint config so the apps' dependencies don't
// change: CI installs eslint, typescript-eslint, eslint-plugin-security and
// eslint-plugin-react-hooks into
// a temporary folder next to a copy of this file and runs it over both apps.
import reactHooks from "eslint-plugin-react-hooks";
import security from "eslint-plugin-security";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/*.d.ts"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    // react-hooks is registered (rules off) only so the frontend's inline
    // eslint-disable comments for it resolve.
    plugins: { security, "react-hooks": reactHooks },
    rules: security.configs.recommended.rules,
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
];
