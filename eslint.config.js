import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'public', 'node_modules', 'assets-source', 'docs', '.vitest', '.claude', '.superpowers'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Keep modules focused: warn above 400 lines of code.
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  // Long test files are fine: one describe per feature.
  { files: ['tests/**'], rules: { 'max-lines': 'off' } },
);
