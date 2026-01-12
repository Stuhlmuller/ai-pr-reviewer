/**
 * Security vulnerability scanner for code reviews
 * Detects common security issues and OWASP Top 10 vulnerabilities
 */

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  recommendation: string
  lineNumber?: number
  codeSnippet?: string
}

export interface SecurityScanResult {
  issues: SecurityIssue[]
  summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
}

/**
 * Patterns for detecting security vulnerabilities
 */
const SECURITY_PATTERNS = {
  // SQL Injection
  sqlInjection: {
    patterns: [
      /`.*SELECT.*\$\{/gi, // Template literal with SQL and interpolation
      /`.*INSERT.*\$\{/gi,
      /`.*UPDATE.*\$\{/gi,
      /`.*DELETE.*\$\{/gi,
      /".*SELECT.*"\s*\+/gi, // String concatenation with SQL
      /".*INSERT.*"\s*\+/gi,
      /".*UPDATE.*"\s*\+/gi,
      /".*DELETE.*"\s*\+/gi,
      /cursor\.execute\s*\(\s*f['"]/gi // Python f-string in SQL
    ],
    title: 'Potential SQL Injection',
    description:
      'SQL query appears to use string interpolation or concatenation with user input',
    recommendation:
      'Use parameterized queries or prepared statements instead. Never concatenate user input directly into SQL.',
    severity: 'critical' as const
  },

  // XSS (Cross-Site Scripting)
  xss: {
    patterns: [
      /dangerouslySetInnerHTML\s*=\s*\{\{/gi, // React dangerouslySetInnerHTML
      /innerHTML\s*=\s*[^;]*(?:params|query|input|req\.|user)/gi,
      /\.html\s*\(\s*[^)]*(?:params|query|input|req\.|user)/gi, // jQuery .html()
      /document\.write\s*\(/gi
    ],
    title: 'Potential XSS Vulnerability',
    description:
      'Code may inject unsanitized user input into HTML, risking XSS attacks',
    recommendation:
      'Sanitize user input, use textContent instead of innerHTML, or use framework-provided safe rendering methods.',
    severity: 'high' as const
  },

  // Command Injection
  commandInjection: {
    patterns: [
      /exec\s*\(\s*[`"'].*\$\{/gi,
      /spawn\s*\(\s*[`"'].*\$\{/gi,
      /system\s*\(\s*[`"'].*\+/gi,
      /os\.system\s*\(\s*f['"]/gi // Python
    ],
    title: 'Potential Command Injection',
    description: 'Shell command execution with user-controlled input',
    recommendation:
      'Avoid shell execution with user input. Use safe APIs or validate/sanitize input strictly.',
    severity: 'critical' as const
  },

  // Path Traversal
  pathTraversal: {
    patterns: [
      /fs\.readFile\s*\(\s*(?:req\.|params|query|input)/gi,
      /fs\.readFileSync\s*\(\s*(?:req\.|params|query|input)/gi,
      /open\s*\(\s*(?:request\.|params|input|user)/gi,
      /\.\.[\\/]/g // Literal ../ or ..\
    ],
    title: 'Potential Path Traversal',
    description: 'File system access with user-controlled path',
    recommendation:
      'Validate and sanitize file paths. Use path.resolve() and check that resolved path is within allowed directory.',
    severity: 'high' as const
  },

  // Hardcoded Secrets
  hardcodedSecrets: {
    patterns: [
      /(?:password|passwd|pwd)\s*=\s*[`"'][^`"'\s]+[`"']/gi,
      /(?:api[_-]?key|apikey)\s*=\s*[`"'][^`"'\s]+[`"']/gi,
      /(?:secret|token)\s*=\s*[`"'][^`"'\s]{20,}[`"']/gi,
      /(?:aws_access_key_id|aws_secret_access_key)\s*=\s*[`"']/gi
    ],
    title: 'Hardcoded Secret Detected',
    description: 'Sensitive credential appears to be hardcoded in source code',
    recommendation:
      'Remove hardcoded secrets. Use environment variables or secret management systems.',
    severity: 'critical' as const
  },

  // Insecure Random
  insecureRandom: {
    patterns: [
      /Math\.random\s*\(\s*\)/gi // When used for security purposes
    ],
    title: 'Insecure Random Number Generation',
    description: 'Math.random() is not cryptographically secure',
    recommendation:
      'Use crypto.randomBytes() or crypto.getRandomValues() for security-sensitive random generation.',
    severity: 'medium' as const
  },

  // Weak Cryptography
  weakCrypto: {
    patterns: [
      /createCipher\s*\(\s*[`"'](?:des|rc4|md5|sha1)[`"']/gi,
      /\.update\s*\(\s*[^,)]*,\s*[`"'](?:md5|sha1)[`"']/gi,
      /hashlib\.(?:md5|sha1)\s*\(/gi // Python
    ],
    title: 'Weak Cryptographic Algorithm',
    description: 'Use of deprecated or weak cryptographic algorithm',
    recommendation:
      'Use strong algorithms: AES-256-GCM for encryption, SHA-256 or SHA-3 for hashing.',
    severity: 'high' as const
  },

  // Missing Authentication
  missingAuth: {
    patterns: [
      /router\.[a-z]+\s*\(\s*[`"'][^`"']*[`"']\s*,\s*async\s*\(/gi, // Express route without middleware
      /@(?:Get|Post|Put|Delete|Patch)\s*\(\s*[`"'][^`"']*[`"']\s*\)\s*\n\s*(?!@(?:UseGuards|Auth))/gi // NestJS without guards
    ],
    title: 'Potential Missing Authentication',
    description: 'API endpoint may lack authentication middleware',
    recommendation:
      'Ensure all sensitive endpoints have proper authentication and authorization checks.',
    severity: 'high' as const
  },

  // SSRF (Server-Side Request Forgery)
  ssrf: {
    patterns: [
      /(?:fetch|axios|request)\s*\(\s*(?:req\.|params|query|user)/gi,
      /http\.get\s*\(\s*(?:request\.|params|input)/gi
    ],
    title: 'Potential SSRF Vulnerability',
    description: 'HTTP request with user-controlled URL',
    recommendation:
      'Validate and whitelist allowed domains/IPs. Never allow users to control request URLs directly.',
    severity: 'high' as const
  },

  // Unsafe Deserialization
  unsafeDeserialization: {
    patterns: [
      /JSON\.parse\s*\(\s*(?:req\.|params|query).*\)/gi,
      /pickle\.loads\s*\(/gi, // Python pickle
      /yaml\.load\s*\(\s*[^,)]*\)/gi, // YAML without safe_load
      /unserialize\s*\(/gi // PHP
    ],
    title: 'Unsafe Deserialization',
    description: 'Deserialization of untrusted data',
    recommendation:
      'Use safe deserialization methods (yaml.safe_load), validate input, or use JSON for data exchange.',
    severity: 'high' as const
  }
}

/**
 * Scans code for security vulnerabilities
 */
export class SecurityScanner {
  /**
   * Scan a file's content for security issues
   * @param content - The file content to scan
   * @param filename - The filename (for context)
   * @returns Security scan results
   */
  scanFile(content: string, filename: string): SecurityScanResult {
    const issues: SecurityIssue[] = []
    const lines = content.split('\n')

    // Check each security pattern
    for (const [category, config] of Object.entries(SECURITY_PATTERNS)) {
      for (const pattern of config.patterns) {
        // Scan each line
        lines.forEach((line, index) => {
          const match = pattern.test(line)
          if (match) {
            // Additional context checks to reduce false positives
            if (this.shouldReport(category, line, filename)) {
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
          }
          // Reset regex lastIndex for global regex
          pattern.lastIndex = 0
        })
      }
    }

    // Calculate summary
    const summary = {
      critical: issues.filter(i => i.severity === 'critical').length,
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
    line: string,
    filename: string
  ): boolean {
    // Skip comments
    if (
      line.trim().startsWith('//') ||
      line.trim().startsWith('#') ||
      line.trim().startsWith('/*') ||
      line.trim().startsWith('*')
    ) {
      return false
    }

    // Skip test files for some categories
    if (
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('__tests__')
    ) {
      if (category === 'hardcodedSecrets' || category === 'insecureRandom') {
        return false // Allow test fixtures
      }
    }

    // Hardcoded secrets: skip obvious examples/placeholders
    if (category === 'hardcodedSecrets') {
      const lowerLine = line.toLowerCase()
      if (
        lowerLine.includes('example') ||
        lowerLine.includes('placeholder') ||
        lowerLine.includes('your_') ||
        lowerLine.includes('dummy') ||
        lowerLine.includes('test')
      ) {
        return false
      }
    }

    return true
  }

  /**
   * Generate a formatted security report
   */
  generateReport(result: SecurityScanResult): string {
    if (result.issues.length === 0) {
      return '✅ No security issues detected'
    }

    let report = `🔒 **Security Scan Results**\n\n`
    report += `**Summary:** ${result.summary.critical} critical, ${result.summary.high} high, ${result.summary.medium} medium, ${result.summary.low} low\n\n`

    // Group by severity
    const groupedBySeverity = {
      critical: result.issues.filter(i => i.severity === 'critical'),
      high: result.issues.filter(i => i.severity === 'high'),
      medium: result.issues.filter(i => i.severity === 'medium'),
      low: result.issues.filter(i => i.severity === 'low')
    }

    for (const [severity, issues] of Object.entries(groupedBySeverity)) {
      if (issues.length === 0) continue

      let emoji = 'ℹ️'
      if (severity === 'critical') emoji = '🚨'
      else if (severity === 'high') emoji = '⚠️'
      else if (severity === 'medium') emoji = '⚡'

      report += `### ${emoji} ${severity.toUpperCase()} Severity\n\n`

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
        report += `- **Fix:** ${issue.recommendation}\n\n`
      })
    }

    return report
  }
}
