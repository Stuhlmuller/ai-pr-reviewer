/**
 * File Classification and Framework Detection
 *
 * Classifies files by type (test, config, docs, source) and detects frameworks
 * to enable context-aware prompting for better code reviews.
 */

export enum FileType {
  TEST = 'test',
  CONFIG = 'config',
  DOCUMENTATION = 'documentation',
  SOURCE_CODE = 'source',
  SCHEMA = 'schema',
  MIGRATION = 'migration',
  UNKNOWN = 'unknown'
}

export enum Framework {
  REACT = 'react',
  VUE = 'vue',
  ANGULAR = 'angular',
  SVELTE = 'svelte',
  NEXT_JS = 'nextjs',
  EXPRESS = 'express',
  FASTIFY = 'fastify',
  NEST_JS = 'nestjs',
  DJANGO = 'django',
  FLASK = 'flask',
  RAILS = 'rails',
  SPRING = 'spring',
  UNKNOWN = 'unknown'
}

export interface FileContext {
  filePath: string
  fileType: FileType
  framework: Framework
  isApiRoute: boolean
  isDatabaseCode: boolean
  isComponent: boolean
  confidence: number // 0-1, how confident we are in the classification
}

/**
 * File classifier that detects file types and frameworks
 */
export class FileClassifier {
  // Test file patterns
  private static readonly TEST_PATTERNS = [
    /\.test\.(ts|js|tsx|jsx|py|rb|go|rs|java)$/,
    /\.spec\.(ts|js|tsx|jsx|py|rb|go|rs|java)$/,
    /__tests__\//,
    /\/tests?\//,
    /\/test_/,
    /_test\.(py|go|rs)$/,
    /Test\.(java|kt|swift)$/,
    /Spec\.(rb|scala)$/
  ]

  // Config file patterns
  private static readonly CONFIG_PATTERNS = [
    /^\..*rc(\.json|\.js|\.ts|\.yml|\.yaml)?$/,
    /config\.(json|js|ts|yml|yaml|toml)$/,
    /\.config\.(js|ts|mjs|cjs)$/,
    /^(package|tsconfig|jest\.config|webpack\.config|vite\.config|rollup\.config)\./,
    /^(Dockerfile|docker-compose\.yml|\.dockerignore)$/,
    /\.(yml|yaml|toml|ini|env|properties)$/,
    /\.github\/workflows\//,
    /^(Makefile|Rakefile|Gemfile|Podfile|build\.gradle|pom\.xml)$/
  ]

  // Documentation patterns
  private static readonly DOC_PATTERNS = [
    /\.(md|mdx|txt|rst|adoc)$/,
    /^README/i,
    /^CHANGELOG/i,
    /^CONTRIBUTING/i,
    /^LICENSE/i,
    /\/docs?\//,
    /\.documentation\//
  ]

  // Schema patterns (database, GraphQL, etc.)
  private static readonly SCHEMA_PATTERNS = [
    /\.schema\.(ts|js|graphql|prisma|sql)$/,
    /schema\.(graphql|prisma|sql)$/,
    /\.prisma$/,
    /\.graphql$/,
    /migrations?\//
  ]

  // Migration patterns
  private static readonly MIGRATION_PATTERNS = [
    /migrations?\//,
    /migrate\//,
    /\/\d{4}_\d{2}_\d{2}_.*\.(sql|rb|py|js|ts)$/,
    /^\d{14}_.*\.(rb|js|ts)$/ // Rails-style timestamp migrations
  ]

  // API route patterns
  private static readonly API_ROUTE_PATTERNS = [
    /\/api\//,
    /\/routes?\//,
    /\/endpoints?\//,
    /\/controllers?\//,
    /Controller\.(ts|js|py|rb|java)$/,
    /\/views\.py$/,
    /\/handlers?\//
  ]

  // Database code patterns
  private static readonly DATABASE_PATTERNS = [
    /\/models?\//,
    /\/repositories?\//,
    /\/dao\//,
    /\/entities?\//,
    /Model\.(ts|js|py|rb|java)$/,
    /Repository\.(ts|js|py|rb|java)$/,
    /\.sql$/,
    /query\.(ts|js|py)$/
  ]

  // Component patterns
  private static readonly COMPONENT_PATTERNS = [
    /\/components?\//,
    /\.component\.(ts|js|tsx|jsx)$/,
    /\.vue$/,
    /\.svelte$/
  ]

  // Framework detection patterns (content-based)
  private static readonly FRAMEWORK_IMPORTS: Record<Framework, RegExp[]> = {
    [Framework.REACT]: [
      /import\s+.*\s+from\s+['"]react['"]/,
      /import\s+React/,
      /from\s+['"]react-dom['"]/,
      /@react-/
    ],
    [Framework.VUE]: [
      /import\s+.*\s+from\s+['"]vue['"]/,
      /<template>/,
      /<script\s+setup>/,
      /defineComponent/
    ],
    [Framework.ANGULAR]: [
      /import\s+.*\s+from\s+['"]@angular\//,
      /@Component\(/,
      /@Injectable\(/,
      /@NgModule\(/
    ],
    [Framework.SVELTE]: [/<script>/, /\$:\s+/, /\.svelte$/],
    [Framework.NEXT_JS]: [
      /import\s+.*\s+from\s+['"]next\//,
      /getServerSideProps/,
      /getStaticProps/,
      /\/pages\//,
      /\/app\//
    ],
    [Framework.EXPRESS]: [
      /import\s+.*\s+from\s+['"]express['"]/,
      /require\(['"]express['"]\)/,
      /app\.(get|post|put|delete|patch)/,
      /router\.(get|post|put|delete|patch)/
    ],
    [Framework.FASTIFY]: [
      /import\s+.*\s+from\s+['"]fastify['"]/,
      /require\(['"]fastify['"]\)/,
      /fastify\(\)/
    ],
    [Framework.NEST_JS]: [
      /import\s+.*\s+from\s+['"]@nestjs\//,
      /@Controller\(/,
      /@Injectable\(/,
      /@Module\(/
    ],
    [Framework.DJANGO]: [
      /from\s+django\./,
      /import\s+django/,
      /django\.db\.models/,
      /class.*\(models\.Model\)/
    ],
    [Framework.FLASK]: [
      /from\s+flask\s+import/,
      /import\s+flask/,
      /@app\.route/,
      /Flask\(__name__\)/
    ],
    [Framework.RAILS]: [
      /require\s+['"]rails['"]/,
      /class.*<\s*ApplicationController/,
      /class.*<\s*ActiveRecord::Base/,
      /Rails\.application/
    ],
    [Framework.SPRING]: [
      /import\s+org\.springframework\./,
      /@SpringBootApplication/,
      /@RestController/,
      /@Service/
    ],
    [Framework.UNKNOWN]: []
  }

  /**
   * Classify a file based on path and content
   */
  static classifyFile(filePath: string, content?: string): FileContext {
    const fileType = this.detectFileType(filePath)
    const framework = content
      ? this.detectFramework(filePath, content)
      : Framework.UNKNOWN
    const isApiRoute = this.isApiRoute(filePath)
    const isDatabaseCode = this.isDatabaseCode(filePath)
    const isComponent = this.isComponent(filePath)

    // Calculate confidence based on pattern matches
    let confidence = 0.7 // Base confidence

    // Increase confidence if multiple indicators match
    if (fileType !== FileType.UNKNOWN) {
      confidence += 0.1
    }
    if (framework !== Framework.UNKNOWN && content) {
      confidence += 0.2
    }

    return {
      filePath,
      fileType,
      framework,
      isApiRoute,
      isDatabaseCode,
      isComponent,
      confidence: Math.min(confidence, 1.0)
    }
  }

  /**
   * Detect file type based on path patterns
   */
  private static detectFileType(filePath: string): FileType {
    // Check in priority order
    if (this.matchesAny(filePath, this.TEST_PATTERNS)) {
      return FileType.TEST
    }
    if (this.matchesAny(filePath, this.MIGRATION_PATTERNS)) {
      return FileType.MIGRATION
    }
    if (this.matchesAny(filePath, this.SCHEMA_PATTERNS)) {
      return FileType.SCHEMA
    }
    if (this.matchesAny(filePath, this.CONFIG_PATTERNS)) {
      return FileType.CONFIG
    }
    if (this.matchesAny(filePath, this.DOC_PATTERNS)) {
      return FileType.DOCUMENTATION
    }
    return FileType.SOURCE_CODE
  }

  /**
   * Detect framework from file content and path
   */
  private static detectFramework(filePath: string, content: string): Framework {
    // Check file path for Next.js app/pages directory
    if (/(\/pages\/|\/app\/)/.test(filePath)) {
      if (this.contentMatchesFramework(content, Framework.NEXT_JS)) {
        return Framework.NEXT_JS
      }
    }

    // Check content for framework imports/patterns
    for (const [framework, patterns] of Object.entries(
      this.FRAMEWORK_IMPORTS
    )) {
      if (framework === Framework.UNKNOWN) {
        continue
      }
      if (patterns.some(pattern => pattern.test(content))) {
        return framework as Framework
      }
    }

    return Framework.UNKNOWN
  }

  /**
   * Check if content matches framework patterns
   */
  private static contentMatchesFramework(
    content: string,
    framework: Framework
  ): boolean {
    const patterns = this.FRAMEWORK_IMPORTS[framework]
    return patterns.some(pattern => pattern.test(content))
  }

  /**
   * Check if file is an API route
   */
  private static isApiRoute(filePath: string): boolean {
    return this.matchesAny(filePath, this.API_ROUTE_PATTERNS)
  }

  /**
   * Check if file contains database code
   */
  private static isDatabaseCode(filePath: string): boolean {
    return this.matchesAny(filePath, this.DATABASE_PATTERNS)
  }

  /**
   * Check if file is a component
   */
  private static isComponent(filePath: string): boolean {
    return this.matchesAny(filePath, this.COMPONENT_PATTERNS)
  }

  /**
   * Helper to check if string matches any pattern in array
   */
  private static matchesAny(str: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(str))
  }

  /**
   * Get a human-readable description of the file context
   */
  static describeContext(context: FileContext): string {
    const parts: string[] = []

    if (context.framework !== Framework.UNKNOWN) {
      parts.push(context.framework)
    }

    if (context.isComponent) {
      parts.push('component')
    } else if (context.isApiRoute) {
      parts.push('API route')
    } else if (context.isDatabaseCode) {
      parts.push('database code')
    }

    if (parts.length === 0) {
      parts.push(context.fileType)
    }

    return parts.join(' ')
  }
}
