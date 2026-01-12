/**
 * Complexity Analyzer
 *
 * Analyzes code complexity using multiple metrics:
 * - Cyclomatic Complexity: Measures the number of independent paths through code
 * - Cognitive Complexity: Measures how difficult code is to understand
 * - Maintainability Index: Holistic measure of code maintainability
 *
 * Thresholds:
 * - Cyclomatic Complexity: <= 10 (good), 11-20 (moderate), > 20 (high)
 * - Cognitive Complexity: <= 15 (good), 16-30 (moderate), > 30 (high)
 * - Function Length: <= 50 lines (good), 51-100 (moderate), > 100 (high)
 */

export interface ComplexityIssue {
  type:
    | 'cyclomatic'
    | 'cognitive'
    | 'function_length'
    | 'nesting'
    | 'parameters'
  severity: 'high' | 'medium' | 'low'
  line: number
  endLine?: number
  functionName: string
  message: string
  score: number
  recommendation: string
}

export interface ComplexityReport {
  issues: ComplexityIssue[]
  summary: string
  totalFunctions: number
  complexFunctions: number
  averageComplexity: number
}

interface FunctionInfo {
  name: string
  startLine: number
  endLine: number
  cyclomaticComplexity: number
  cognitiveComplexity: number
  lines: number
  parameters: number
  maxNesting: number
}

/**
 * Analyzes code complexity across multiple dimensions
 */
export class ComplexityAnalyzer {
  private readonly CYCLOMATIC_THRESHOLD_MODERATE = 10
  private readonly CYCLOMATIC_THRESHOLD_HIGH = 20
  private readonly COGNITIVE_THRESHOLD_MODERATE = 15
  private readonly COGNITIVE_THRESHOLD_HIGH = 30
  private readonly LENGTH_THRESHOLD_MODERATE = 50
  private readonly LENGTH_THRESHOLD_HIGH = 100
  private readonly NESTING_THRESHOLD = 4
  private readonly PARAMETER_THRESHOLD = 5

  /**
   * Analyzes a file's complexity and returns issues
   */
  async analyzeFile(
    filename: string,
    content: string
  ): Promise<ComplexityReport> {
    const functions = this.extractFunctions(content)
    const issues: ComplexityIssue[] = []

    for (const func of functions) {
      // Check cyclomatic complexity
      if (func.cyclomaticComplexity > this.CYCLOMATIC_THRESHOLD_MODERATE) {
        issues.push({
          type: 'cyclomatic',
          severity:
            func.cyclomaticComplexity > this.CYCLOMATIC_THRESHOLD_HIGH
              ? 'high'
              : 'medium',
          line: func.startLine,
          endLine: func.endLine,
          functionName: func.name,
          message: `Cyclomatic complexity is ${func.cyclomaticComplexity} (threshold: ${this.CYCLOMATIC_THRESHOLD_MODERATE})`,
          score: func.cyclomaticComplexity,
          recommendation: this.getComplexityRecommendation(
            'cyclomatic',
            func.cyclomaticComplexity
          )
        })
      }

      // Check cognitive complexity
      if (func.cognitiveComplexity > this.COGNITIVE_THRESHOLD_MODERATE) {
        issues.push({
          type: 'cognitive',
          severity:
            func.cognitiveComplexity > this.COGNITIVE_THRESHOLD_HIGH
              ? 'high'
              : 'medium',
          line: func.startLine,
          endLine: func.endLine,
          functionName: func.name,
          message: `Cognitive complexity is ${func.cognitiveComplexity} (threshold: ${this.COGNITIVE_THRESHOLD_MODERATE})`,
          score: func.cognitiveComplexity,
          recommendation: this.getComplexityRecommendation(
            'cognitive',
            func.cognitiveComplexity
          )
        })
      }

      // Check function length
      if (func.lines > this.LENGTH_THRESHOLD_MODERATE) {
        issues.push({
          type: 'function_length',
          severity: func.lines > this.LENGTH_THRESHOLD_HIGH ? 'high' : 'medium',
          line: func.startLine,
          endLine: func.endLine,
          functionName: func.name,
          message: `Function is ${func.lines} lines long (threshold: ${this.LENGTH_THRESHOLD_MODERATE})`,
          score: func.lines,
          recommendation:
            'Consider breaking this function into smaller, focused functions with single responsibilities'
        })
      }

      // Check nesting depth
      if (func.maxNesting > this.NESTING_THRESHOLD) {
        issues.push({
          type: 'nesting',
          severity: 'medium',
          line: func.startLine,
          endLine: func.endLine,
          functionName: func.name,
          message: `Maximum nesting depth is ${func.maxNesting} (threshold: ${this.NESTING_THRESHOLD})`,
          score: func.maxNesting,
          recommendation:
            'Reduce nesting by using early returns, extracting nested logic into separate functions, or using guard clauses'
        })
      }

      // Check parameter count
      if (func.parameters > this.PARAMETER_THRESHOLD) {
        issues.push({
          type: 'parameters',
          severity: 'low',
          line: func.startLine,
          functionName: func.name,
          message: `Function has ${func.parameters} parameters (threshold: ${this.PARAMETER_THRESHOLD})`,
          score: func.parameters,
          recommendation:
            'Consider grouping related parameters into an options object or splitting the function'
        })
      }
    }

    const complexFunctions = functions.filter(
      f =>
        f.cyclomaticComplexity > this.CYCLOMATIC_THRESHOLD_MODERATE ||
        f.cognitiveComplexity > this.COGNITIVE_THRESHOLD_MODERATE
    ).length

    const avgComplexity =
      functions.length > 0
        ? functions.reduce((sum, f) => sum + f.cyclomaticComplexity, 0) /
          functions.length
        : 0

    return {
      issues: issues.sort((a, b) => {
        const severityOrder = {high: 0, medium: 1, low: 2}
        return severityOrder[a.severity] - severityOrder[b.severity]
      }),
      summary: this.generateSummary(functions.length, complexFunctions, issues),
      totalFunctions: functions.length,
      complexFunctions,
      averageComplexity: Math.round(avgComplexity * 10) / 10
    }
  }

  /**
   * Extracts functions and calculates their complexity metrics
   */
  private extractFunctions(content: string): FunctionInfo[] {
    const functions: FunctionInfo[] = []
    const lines = content.split('\n')

    // Regex patterns for different function declarations
    const patterns = [
      // Regular functions: function name(...) or function* name(...)
      /^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s+(\w+)\s*\(([^)]*)\)/,
      // Arrow functions: const name = (...) => or const name = async (...) =>
      /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/,
      // Method definitions: name(...) { or async name(...) {
      /^\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*[:{]/,
      // Class methods: public/private/protected name(...) {
      /^\s*(?:public|private|protected|static)?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*[:{]/
    ]

    let currentFunction: {
      name: string
      startLine: number
      parameters: number
      braceDepth: number
    } | null = null
    let braceDepth = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      // Track brace depth for the entire file
      const openBraces = (line.match(/{/g) || []).length
      const closeBraces = (line.match(/}/g) || []).length
      braceDepth += openBraces - closeBraces

      // Try to match function declarations
      if (!currentFunction) {
        for (const pattern of patterns) {
          const match = line.match(pattern)
          if (match) {
            const funcName = match[1]
            const params = match[2]
            const paramCount = params
              ? params.split(',').filter(p => p.trim()).length
              : 0

            currentFunction = {
              name: funcName,
              startLine: lineNum,
              parameters: paramCount,
              braceDepth: braceDepth
            }
            break
          }
        }
      }

      // If we're in a function and back to starting depth, function ended
      if (
        currentFunction &&
        braceDepth === currentFunction.braceDepth - 1 &&
        closeBraces > 0
      ) {
        const endLine = lineNum
        const functionLines = lines.slice(
          currentFunction.startLine - 1,
          endLine
        )
        const functionBody = functionLines.join('\n')

        functions.push({
          name: currentFunction.name,
          startLine: currentFunction.startLine,
          endLine: endLine,
          cyclomaticComplexity:
            this.calculateCyclomaticComplexity(functionBody),
          cognitiveComplexity: this.calculateCognitiveComplexity(functionBody),
          lines: functionLines.length,
          parameters: currentFunction.parameters,
          maxNesting: this.calculateMaxNesting(functionBody)
        })

        currentFunction = null
      }
    }

    return functions
  }

  /**
   * Calculates cyclomatic complexity (number of decision points + 1)
   */
  private calculateCyclomaticComplexity(code: string): number {
    let complexity = 1 // Base complexity

    // Count decision points
    const decisionPoints = [
      /\bif\s*\(/g, // if statements
      /\belse\s+if\s*\(/g, // else if
      /\bfor\s*\(/g, // for loops
      /\bwhile\s*\(/g, // while loops
      /\bcase\s+/g, // switch cases
      /\bcatch\s*\(/g, // catch blocks
      /\?\s*.*\s*:/g, // ternary operators
      /&&/g, // logical AND
      /\|\|/g // logical OR
    ]

    for (const pattern of decisionPoints) {
      const matches = code.match(pattern)
      if (matches) {
        complexity += matches.length
      }
    }

    return complexity
  }

  /**
   * Calculates cognitive complexity (how hard code is to understand)
   */
  private calculateCognitiveComplexity(code: string): number {
    let complexity = 0
    let nestingLevel = 0
    const lines = code.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // Increase nesting for opening braces
      if (trimmed.includes('{')) {
        nestingLevel++
      }

      // Structural complexity with nesting multiplier
      if (
        /\b(if|for|while|switch|catch)\b/.test(trimmed) &&
        !trimmed.startsWith('//')
      ) {
        complexity += 1 + nestingLevel
      }

      // Else/else if adds complexity
      if (/\belse\s+(if\s*\()?/.test(trimmed)) {
        complexity += 1
      }

      // Nested ternary operators
      if (/\?.*:/.test(trimmed)) {
        complexity += nestingLevel > 0 ? nestingLevel + 1 : 1
      }

      // Logical operators in conditions
      const logicalOps = (trimmed.match(/&&|\|\|/g) || []).length
      if (logicalOps > 0) {
        complexity += logicalOps
      }

      // Decrease nesting for closing braces
      if (trimmed.includes('}')) {
        nestingLevel = Math.max(0, nestingLevel - 1)
      }
    }

    return complexity
  }

  /**
   * Calculates maximum nesting depth
   */
  private calculateMaxNesting(code: string): number {
    let maxNesting = 0
    let currentNesting = 0

    for (const char of code) {
      if (char === '{') {
        currentNesting++
        maxNesting = Math.max(maxNesting, currentNesting)
      } else if (char === '}') {
        currentNesting = Math.max(0, currentNesting - 1)
      }
    }

    return maxNesting
  }

  /**
   * Generates recommendations based on complexity type and score
   */
  private getComplexityRecommendation(
    type: 'cyclomatic' | 'cognitive',
    score: number
  ): string {
    if (type === 'cyclomatic') {
      if (score > 20) {
        return 'This function is very complex. Consider breaking it down into smaller functions, each handling a single responsibility. Extract complex conditions into well-named helper functions.'
      } else {
        return 'Refactor this function by extracting some logic into separate functions. Look for opportunities to simplify conditional logic or use early returns.'
      }
    } else {
      // cognitive
      if (score > 30) {
        return 'This code is difficult to understand. Reduce nesting depth by using guard clauses and early returns. Extract nested blocks into named functions that clearly express intent.'
      } else {
        return 'Simplify the logic flow by reducing nesting levels. Consider using guard clauses, extracting nested blocks into functions, or simplifying conditional expressions.'
      }
    }
  }

  /**
   * Generates a summary of the complexity analysis
   */
  private generateSummary(
    totalFunctions: number,
    complexFunctions: number,
    issues: ComplexityIssue[]
  ): string {
    if (issues.length === 0) {
      return `✅ All ${totalFunctions} functions have acceptable complexity levels`
    }

    const highSeverity = issues.filter(i => i.severity === 'high').length
    const mediumSeverity = issues.filter(i => i.severity === 'medium').length
    const lowSeverity = issues.filter(i => i.severity === 'low').length

    let summary = `Found ${issues.length} complexity issue${
      issues.length > 1 ? 's' : ''
    } in ${complexFunctions} of ${totalFunctions} function${
      totalFunctions > 1 ? 's' : ''
    }`

    const parts: string[] = []
    if (highSeverity > 0) parts.push(`${highSeverity} high`)
    if (mediumSeverity > 0) parts.push(`${mediumSeverity} medium`)
    if (lowSeverity > 0) parts.push(`${lowSeverity} low`)

    if (parts.length > 0) {
      summary += ` (${parts.join(', ')} severity)`
    }

    return summary
  }

  /**
   * Formats complexity report as markdown for PR comments
   */
  formatReportAsMarkdown(report: ComplexityReport, filename: string): string {
    if (report.issues.length === 0) {
      return ''
    }

    let markdown = `\n### 📊 Complexity Analysis: ${filename}\n\n`
    markdown += `${report.summary}\n\n`

    if (report.totalFunctions > 0) {
      markdown += `**Metrics:** ${report.complexFunctions}/${report.totalFunctions} functions need attention • Average complexity: ${report.averageComplexity}\n\n`
    }

    const issuesByType = new Map<string, ComplexityIssue[]>()
    for (const issue of report.issues) {
      const key = issue.type
      if (!issuesByType.has(key)) {
        issuesByType.set(key, [])
      }
      issuesByType.get(key)!.push(issue)
    }

    for (const [type, issues] of issuesByType) {
      const typeLabel = {
        cyclomatic: 'Cyclomatic Complexity',
        cognitive: 'Cognitive Complexity',
        function_length: 'Function Length',
        nesting: 'Nesting Depth',
        parameters: 'Parameter Count'
      }[type]

      markdown += `**${typeLabel}:**\n`
      for (const issue of issues) {
        const icon = {high: '🔴', medium: '🟡', low: '🔵'}[issue.severity]
        markdown += `- ${icon} \`${issue.functionName}\` (line ${issue.line}): ${issue.message}\n`
        markdown += `  - ${issue.recommendation}\n`
      }
      markdown += '\n'
    }

    return markdown
  }
}
