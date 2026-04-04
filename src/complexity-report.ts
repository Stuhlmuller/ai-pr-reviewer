import {
  type ComplexityIssue,
  type ComplexityReport
} from './complexity-analyzer'

export function getComplexityRecommendation(
  type: 'cyclomatic' | 'cognitive',
  score: number
): string {
  if (type === 'cyclomatic') {
    return score > 20
      ? 'This function is very complex. Consider breaking it down into smaller functions, each handling a single responsibility. Extract complex conditions into well-named helper functions.'
      : 'Refactor this function by extracting some logic into separate functions. Look for opportunities to simplify conditional logic or use early returns.'
  }

  return score > 30
    ? 'This code is difficult to understand. Reduce nesting depth by using guard clauses and early returns. Extract nested blocks into named functions that clearly express intent.'
    : 'Simplify the logic flow by reducing nesting levels. Consider using guard clauses, extracting nested blocks into functions, or simplifying conditional expressions.'
}

export function generateComplexitySummary(
  totalFunctions: number,
  complexFunctions: number,
  issues: ComplexityIssue[]
): string {
  if (issues.length === 0) {
    return `✅ All ${totalFunctions} functions have acceptable complexity levels`
  }

  const severityCounts = {
    high: issues.filter(issue => issue.severity === 'high').length,
    medium: issues.filter(issue => issue.severity === 'medium').length,
    low: issues.filter(issue => issue.severity === 'low').length
  }
  const parts = Object.entries(severityCounts)
    .filter(([, count]) => count > 0)
    .map(([severity, count]) => `${count} ${severity}`)

  const issueLabel = issues.length > 1 ? 'issues' : 'issue'
  const functionLabel = totalFunctions > 1 ? 'functions' : 'function'
  const severitySuffix =
    parts.length > 0 ? ` (${parts.join(', ')} severity)` : ''

  return `Found ${issues.length} complexity ${issueLabel} in ${complexFunctions} of ${totalFunctions} ${functionLabel}${severitySuffix}`
}

export function formatComplexityReportAsMarkdown(
  report: ComplexityReport,
  filename: string
): string {
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
    const existingIssues = issuesByType.get(issue.type) ?? []
    existingIssues.push(issue)
    issuesByType.set(issue.type, existingIssues)
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
