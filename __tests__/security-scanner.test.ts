import {expect, describe, test} from '@jest/globals'
import {SecurityScanner} from '../src/security-scanner'

describe('SecurityScanner', () => {
  let scanner: SecurityScanner

  beforeEach(() => {
    scanner = new SecurityScanner()
  })

  describe('SQL Injection Detection', () => {
    test('should detect SQL injection with template literals', () => {
      const code = `
        const userId = req.params.id
        const query = \`SELECT * FROM users WHERE id = \${userId}\`
        db.execute(query)
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].severity).toBe('critical')
      expect(result.issues[0].title).toContain('SQL Injection')
    })

    test('should detect SQL injection with string concatenation', () => {
      const code = `
        const query = "SELECT * FROM users WHERE id = " + userId
        db.query(query)
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].severity).toBe('critical')
    })

    test('should not flag parameterized queries', () => {
      const code = `
        const query = "SELECT * FROM users WHERE id = ?"
        db.execute(query, [userId])
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBe(0)
    })
  })

  describe('XSS Detection', () => {
    test('should detect dangerouslySetInnerHTML in React', () => {
      const code = `
        const Comment = ({text}) => {
          return <div dangerouslySetInnerHTML={{__html: text}} />
        }
      `
      const result = scanner.scanFile(code, 'Comment.tsx')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].title).toContain('XSS')
      expect(result.issues[0].severity).toBe('high')
    })

    test('should detect innerHTML with user input', () => {
      const code = `
        element.innerHTML = req.body.content
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].title).toContain('XSS')
    })
  })

  describe('Command Injection Detection', () => {
    test('should detect command injection with template literals', () => {
      const code = `
        const file = req.params.file
        exec(\`cat \${file}\`)
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].severity).toBe('critical')
      expect(result.issues[0].title).toContain('Command Injection')
    })

    test('should detect spawn with user input', () => {
      const code = `
        spawn(\`ls \${userPath}\`)
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })

  describe('Path Traversal Detection', () => {
    test('should detect fs.readFile with user input', () => {
      const code = `
        fs.readFile(req.query.path, (err, data) => {})
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].severity).toBe('high')
      expect(result.issues[0].title).toContain('Path Traversal')
    })

    test('should detect path traversal patterns', () => {
      const code = `
        const filePath = "../../../etc/passwd"
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })

  describe('Hardcoded Secrets Detection', () => {
    test('should detect hardcoded passwords', () => {
      const code = `
        const password = "MySecretPass123"
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].severity).toBe('critical')
      expect(result.issues[0].title).toContain('Secret')
    })

    test('should detect hardcoded API keys', () => {
      const code = `
        const apiKey = "sk-1234567890abcdef"
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
    })

    test('should not flag placeholder secrets', () => {
      const code = `
        const password = "your_password_here"
        const apiKey = "example_key"
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBe(0)
    })

    test('should not flag secrets in test files', () => {
      const code = `
        const password = "TestPassword123"
      `
      const result = scanner.scanFile(code, 'auth.test.js')
      expect(result.issues.length).toBe(0)
    })
  })

  describe('Insecure Random Detection', () => {
    test('should detect Math.random() usage', () => {
      const code = `
        const token = Math.random().toString(36)
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].severity).toBe('medium')
      expect(result.issues[0].title).toContain('Insecure Random')
    })

    test('should allow Math.random() in test files', () => {
      const code = `
        const randomValue = Math.random()
      `
      const result = scanner.scanFile(code, 'utils.test.js')
      expect(result.issues.length).toBe(0)
    })
  })

  describe('Weak Cryptography Detection', () => {
    test('should detect MD5 usage', () => {
      const code = `
        const hash = crypto.createCipher('md5', data)
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].severity).toBe('high')
      expect(result.issues[0].title).toContain('Weak Cryptographic')
    })

    test('should detect SHA1 usage', () => {
      const code = `
        const hash = crypto.createCipher('sha1', data)
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })

  describe('SSRF Detection', () => {
    test('should detect fetch with user-controlled URL', () => {
      const code = `
        const response = await fetch(req.query.url)
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].severity).toBe('high')
      expect(result.issues[0].title).toContain('SSRF')
    })

    test('should detect axios with user input', () => {
      const code = `
        axios(params.endpoint)
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })

  describe('Unsafe Deserialization Detection', () => {
    test('should detect JSON.parse with request data', () => {
      const code = `
        const data = JSON.parse(req.body.data)
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].severity).toBe('high')
      expect(result.issues[0].title).toContain('Deserialization')
    })
  })

  describe('Comment Filtering', () => {
    test('should skip issues in comments', () => {
      const code = `
        // const password = "secret123"
        /* const apiKey = "sk-test" */
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.issues.length).toBe(0)
    })
  })

  describe('Report Generation', () => {
    test('should generate report with no issues', () => {
      const result = {
        issues: [],
        summary: {critical: 0, high: 0, medium: 0, low: 0}
      }
      const report = scanner.generateReport(result)
      expect(report).toContain('No security issues detected')
    })

    test('should generate formatted report with issues', () => {
      const result = {
        issues: [
          {
            severity: 'critical' as const,
            category: 'sqlInjection',
            title: 'SQL Injection',
            description: 'Test issue',
            recommendation: 'Fix it',
            lineNumber: 42
          }
        ],
        summary: {critical: 1, high: 0, medium: 0, low: 0}
      }
      const report = scanner.generateReport(result)
      expect(report).toContain('Security Scan Results')
      expect(report).toContain('CRITICAL')
      expect(report).toContain('SQL Injection')
      expect(report).toContain('Line 42')
    })
  })

  describe('Summary Calculation', () => {
    test('should correctly count issues by severity', () => {
      const code = `
        const password = "secret"
        const query = \`SELECT * FROM users WHERE id = \${userId}\`
        const token = Math.random()
      `
      const result = scanner.scanFile(code, 'test.js')
      expect(result.summary.critical).toBeGreaterThan(0)
      expect(result.summary.medium).toBeGreaterThan(0)
    })
  })
})
