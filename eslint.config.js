module.exports = {
  extends: ['next/core-web-vitals', 'next/typescript'],
  ignorePatterns: [
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.agents/**',
    '.kiro/**',
    '.claude/**',
    'agent/**',
    'node_modules/**'
  ]
};
