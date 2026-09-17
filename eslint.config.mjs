/**
 * @file Repository ESLint configuration.
 * @description Applies strict, type-aware rules to TypeScript source and tests.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['artifacts/**', 'coverage/**', 'dist/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false } },
      ],
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
);
