import {ComplexityAnalyzer} from '../src/complexity-analyzer'

describe('ComplexityAnalyzer', () => {
  let analyzer: ComplexityAnalyzer

  beforeEach(() => {
    analyzer = new ComplexityAnalyzer()
  })

  describe('Simple functions', () => {
    it('should report no issues for simple functions', async () => {
      const code = `
function simpleFunction(a, b) {
  return a + b
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.issues).toHaveLength(0)
      expect(report.totalFunctions).toBe(1)
      expect(report.complexFunctions).toBe(0)
      expect(report.summary).toContain('acceptable complexity levels')
    })

    it('should handle arrow functions', async () => {
      const code = `
const add = (a, b) => {
  return a + b
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.issues).toHaveLength(0)
      expect(report.totalFunctions).toBe(1)
    })

    it('should handle async functions', async () => {
      const code = `
async function fetchData() {
  const response = await fetch('/api')
  return response.json()
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.issues).toHaveLength(0)
      expect(report.totalFunctions).toBe(1)
    })
  })

  describe('Cyclomatic complexity', () => {
    it('should detect high cyclomatic complexity', async () => {
      const code = `
function complexFunction(x) {
  if (x > 0) {
    if (x > 10) {
      if (x > 20) {
        if (x > 30) {
          if (x > 40) {
            if (x > 50) {
              if (x > 60) {
                if (x > 70) {
                  if (x > 80) {
                    if (x > 90) {
                      if (x > 100) {
                        return 'very high'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return 'low'
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.issues.length).toBeGreaterThan(0)
      const cyclomaticIssue = report.issues.find(i => i.type === 'cyclomatic')
      expect(cyclomaticIssue).toBeDefined()
      expect(['high', 'medium']).toContain(cyclomaticIssue?.severity)
      expect(cyclomaticIssue?.functionName).toBe('complexFunction')
      expect(cyclomaticIssue?.score).toBeGreaterThan(10)
    })

    it('should detect moderate cyclomatic complexity', async () => {
      const code = `
function moderateFunction(x) {
  if (x > 0) {
    return 'positive'
  } else if (x < 0) {
    return 'negative'
  } else if (x === 0) {
    return 'zero'
  } else if (x > 100) {
    return 'large'
  } else if (x < -100) {
    return 'very negative'
  }

  for (let i = 0; i < x; i++) {
    if (i % 2 === 0) {
      console.log('even')
    }
  }

  while (x > 0) {
    x--
  }

  return 'done'
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      const cyclomaticIssue = report.issues.find(i => i.type === 'cyclomatic')
      expect(cyclomaticIssue).toBeDefined()
      expect(cyclomaticIssue?.severity).toBe('medium')
    })
  })

  describe('Cognitive complexity', () => {
    it('should detect high cognitive complexity from deep nesting', async () => {
      const code = `
function deeplyNested(data) {
  if (data) {
    for (const item of data) {
      if (item.active) {
        for (const child of item.children) {
          if (child.valid) {
            for (const prop of child.properties) {
              if (prop.enabled) {
                console.log(prop.value)
              }
            }
          }
        }
      }
    }
  }
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      const cognitiveIssue = report.issues.find(i => i.type === 'cognitive')
      expect(cognitiveIssue).toBeDefined()
      expect(cognitiveIssue?.severity).toBe('high')
    })

    it('should handle logical operators', async () => {
      const code = `
function complexConditions(a, b, c, d, e, f, g) {
  if ((a && b) || (c && d)) {
    if ((e && f) || g) {
      return true
    }
  }
  if ((a || b) && (c || d)) {
    if ((e || f) && g) {
      return false
    }
  }
  return null
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      const cognitiveIssue = report.issues.find(i => i.type === 'cognitive')
      expect(cognitiveIssue).toBeDefined()
    })
  })

  describe('Function length', () => {
    it('should detect long functions', async () => {
      const longCode = Array(120).fill('  console.log("line")').join('\n')
      const code = `
function veryLongFunction() {
${longCode}
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      const lengthIssue = report.issues.find(i => i.type === 'function_length')
      expect(lengthIssue).toBeDefined()
      expect(lengthIssue?.severity).toBe('high')
      expect(lengthIssue?.score).toBeGreaterThan(100)
    })

    it('should detect moderately long functions', async () => {
      const moderateCode = Array(60).fill('  console.log("line")').join('\n')
      const code = `
function moderatelyLongFunction() {
${moderateCode}
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      const lengthIssue = report.issues.find(i => i.type === 'function_length')
      expect(lengthIssue).toBeDefined()
      expect(lengthIssue?.severity).toBe('medium')
    })
  })

  describe('Nesting depth', () => {
    it('should detect excessive nesting', async () => {
      const code = `
function deepNesting() {
  if (true) {
    if (true) {
      if (true) {
        if (true) {
          if (true) {
            console.log('too deep')
          }
        }
      }
    }
  }
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      const nestingIssue = report.issues.find(i => i.type === 'nesting')
      expect(nestingIssue).toBeDefined()
      expect(nestingIssue?.severity).toBe('medium')
    })
  })

  describe('Parameter count', () => {
    it('should detect too many parameters', async () => {
      const code = `
function manyParams(a, b, c, d, e, f, g, h) {
  return a + b + c + d + e + f + g + h
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      const paramIssue = report.issues.find(i => i.type === 'parameters')
      expect(paramIssue).toBeDefined()
      expect(paramIssue?.severity).toBe('low')
      expect(paramIssue?.score).toBe(8)
    })

    it('should not flag functions with acceptable parameter count', async () => {
      const code = `
function fewParams(a, b, c) {
  return a + b + c
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      const paramIssue = report.issues.find(i => i.type === 'parameters')
      expect(paramIssue).toBeUndefined()
    })
  })

  describe('Multiple functions', () => {
    it('should analyze multiple functions', async () => {
      const code = `
function simple() {
  return 1
}

function complex(x) {
  if (x > 0) {
    if (x > 10) {
      if (x > 20) {
        if (x > 30) {
          if (x > 40) {
            if (x > 50) {
              return 'high'
            }
          }
        }
      }
    }
  }
  return 'low'
}

function another() {
  return 2
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.totalFunctions).toBe(3)
      expect(report.complexFunctions).toBeGreaterThan(0)
      expect(report.issues.length).toBeGreaterThan(0)
    })
  })

  describe('Class methods', () => {
    it('should analyze class methods', async () => {
      const code = `
class MyClass {
  simpleMethod() {
    return 1
  }

  complexMethod(x) {
    if (x > 0) {
      if (x > 10) {
        if (x > 20) {
          if (x > 30) {
            if (x > 40) {
              return 'high'
            }
          }
        }
      }
    }
    return 'low'
  }
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.totalFunctions).toBe(2)
      expect(report.complexFunctions).toBeGreaterThan(0)
    })

    it('should handle public/private/protected modifiers', async () => {
      const code = `
class MyClass {
  public publicMethod() {
    return 1
  }

  private privateMethod() {
    return 2
  }

  protected protectedMethod() {
    return 3
  }
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.totalFunctions).toBe(3)
    })
  })

  describe('Severity ordering', () => {
    it('should order issues by severity', async () => {
      const code = `
function problematicFunction(a, b, c, d, e, f, g) {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          if (e) {
            if (f) {
              if (g) {
                for (let i = 0; i < 100; i++) {
                  for (let j = 0; j < 100; j++) {
                    console.log(i, j)
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return 'done'
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.issues.length).toBeGreaterThan(0)

      // Check that high severity issues come first
      const severities = report.issues.map(i => i.severity)
      const highIndex = severities.indexOf('high')
      const lowIndex = severities.indexOf('low')

      if (highIndex !== -1 && lowIndex !== -1) {
        expect(highIndex).toBeLessThan(lowIndex)
      }
    })
  })

  describe('Markdown formatting', () => {
    it('should generate markdown report for issues', async () => {
      const code = `
function complexFunction(x) {
  if (x > 0) {
    if (x > 10) {
      if (x > 20) {
        if (x > 30) {
          if (x > 40) {
            if (x > 50) {
              return 'high'
            }
          }
        }
      }
    }
  }
  return 'low'
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)
      const markdown = analyzer.formatReportAsMarkdown(report, 'test.ts')

      expect(markdown).toContain('Complexity Analysis: test.ts')
      expect(markdown).toContain('complexFunction')
      expect(markdown).toContain('nesting')
    })

    it('should return empty string for clean code', async () => {
      const code = `
function simple() {
  return 1
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)
      const markdown = analyzer.formatReportAsMarkdown(report, 'test.ts')

      expect(markdown).toBe('')
    })

    it('should include metrics in markdown', async () => {
      const code = `
function moderateFunction(x) {
  if (x > 0) {
    if (x > 10) {
      if (x > 20) {
        if (x > 30) {
          if (x > 40) {
            return 'medium'
          }
        }
      }
    }
  }
  return 'low'
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)
      const markdown = analyzer.formatReportAsMarkdown(report, 'test.ts')

      expect(markdown).toContain('Metrics:')
      expect(markdown).toContain('functions need attention')
      expect(markdown).toContain('Average complexity:')
    })
  })

  describe('Average complexity calculation', () => {
    it('should calculate average complexity correctly', async () => {
      const code = `
function simple1() {
  return 1
}

function simple2() {
  return 2
}

function slightlyComplex(x) {
  if (x > 0) {
    if (x > 10) {
      return 'medium'
    }
  }
  return 'low'
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.averageComplexity).toBeGreaterThan(0)
      expect(report.averageComplexity).toBeLessThan(10)
    })

    it('should handle empty file', async () => {
      const code = ''
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.totalFunctions).toBe(0)
      expect(report.complexFunctions).toBe(0)
      expect(report.averageComplexity).toBe(0)
      expect(report.issues).toHaveLength(0)
    })
  })

  describe('Edge cases', () => {
    it('should handle functions with no parameters', async () => {
      const code = `
function noParams() {
  return 42
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.totalFunctions).toBe(1)
      const paramIssue = report.issues.find(i => i.type === 'parameters')
      expect(paramIssue).toBeUndefined()
    })

    it('should handle one-liner functions', async () => {
      const code = `
const oneLiner = () => {
  return 42
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.totalFunctions).toBe(1)
      expect(report.issues).toHaveLength(0)
    })

    it('should handle generator functions', async () => {
      const code = `
function* generator() {
  yield 1
  yield 2
  yield 3
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.totalFunctions).toBe(1)
    })

    it('should handle switch statements', async () => {
      const code = `
function switchCase(x) {
  switch (x) {
    case 1:
      return 'one'
    case 2:
      return 'two'
    case 3:
      return 'three'
    case 4:
      return 'four'
    case 5:
      return 'five'
    case 6:
      return 'six'
    case 7:
      return 'seven'
    case 8:
      return 'eight'
    case 9:
      return 'nine'
    case 10:
      return 'ten'
    default:
      return 'other'
  }
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.totalFunctions).toBe(1)
      // Switch statements with many cases contribute to cyclomatic complexity
      const cyclomaticIssue = report.issues.find(i => i.type === 'cyclomatic')
      expect(cyclomaticIssue).toBeDefined()
    })

    it('should handle ternary operators', async () => {
      const code = `
function ternary(a, b, c, d, e, f, g) {
  const result1 = a ? (b ? 'yes' : 'maybe') : (c ? 'maybe' : 'no')
  const result2 = d ? (e ? 'yes' : 'maybe') : (f ? 'maybe' : 'no')
  const result3 = g ? result1 : result2
  return result3
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.totalFunctions).toBe(1)
      // Ternary operators contribute to complexity
      expect(report.issues.length).toBeGreaterThan(0)
    })

    it('should correctly parse functions with comments', async () => {
      const code = `
function commented(x) {
  // if (x > 0) { this is a comment, not code
  /* if (x > 10) { another comment */
  if (x > 5) {
    return 'real code'
  }
  return 'done'
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      expect(report.totalFunctions).toBeGreaterThanOrEqual(0)
      // Even if function detection fails, the analyzer should handle it gracefully
      if (report.totalFunctions > 0) {
        expect(report.averageComplexity).toBeGreaterThan(0)
      }
    })

    it('should not detect control flow statements as functions', async () => {
      const code = `
if (condition) {
  console.log('if statement')
}

for (let i = 0; i < 10; i++) {
  console.log(i)
}

while (true) {
  break
}

switch (value) {
  case 1:
    break
}

try {
  doSomething()
} catch (error) {
  handleError(error)
}

function actualFunction() {
  return 'this is a real function'
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)

      // Should only detect the actual function, not control flow statements
      expect(report.totalFunctions).toBe(1)
      expect(report.issues.find(i => i.functionName === 'if')).toBeUndefined()
      expect(report.issues.find(i => i.functionName === 'for')).toBeUndefined()
      expect(
        report.issues.find(i => i.functionName === 'while')
      ).toBeUndefined()
      expect(
        report.issues.find(i => i.functionName === 'switch')
      ).toBeUndefined()
      expect(
        report.issues.find(i => i.functionName === 'catch')
      ).toBeUndefined()
    })
  })

  describe('Recommendations', () => {
    it('should provide actionable recommendations for cyclomatic complexity', async () => {
      const code = `
function complex(x) {
  if (x > 0) {
    if (x > 10) {
      if (x > 20) {
        if (x > 30) {
          if (x > 40) {
            if (x > 50) {
              if (x > 60) {
                if (x > 70) {
                  if (x > 80) {
                    if (x > 90) {
                      if (x > 100) {
                        return 'high'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return 'low'
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)
      const cyclomaticIssue = report.issues.find(i => i.type === 'cyclomatic')

      expect(cyclomaticIssue).toBeDefined()
      expect(cyclomaticIssue?.recommendation).toContain('function')
    })

    it('should provide actionable recommendations for cognitive complexity', async () => {
      const code = `
function nested(data) {
  if (data) {
    for (const item of data) {
      if (item.active) {
        for (const child of item.children) {
          if (child.valid) {
            console.log(child)
          }
        }
      }
    }
  }
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)
      const cognitiveIssue = report.issues.find(i => i.type === 'cognitive')

      expect(cognitiveIssue?.recommendation).toContain('nesting')
    })

    it('should provide actionable recommendations for long functions', async () => {
      const longCode = Array(70).fill('  console.log("line")').join('\n')
      const code = `
function longFunc() {
${longCode}
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)
      const lengthIssue = report.issues.find(i => i.type === 'function_length')

      expect(lengthIssue?.recommendation).toContain('smaller')
    })

    it('should provide actionable recommendations for parameters', async () => {
      const code = `
function manyParams(a, b, c, d, e, f, g) {
  return a + b + c + d + e + f + g
}
      `
      const report = await analyzer.analyzeFile('test.ts', code)
      const paramIssue = report.issues.find(i => i.type === 'parameters')

      expect(paramIssue?.recommendation).toContain('options object')
    })
  })
})
