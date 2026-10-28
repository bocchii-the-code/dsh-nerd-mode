import globals from 'globals'

export default [
  {
    files: ['lib/**/*.js', 'test/**/*.mjs', 'skills/**/scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.nodeBuiltin },
    },
    rules: {
      'no-undef': 'error',
    },
  },
  {
    files: ['client.js', 'skills/**/scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: {
      'no-undef': 'error',
    },
  },
]
