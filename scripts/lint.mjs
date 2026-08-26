import ts from 'typescript'
import { execSync } from 'node:child_process'

const [major] = (ts.versionMajorMinor || ts.version || '').split('.').map(Number)

if (major >= 7) {
  console.log('ℹ️  TypeScript 7.x detected: skipping ESLint until typescript-eslint publishes official TS 7 support (tracking issue #10940).')
  process.exit(0)
}

try {
  execSync('eslint src', { stdio: 'inherit' })
} catch (error) {
  process.exit(error.status ?? 1)
}
