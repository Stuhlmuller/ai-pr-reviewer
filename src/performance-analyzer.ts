/**
 * Performance analyzer for code reviews
 * Detects common performance issues and anti-patterns
 */

export interface PerformanceIssue {
  severity: 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  recommendation: string
  lineNumber?: number
  codeSnippet?: string
}

export interface PerformanceAnalysisResult {
  issues: PerformanceIssue[]
  summary: {
    high: number
    medium: number
    low: number
  }
}

/**
 * Patterns for detecting performance issues
 */
const PERFORMANCE_PATTERNS = {
  // N+1 Query Problem
  nPlusOneQuery: {
    patterns: [
      /\.map\s*\([^)]*(?:await|\.then\()\s*[^)]*\)/gi, // map with await
      /for\s*\([^)]*\)\s*\{[^}]*await\s+(?:fetch|query|get|find)/gis,
      /forEach\s*\([^)]*await/gi
    ],
    title: 'Potential N+1 Query Problem',
    description:
      'Loop contains database queries or API calls, causing multiple round trips',
    recommendation:
      'Batch operations: fetch all data at once before the loop, or use bulk query methods.',
    severity: 'high' as const
  },

  // Inefficient Algorithm - Nested Loops
  nestedLoops: {
    patterns: [
      /for\s*\([^)]*\)\s*\{[^}]*for\s*\([^)]*\)\s*\{[^}]*for\s*\(/gis, // Triple nested loop
      /\.map\s*\([^)]*\.filter\s*\(/gi, // map + filter (should be single pass)
      /\.forEach\s*\([^)]*\.find\s*\(/gi // forEach with find inside
    ],
    title: 'Inefficient Nested Loops',
    description:
      'Multiple nested iterations may result in O(n²) or O(n³) complexity',
    recommendation:
      'Consider using hash maps/sets for O(1) lookups, or reduce to single-pass algorithm.',
    severity: 'medium' as const
  },

  // Unnecessary Re-renders (React)
  unnecessaryRenders: {
    patterns: [
      /const\s+\w+\s*=\s*\{[^}]*\}\s*\n[^}]*return\s*\(/gi, // Object literal in render
      /const\s+\w+\s*=\s*\[[^\]]*\]\s*\n[^}]*return\s*\(/gi, // Array literal in render
      /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{/gi // Function defined in component body
    ],
    title: 'Potential Unnecessary Re-renders',
    description:
      'Objects/arrays/functions created on every render cause child components to re-render',
    recommendation:
      'Move outside component, use useMemo, useCallback, or React.memo to prevent unnecessary re-renders.',
    severity: 'medium' as const
  },

  // Memory Leaks - Missing Cleanup
  memoryLeaks: {
    patterns: [
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*setInterval/gis,
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*setTimeout/gis,
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*addEventListener/gis
    ],
    title: 'Potential Memory Leak',
    description:
      'Timers or event listeners may not be cleaned up, causing memory leaks',
    recommendation:
      'Return cleanup function in useEffect: return () => clearInterval(id) or removeEventListener().',
    severity: 'high' as const
  },

  // Blocking Operations
  blockingOperations: {
    patterns: [
      /fs\.readFileSync\s*\(/gi,
      /fs\.writeFileSync\s*\(/gi,
      /child_process\.execSync\s*\(/gi,
      /\.sendSync\s*\(/gi
    ],
    title: 'Blocking Synchronous Operation',
    description: 'Synchronous file/process operations block the event loop',
    recommendation:
      'Use async versions: readFile(), writeFile(), exec() with await.',
    severity: 'high' as const
  },

  // Large Bundle Size
  largeImports: {
    patterns: [
      /import\s+\*\s+as\s+\w+\s+from\s+['"]lodash['"]/gi, // Import entire lodash
      /import\s+\*\s+as\s+\w+\s+from\s+['"]moment['"]/gi,
      /import\s+.*\s+from\s+['"]@material-ui\/core['"]/gi, // Import from barrel file
      /require\s*\(\s*['"]\.\.\/\.\.\/\.\.\//gi // Deep relative imports
    ],
    title: 'Large Library Import',
    description:
      'Importing entire libraries increases bundle size unnecessarily',
    recommendation:
      'Use tree-shakeable imports: import {method} from "lodash/method", or consider lighter alternatives.',
    severity: 'low' as const
  },

  // Inefficient String Operations
  stringConcatInLoop: {
    patterns: [
      /for\s*\([^)]*\)\s*\{[^}]*\w+\s*\+=\s*['"]/gis,
      /while\s*\([^)]*\)\s*\{[^}]*\w+\s*\+=\s*['"]/gis
    ],
    title: 'String Concatenation in Loop',
    description:
      'String concatenation in loops creates many intermediate string objects',
    recommendation:
      'Use array and join: const arr = []; for(...) arr.push(str); return arr.join("")',
    severity: 'medium' as const
  },

  // Unoptimized Database Queries
  missingIndexHints: {
    patterns: [
      /SELECT\s+\*\s+FROM/gi, // SELECT * is inefficient
      /WHERE.*LIKE\s+['"]%/gi // Leading wildcard prevents index use
    ],
    title: 'Unoptimized Database Query',
    description:
      'Query pattern may not use indexes efficiently or fetches unnecessary data',
    recommendation:
      'SELECT only needed columns, avoid leading wildcards in LIKE, ensure proper indexes.',
    severity: 'medium' as const
  },

  // Premature Optimization - Micro-optimizations
  microOptimization: {
    patterns: [
      /\+\+\w+\s*(?:\/\/|\/\*).*(?:faster|performance|optimize)/gi,
      /--\w+\s*(?:\/\/|\/\*).*(?:faster|performance|optimize)/gi
    ],
    title: 'Potential Micro-optimization',
    description:
      'Code comments suggest premature optimization that may reduce readability',
    recommendation:
      'Focus on algorithmic improvements first. Profile before optimizing.',
    severity: 'low' as const
  },

  // Heavy Computation in Render
  heavyComputationInRender: {
    patterns: [
      /return\s*\([^)]*\{[^}]*\.sort\s*\(/gis, // Sort in JSX
      /return\s*\([^)]*\{[^}]*\.filter\s*\([^)]*\.map\s*\(/gis, // Filter+map in JSX
      /return\s*\([^)]*\{[^}]*\.reduce\s*\(/gis // Reduce in JSX
    ],
    title: 'Heavy Computation in Render',
    description:
      'Expensive operations in render function execute on every re-render',
    recommendation:
      'Move computations outside render or use useMemo to cache results.',
    severity: 'medium' as const
  }
}

/**
 * Analyzes code for performance issues
 */
export class PerformanceAnalyzer {
  /**
   * Analyze a file's content for performance issues
   * @param content - The file content to analyze
   * @param filename - The filename (for context)
   * @returns Performance analysis results
   */
  analyzeFile(content: string, filename: string): PerformanceAnalysisResult {
    const issues: PerformanceIssue[] = []
    const lines = content.split('\n')

    // Check each performance pattern
    for (const [category, config] of Object.entries(PERFORMANCE_PATTERNS)) {
      for (const pattern of config.patterns) {
        // For multiline patterns, check entire content
        if (pattern.flags.includes('s')) {
          const match = pattern.test(content)
          if (match && this.shouldReport(category, content, filename)) {
            issues.push({
              severity: config.severity,
              category,
              title: config.title,
              description: config.description,
              recommendation: config.recommendation
            })
          }
          pattern.lastIndex = 0
        } else {
          // For single-line patterns, check each line
          lines.forEach((line, index) => {
            const match = pattern.test(line)
            if (match && this.shouldReport(category, line, filename)) {
              issues.push({
                severity: config.severity,
                category,
                title: config.title,
                description: config.description,
                recommendation: config.recommendation,
                lineNumber: index + 1,
                codeSnippet: line.trim()
              })
            }
            pattern.lastIndex = 0
          })
        }
      }
    }

    // Calculate summary
    const summary = {
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    }

    return {issues, summary}
  }

  /**
   * Determine if an issue should be reported (reduce false positives)
   */
  private shouldReport(
    category: string,
    content: string,
    filename: string
  ): boolean {
    // Skip comments
    const trimmed = content.trim()
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*')
    ) {
      return false
    }

    // Skip test files for some categories
    if (
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('__tests__') ||
      filename.includes('__mocks__')
    ) {
      // Allow performance issues in tests (they're often intentional)
      return false
    }

    // Skip node_modules and build directories
    if (filename.includes('node_modules') || filename.includes('dist/')) {
      return false
    }

    return true
  }

  /**
   * Generate a formatted performance report
   */
  generateReport(result: PerformanceAnalysisResult): string {
    if (result.issues.length === 0) {
      return '✅ No performance issues detected'
    }

    let report = `⚡ **Performance Analysis Results**\n\n`
    report += `**Summary:** ${result.summary.high} high, ${result.summary.medium} medium, ${result.summary.low} low\n\n`

    // Group by severity
    const groupedBySeverity = {
      high: result.issues.filter(i => i.severity === 'high'),
      medium: result.issues.filter(i => i.severity === 'medium'),
      low: result.issues.filter(i => i.severity === 'low')
    }

    for (const [severity, issues] of Object.entries(groupedBySeverity)) {
      if (issues.length === 0) continue

      let emoji = 'ℹ️'
      if (severity === 'high') emoji = '🔴'
      else if (severity === 'medium') emoji = '🟡'

      report += `### ${emoji} ${severity.toUpperCase()} Priority\n\n`

      issues.forEach(issue => {
        report += `**${issue.title}**`
        if (issue.lineNumber) {
          report += ` (Line ${issue.lineNumber})`
        }
        report += `\n`
        report += `- ${issue.description}\n`
        if (issue.codeSnippet) {
          report += `- Code: \`${issue.codeSnippet}\`\n`
        }
        report += `- **Optimization:** ${issue.recommendation}\n\n`
      })
    }

    return report
  }
}
