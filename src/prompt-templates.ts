/**
 * Context-Aware Prompt Templates
 *
 * Provides specialized prompts based on file type and framework
 * to improve review quality and relevance.
 */

import {FileType, Framework, type FileContext} from './file-classifier'

export interface PromptEnhancements {
  additionalContext: string
  focusAreas: string[]
  reviewGuidelines: string
}

/**
 * Generates context-aware prompt enhancements based on file classification
 */
export class PromptTemplateEngine {
  /**
   * Generate prompt enhancements for a given file context
   */
  static generateEnhancements(context: FileContext): PromptEnhancements {
    // Start with base enhancements
    let enhancements: PromptEnhancements = {
      additionalContext: '',
      focusAreas: [],
      reviewGuidelines: ''
    }

    // Add file type specific enhancements
    enhancements = this.mergeEnhancements(
      enhancements,
      this.getFileTypeEnhancements(context.fileType)
    )

    // Add framework specific enhancements
    if (context.framework !== Framework.UNKNOWN) {
      enhancements = this.mergeEnhancements(
        enhancements,
        this.getFrameworkEnhancements(context.framework)
      )
    }

    // Add special context enhancements
    if (context.isApiRoute) {
      enhancements = this.mergeEnhancements(
        enhancements,
        this.getApiRouteEnhancements()
      )
    }

    if (context.isDatabaseCode) {
      enhancements = this.mergeEnhancements(
        enhancements,
        this.getDatabaseEnhancements()
      )
    }

    if (context.isComponent) {
      enhancements = this.mergeEnhancements(
        enhancements,
        this.getComponentEnhancements()
      )
    }

    return enhancements
  }

  /**
   * Get enhancements for file type
   */
  private static getFileTypeEnhancements(
    fileType: FileType
  ): PromptEnhancements {
    switch (fileType) {
      case FileType.TEST:
        return {
          additionalContext:
            'This is a test file. Focus on test quality and coverage.',
          focusAreas: [
            'Test coverage: Are edge cases and error conditions tested?',
            'Test clarity: Are test names descriptive and assertions clear?',
            'Test isolation: Are tests independent and not relying on execution order?',
            'Mock usage: Are mocks and stubs used appropriately?',
            'Performance: Are there any slow or flaky tests?',
            'Assertions: Are assertions specific and meaningful?'
          ],
          reviewGuidelines: `
When reviewing test code:
- Verify that new functionality is adequately tested
- Check for missing edge cases (null, empty, boundary values)
- Ensure error conditions are tested
- Look for test duplication that could be refactored
- Verify that async tests properly await promises
- Check that cleanup/teardown is done correctly
`
        }

      case FileType.CONFIG:
        return {
          additionalContext:
            'This is a configuration file. Focus on correctness and security.',
          focusAreas: [
            'Security: Are credentials or secrets hardcoded?',
            'Correctness: Is the schema/format valid?',
            'Completeness: Are all required fields present?',
            'Environment handling: Are environment-specific values handled correctly?',
            'Documentation: Are non-obvious settings explained?'
          ],
          reviewGuidelines: `
When reviewing configuration files:
- Check for hardcoded secrets (API keys, passwords, tokens)
- Verify that environment variables are used for sensitive data
- Ensure configuration values are valid and type-correct
- Look for deprecated or insecure settings
- Verify that different environments (dev, staging, prod) are handled
`
        }

      case FileType.DOCUMENTATION:
        return {
          additionalContext:
            'This is documentation. Focus on clarity and accuracy.',
          focusAreas: [
            'Clarity: Is the writing clear and easy to understand?',
            'Accuracy: Does it match the actual code behavior?',
            'Completeness: Are all important aspects covered?',
            'Examples: Are code examples correct and helpful?',
            'Formatting: Is markdown/formatting correct?',
            'Links: Are all links valid and relevant?'
          ],
          reviewGuidelines: `
When reviewing documentation:
- Verify that code examples are correct and up-to-date
- Check for typos and grammatical errors
- Ensure technical terms are used correctly
- Verify that instructions are complete and actionable
- Check that links work and point to correct locations
`
        }

      case FileType.SCHEMA:
        return {
          additionalContext:
            'This is a schema definition. Focus on data integrity and constraints.',
          focusAreas: [
            'Data types: Are types appropriate for the data?',
            'Constraints: Are proper constraints defined (NOT NULL, UNIQUE, etc.)?',
            'Relationships: Are foreign keys and relations correct?',
            'Indexes: Are indexes defined for common queries?',
            'Migrations: Is the migration safe and reversible?',
            'Validation: Are validation rules appropriate?'
          ],
          reviewGuidelines: `
When reviewing schema definitions:
- Verify data types are appropriate (avoid overly generic types)
- Check for missing NOT NULL constraints on required fields
- Ensure indexes exist for frequently queried columns
- Verify foreign key constraints are properly defined
- Check for potential performance issues (too many indexes, etc.)
- Ensure migrations are backwards compatible if required
`
        }

      case FileType.MIGRATION:
        return {
          additionalContext:
            'This is a database migration. Focus on safety and reversibility.',
          focusAreas: [
            'Safety: Can this migration run on production without downtime?',
            'Reversibility: Can the migration be rolled back?',
            'Data integrity: Will existing data be handled correctly?',
            'Performance: Will this migration lock tables for too long?',
            'Dependencies: Are migration dependencies correct?'
          ],
          reviewGuidelines: `
When reviewing migrations:
- Ensure migrations are idempotent (can be run multiple times safely)
- Check for data loss scenarios (dropping columns, changing types)
- Verify that down/rollback migrations are provided
- Look for operations that might lock tables for extended periods
- Ensure default values are provided for new NOT NULL columns
- Check for proper transaction handling
`
        }

      case FileType.SOURCE_CODE:
      case FileType.UNKNOWN:
      default:
        return {
          additionalContext:
            'This is source code. Focus on logic, security, and maintainability.',
          focusAreas: [
            'Logic: Is the implementation correct and handle edge cases?',
            'Security: Are there potential vulnerabilities?',
            'Performance: Are there obvious performance issues?',
            'Maintainability: Is the code readable and well-structured?',
            'Error handling: Are errors handled appropriately?',
            'Best practices: Does it follow language/framework conventions?'
          ],
          reviewGuidelines: `
When reviewing source code:
- Focus on logic correctness and edge case handling
- Look for security vulnerabilities (injection, XSS, etc.)
- Check for obvious performance issues (N+1 queries, unnecessary loops)
- Ensure error handling is appropriate
- Verify that naming is clear and follows conventions
`
        }
    }
  }

  /**
   * Get enhancements for framework
   */
  private static getFrameworkEnhancements(
    framework: Framework
  ): PromptEnhancements {
    switch (framework) {
      case Framework.REACT:
        return {
          additionalContext: 'This is a React component.',
          focusAreas: [
            'Hooks: Are hooks used correctly (dependencies, rules of hooks)?',
            'Re-renders: Could this cause unnecessary re-renders?',
            'State management: Is state properly managed?',
            'Side effects: Are useEffect cleanup functions provided?',
            'Props: Are prop types validated?',
            'Accessibility: Are ARIA attributes used where needed?'
          ],
          reviewGuidelines: `
React-specific concerns:
- Verify useEffect dependencies are complete and correct
- Check for missing cleanup in useEffect
- Look for performance issues (missing useMemo/useCallback)
- Ensure hooks follow Rules of Hooks (not in conditionals/loops)
- Check for accessibility issues (keyboard navigation, ARIA labels)
`
        }

      case Framework.VUE:
        return {
          additionalContext: 'This is a Vue component.',
          focusAreas: [
            'Reactivity: Are reactive references used correctly?',
            'Lifecycle: Are lifecycle hooks used appropriately?',
            'Props: Are props properly validated?',
            'Events: Are custom events emitted correctly?',
            'Template syntax: Is v-if/v-for/v-bind used correctly?'
          ],
          reviewGuidelines: `
Vue-specific concerns:
- Verify reactive data is properly declared
- Check that v-for has proper key attributes
- Ensure props are validated with types
- Look for reactivity gotchas (array mutations, etc.)
`
        }

      case Framework.NEXT_JS:
        return {
          additionalContext: 'This is a Next.js page or component.',
          focusAreas: [
            'Data fetching: Is getServerSideProps/getStaticProps used correctly?',
            'Routing: Are dynamic routes handled properly?',
            'SEO: Is metadata properly configured?',
            'Performance: Are images optimized with next/image?',
            'API routes: Are API routes secured and validated?'
          ],
          reviewGuidelines: `
Next.js-specific concerns:
- Verify data fetching methods are appropriate (SSR vs SSG vs ISR)
- Check that API routes have proper authentication
- Ensure images use Next.js Image component for optimization
- Verify metadata is configured for SEO
`
        }

      case Framework.EXPRESS:
        return {
          additionalContext: 'This is an Express.js route handler.',
          focusAreas: [
            'Middleware: Are middleware functions used correctly?',
            'Error handling: Are errors properly caught and handled?',
            'Validation: Is input validated before processing?',
            'Security: Are security best practices followed?',
            'Async handling: Are promises/async-await handled correctly?'
          ],
          reviewGuidelines: `
Express-specific concerns:
- Ensure all async route handlers have error handling
- Verify input validation is performed
- Check for SQL injection and XSS vulnerabilities
- Ensure proper HTTP status codes are used
`
        }

      default:
        return {
          additionalContext: '',
          focusAreas: [],
          reviewGuidelines: ''
        }
    }
  }

  /**
   * Get enhancements for API routes
   */
  private static getApiRouteEnhancements(): PromptEnhancements {
    return {
      additionalContext: 'This file contains API route handlers.',
      focusAreas: [
        'Authentication: Is the route properly protected?',
        'Authorization: Are permissions checked?',
        'Input validation: Are all inputs validated and sanitized?',
        'Error handling: Are errors returned with appropriate status codes?',
        'Rate limiting: Should this route be rate-limited?',
        'Response format: Is the response format consistent?'
      ],
      reviewGuidelines: `
API-specific concerns:
- Verify authentication/authorization is enforced
- Check that all user input is validated and sanitized
- Ensure proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Look for injection vulnerabilities (SQL, NoSQL, command injection)
- Verify rate limiting for sensitive endpoints
- Check for proper CORS configuration
`
    }
  }

  /**
   * Get enhancements for database code
   */
  private static getDatabaseEnhancements(): PromptEnhancements {
    return {
      additionalContext: 'This file contains database operations.',
      focusAreas: [
        'SQL injection: Are queries parameterized?',
        'N+1 queries: Could this cause N+1 query problems?',
        'Indexes: Are appropriate indexes used?',
        'Transactions: Should this use a transaction?',
        'Connection handling: Are connections properly closed?',
        'Query optimization: Are queries efficient?'
      ],
      reviewGuidelines: `
Database-specific concerns:
- Ensure queries use parameterized statements (no string concatenation)
- Look for N+1 query patterns (queries in loops)
- Verify that transactions are used for multi-step operations
- Check for missing indexes on frequently queried columns
- Ensure connection pooling is used appropriately
`
    }
  }

  /**
   * Get enhancements for UI components
   */
  private static getComponentEnhancements(): PromptEnhancements {
    return {
      additionalContext: 'This is a UI component.',
      focusAreas: [
        'Accessibility: Are ARIA labels and roles provided?',
        'Keyboard navigation: Can the component be used with keyboard?',
        'Responsiveness: Does the component work on different screen sizes?',
        'Props: Are prop types/interfaces well-defined?',
        'Reusability: Is the component generic enough to be reused?',
        'Styling: Are styles organized and maintainable?'
      ],
      reviewGuidelines: `
Component-specific concerns:
- Verify keyboard accessibility (Tab navigation, Enter/Space for actions)
- Check for ARIA labels on interactive elements
- Ensure the component handles loading and error states
- Look for hardcoded values that should be props
- Verify that the component is testable
`
    }
  }

  /**
   * Merge two PromptEnhancements objects
   */
  private static mergeEnhancements(
    base: PromptEnhancements,
    additional: PromptEnhancements
  ): PromptEnhancements {
    return {
      additionalContext: [base.additionalContext, additional.additionalContext]
        .filter(Boolean)
        .join(' '),
      focusAreas: [...base.focusAreas, ...additional.focusAreas],
      reviewGuidelines: [base.reviewGuidelines, additional.reviewGuidelines]
        .filter(Boolean)
        .join('\n')
    }
  }

  /**
   * Format enhancements into a prompt string
   */
  static formatEnhancements(enhancements: PromptEnhancements): string {
    const parts: string[] = []

    if (enhancements.additionalContext) {
      parts.push(`## File Context\n\n${enhancements.additionalContext}`)
    }

    if (enhancements.focusAreas.length > 0) {
      parts.push(
        `## Focus Areas\n\n${enhancements.focusAreas
          .map(area => `- ${area}`)
          .join('\n')}`
      )
    }

    if (enhancements.reviewGuidelines) {
      parts.push(`## Review Guidelines\n\n${enhancements.reviewGuidelines}`)
    }

    return parts.join('\n\n')
  }
}
