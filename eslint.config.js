import tsParser from '@typescript-eslint/parser';

export default [{
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
  // Correctness checks complement tsc; formatting is intentionally left to contributors.
  rules: {
    'no-debugger': 'error',
    'no-constant-condition': 'error',
    'no-dupe-else-if': 'error',
    'no-duplicate-case': 'error',
    'no-unreachable': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-negation': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error'
  }
}];
