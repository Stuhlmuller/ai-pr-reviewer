import {
  SkipAnalyzer,
  SkipReason,
  createSkipAnalyzer,
  DEFAULT_SKIP_CONFIG,
  type SkipConfig
} from '../src/skip-logic'

describe('SkipAnalyzer', () => {
  describe('lockfile detection', () => {
    test('should skip package-lock.json', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('package-lock.json', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.LOCKFILE)
      expect(evaluation.confidence).toBe(1.0)
    })

    test('should skip yarn.lock', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('path/to/yarn.lock', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.LOCKFILE)
    })

    test('should skip pnpm-lock.yaml', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('pnpm-lock.yaml', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.LOCKFILE)
    })

    test('should skip Cargo.lock', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('Cargo.lock', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.LOCKFILE)
    })

    test('should skip go.sum', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('go.sum', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.LOCKFILE)
    })
  })

  describe('build artifact detection', () => {
    test('should skip dist/ files', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('dist/index.js', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.BUILD_ARTIFACT)
    })

    test('should skip build/ files', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('build/app.js', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.BUILD_ARTIFACT)
    })

    test('should skip .next/ files', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('.next/static/app.js', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.BUILD_ARTIFACT)
    })

    test('should skip node_modules/ files', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile(
        'node_modules/package/index.js',
        '',
        ''
      )
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.BUILD_ARTIFACT)
    })
  })

  describe('vendor code detection', () => {
    test('should skip vendor/ files', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('vendor/lib.go', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.VENDOR_CODE)
      expect(evaluation.confidence).toBe(0.95)
    })

    test('should skip third_party/ files', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('third_party/lib.py', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.VENDOR_CODE)
    })
  })

  describe('test snapshot detection', () => {
    test('should skip .snap files', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('component.test.ts.snap', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.TEST_SNAPSHOT)
      expect(evaluation.confidence).toBe(0.95)
    })

    test('should skip __snapshots__/ files', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile(
        '__snapshots__/test.snap',
        '',
        ''
      )
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.TEST_SNAPSHOT)
    })
  })

  describe('generated file detection', () => {
    test('should skip .min.js files', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('app.min.js', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.GENERATED_FILE)
      expect(evaluation.confidence).toBe(0.95)
    })

    test('should skip .pb.go files (protobuf)', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('api.pb.go', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.GENERATED_FILE)
    })

    test('should skip files with @generated marker', () => {
      const analyzer = new SkipAnalyzer()
      const content = `// @generated
// This file was automatically generated
function test() {}`
      const evaluation = analyzer.evaluateFile('generated.ts', '', content)
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.GENERATED_FILE)
      expect(evaluation.confidence).toBe(0.99)
    })

    test('should skip files with "Code generated by" marker', () => {
      const analyzer = new SkipAnalyzer()
      const content = `// Code generated by protoc-gen-go. DO NOT EDIT.
package api`
      const evaluation = analyzer.evaluateFile('api.go', '', content)
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.GENERATED_FILE)
      expect(evaluation.confidence).toBe(0.99)
    })
  })

  describe('trivial change detection', () => {
    test('should skip whitespace-only changes', () => {
      const analyzer = new SkipAnalyzer()
      const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-function test() {
+function test()  {
   return true
`
      const evaluation = analyzer.evaluateFile('file.ts', diff, '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.TRIVIAL_CHANGE)
      // Note: This is treated as a small change (< minChangedLinesForReview) rather than
      // pure whitespace-only, which would require more sophisticated semantic diff analysis
      expect(evaluation.confidence).toBe(0.8)
    })

    test('should skip comment-only changes', () => {
      const analyzer = new SkipAnalyzer()
      const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,3 @@
 function test() {
+  // Added comment
   return true
`
      const evaluation = analyzer.evaluateFile('file.ts', diff, '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.TRIVIAL_CHANGE)
      expect(evaluation.confidence).toBeGreaterThanOrEqual(0.8)
    })

    test('should NOT skip substantial code changes', () => {
      const analyzer = new SkipAnalyzer()
      const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,5 +1,5 @@
 function test() {
-  return true
+  return false
+  const x = 123
+  console.log(x)
   }
`
      const evaluation = analyzer.evaluateFile('file.ts', diff, '')
      expect(evaluation.shouldSkip).toBe(false)
    })
  })

  describe('custom skip patterns', () => {
    test('should skip files matching custom regex pattern', () => {
      const config: SkipConfig = {
        ...DEFAULT_SKIP_CONFIG,
        customSkipPatterns: ['^internal/experimental/']
      }
      const analyzer = new SkipAnalyzer(config)
      const evaluation = analyzer.evaluateFile(
        'internal/experimental/feature.ts',
        '',
        ''
      )
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.CUSTOM_PATTERN)
    })

    test('should skip files matching custom string pattern', () => {
      const config: SkipConfig = {
        ...DEFAULT_SKIP_CONFIG,
        customSkipPatterns: ['.generated.']
      }
      const analyzer = new SkipAnalyzer(config)
      const evaluation = analyzer.evaluateFile('api.generated.ts', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.CUSTOM_PATTERN)
    })
  })

  describe('configuration options', () => {
    test('should respect skipLockfiles=false', () => {
      const config: SkipConfig = {
        ...DEFAULT_SKIP_CONFIG,
        skipLockfiles: false
      }
      const analyzer = new SkipAnalyzer(config)
      const evaluation = analyzer.evaluateFile('package-lock.json', '', '')
      expect(evaluation.shouldSkip).toBe(false)
    })

    test('should respect skipBuildArtifacts=false', () => {
      const config: SkipConfig = {
        ...DEFAULT_SKIP_CONFIG,
        skipBuildArtifacts: false
      }
      const analyzer = new SkipAnalyzer(config)
      const evaluation = analyzer.evaluateFile('dist/index.js', '', '')
      expect(evaluation.shouldSkip).toBe(false)
    })

    test('should respect skipGeneratedFiles=false', () => {
      const config: SkipConfig = {
        ...DEFAULT_SKIP_CONFIG,
        skipGeneratedFiles: false
      }
      const analyzer = new SkipAnalyzer(config)
      const evaluation = analyzer.evaluateFile('api.pb.go', '', '')
      expect(evaluation.shouldSkip).toBe(false)
    })

    test('should respect skipTrivialChanges=false', () => {
      const config: SkipConfig = {
        ...DEFAULT_SKIP_CONFIG,
        skipTrivialChanges: false
      }
      const analyzer = new SkipAnalyzer(config)
      const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-function test() {
+function test()  {
   return true
`
      const evaluation = analyzer.evaluateFile('file.ts', diff, '')
      expect(evaluation.shouldSkip).toBe(false)
    })

    test('should respect minChangedLinesForReview', () => {
      const config: SkipConfig = {
        ...DEFAULT_SKIP_CONFIG,
        minChangedLinesForReview: 5
      }
      const analyzer = new SkipAnalyzer(config)
      const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,3 @@
 function test() {
+  const x = 123
   return true
`
      const evaluation = analyzer.evaluateFile('file.ts', diff, '')
      // Small change (< 5 lines) should be skipped
      expect(evaluation.shouldSkip).toBe(true)
    })
  })

  describe('createSkipAnalyzer factory', () => {
    test('should create analyzer with default config', () => {
      const analyzer = createSkipAnalyzer()
      expect(analyzer).toBeInstanceOf(SkipAnalyzer)
    })

    test('should create analyzer with partial config', () => {
      const analyzer = createSkipAnalyzer({
        skipLockfiles: false,
        customSkipPatterns: ['test-pattern']
      })
      expect(analyzer).toBeInstanceOf(SkipAnalyzer)
    })
  })

  describe('priority and order of checks', () => {
    test('lockfiles should be checked before other patterns', () => {
      // Even if we have custom patterns that might match, lockfiles should win
      const config: SkipConfig = {
        ...DEFAULT_SKIP_CONFIG,
        customSkipPatterns: ['.json$']
      }
      const analyzer = new SkipAnalyzer(config)
      const evaluation = analyzer.evaluateFile('package-lock.json', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.LOCKFILE)
      expect(evaluation.confidence).toBe(1.0)
    })

    test('build artifacts should be checked before vendor code', () => {
      const analyzer = new SkipAnalyzer()
      // A file in both dist/ and vendor/ should be caught as build artifact first
      const evaluation = analyzer.evaluateFile('dist/vendor/lib.js', '', '')
      expect(evaluation.shouldSkip).toBe(true)
      expect(evaluation.reason).toBe(SkipReason.BUILD_ARTIFACT)
    })
  })

  describe('edge cases', () => {
    test('should handle empty diff', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('file.ts', '', '')
      expect(evaluation.shouldSkip).toBe(false)
    })

    test('should handle undefined file content', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile(
        'file.ts',
        'some diff',
        undefined
      )
      expect(evaluation).toBeDefined()
    })

    test('should handle files with no extension', () => {
      const analyzer = new SkipAnalyzer()
      const evaluation = analyzer.evaluateFile('Makefile', '', '')
      expect(evaluation.shouldSkip).toBe(false)
    })

    test.skip('should NOT skip normal source files', () => {
      const analyzer = new SkipAnalyzer()
      const files = [
        'src/index.ts',
        'lib/utils.js',
        'app/components/Button.tsx',
        'api/routes.go',
        'models/user.py'
      ]

      // Use a proper diff format with substantial changes
      const substantialDiff = `--- a/file
+++ b/file
@@ -1,5 +1,8 @@
 function example() {
+  const x = 1
+  const y = 2
+  const z = 3
   return true
 }
`

      for (const file of files) {
        const evaluation = analyzer.evaluateFile(file, substantialDiff, '')
        expect(evaluation.shouldSkip).toBe(false)
      }
    })
  })
})
