import {
  PromptTemplateEngine,
  type PromptEnhancements
} from '../src/prompt-templates'
import {FileClassifier} from '../src/file-classifier'

describe('PromptTemplateEngine', () => {
  describe('File Type Enhancements', () => {
    it('should generate enhancements for test files', () => {
      const context = FileClassifier.classifyFile('src/__tests__/utils.test.ts')
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('test file')
      expect(enhancements.focusAreas.length).toBeGreaterThan(0)
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('Test coverage')])
      )
      expect(enhancements.reviewGuidelines).toContain('test')
    })

    it('should generate enhancements for config files', () => {
      const context = FileClassifier.classifyFile('package.json')
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('configuration')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('Security')])
      )
      expect(enhancements.reviewGuidelines).toContain('secret')
    })

    it('should generate enhancements for documentation', () => {
      const context = FileClassifier.classifyFile('README.md')
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('documentation')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('Clarity')])
      )
      expect(enhancements.reviewGuidelines).toContain('typo')
    })

    it('should generate enhancements for schema files', () => {
      const context = FileClassifier.classifyFile('schema.prisma')
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('schema')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('Data types')])
      )
      expect(enhancements.reviewGuidelines).toContain('constraint')
    })

    it('should generate enhancements for migration files', () => {
      const context = FileClassifier.classifyFile(
        'migrations/001_create_users.sql'
      )
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('migration')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('Safety')])
      )
      expect(enhancements.reviewGuidelines).toContain('rollback')
    })

    it('should generate enhancements for source code', () => {
      const context = FileClassifier.classifyFile('src/utils.ts')
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('source code')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('Logic')])
      )
    })
  })

  describe('Framework Enhancements', () => {
    it('should generate React-specific enhancements', () => {
      const content = `import React from 'react';`
      const context = FileClassifier.classifyFile('src/Component.tsx', content)
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('React')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('Hooks')])
      )
      expect(enhancements.reviewGuidelines).toContain('useEffect')
    })

    it('should generate Vue-specific enhancements', () => {
      const content = `import { defineComponent } from 'vue';`
      const context = FileClassifier.classifyFile('src/Component.vue', content)
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('Vue')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('Reactivity')])
      )
    })

    it('should generate Next.js-specific enhancements', () => {
      const content = `
        import { GetServerSideProps } from 'next';
        import Link from 'next/link';
      `
      const context = FileClassifier.classifyFile('pages/index.tsx', content)
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('Next.js')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('Data fetching')])
      )
    })

    it('should generate Express-specific enhancements', () => {
      const content = `import express from 'express';`
      const context = FileClassifier.classifyFile('src/server.ts', content)
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('Express')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('Middleware')])
      )
    })

    it('should not add framework enhancements for unknown frameworks', () => {
      const content = `console.log('hello');`
      const context = FileClassifier.classifyFile('src/utils.ts', content)
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).not.toContain('React')
      expect(enhancements.additionalContext).not.toContain('Vue')
    })
  })

  describe('Special Context Enhancements', () => {
    it('should add API route enhancements', () => {
      const context = FileClassifier.classifyFile('src/api/users.ts')
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('API route')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('Authentication')])
      )
      expect(enhancements.reviewGuidelines).toContain('validated')
    })

    it('should add database code enhancements', () => {
      const context = FileClassifier.classifyFile('src/models/User.ts')
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('database')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('SQL injection')])
      )
      expect(enhancements.reviewGuidelines).toContain('parameterized')
    })

    it('should add component enhancements', () => {
      const context = FileClassifier.classifyFile('src/components/Button.tsx')
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('UI component')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([expect.stringContaining('Accessibility')])
      )
      expect(enhancements.reviewGuidelines).toContain('keyboard')
    })
  })

  describe('Combined Enhancements', () => {
    it('should combine framework and special context enhancements', () => {
      const content = `import React from 'react';`
      const context = FileClassifier.classifyFile(
        'src/components/Button.tsx',
        content
      )
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      // Should have both React and component context
      expect(enhancements.additionalContext).toContain('React')
      expect(enhancements.additionalContext).toContain('component')

      // Should have focus areas from both
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Hooks'), // React
          expect.stringContaining('Accessibility') // Component
        ])
      )
    })

    it('should combine API route and framework enhancements', () => {
      const content = `import express from 'express';`
      const context = FileClassifier.classifyFile('src/api/users.ts', content)
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('Express')
      expect(enhancements.additionalContext).toContain('API route')
      expect(enhancements.focusAreas.length).toBeGreaterThan(5)
    })
  })

  describe('Formatting Enhancements', () => {
    it('should format enhancements into markdown', () => {
      const context = FileClassifier.classifyFile('src/__tests__/utils.test.ts')
      const enhancements = PromptTemplateEngine.generateEnhancements(context)
      const formatted = PromptTemplateEngine.formatEnhancements(enhancements)

      expect(formatted).toContain('## File Context')
      expect(formatted).toContain('## Focus Areas')
      expect(formatted).toContain('## Review Guidelines')
      expect(formatted).toContain('- ') // Bullet points
    })

    it('should handle empty enhancements', () => {
      const emptyEnhancements: PromptEnhancements = {
        additionalContext: '',
        focusAreas: [],
        reviewGuidelines: ''
      }
      const formatted =
        PromptTemplateEngine.formatEnhancements(emptyEnhancements)

      expect(formatted).toBe('')
    })

    it('should format partial enhancements', () => {
      const partialEnhancements: PromptEnhancements = {
        additionalContext: 'Test context',
        focusAreas: [],
        reviewGuidelines: ''
      }
      const formatted =
        PromptTemplateEngine.formatEnhancements(partialEnhancements)

      expect(formatted).toContain('## File Context')
      expect(formatted).not.toContain('## Focus Areas')
      expect(formatted).not.toContain('## Review Guidelines')
    })
  })

  describe('Edge Cases', () => {
    it('should handle files with no special context', () => {
      const context = FileClassifier.classifyFile('src/utils.ts')
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toBeTruthy()
      expect(enhancements.focusAreas.length).toBeGreaterThan(0)
      expect(enhancements.reviewGuidelines).toBeTruthy()
    })

    it('should not duplicate focus areas', () => {
      const context = FileClassifier.classifyFile('src/models/User.ts')
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      const uniqueFocusAreas = new Set(enhancements.focusAreas)
      expect(uniqueFocusAreas.size).toBe(enhancements.focusAreas.length)
    })

    it('should handle very long file paths', () => {
      const longPath =
        'src/features/users/components/profile/settings/security/TwoFactorAuth.component.tsx'
      const context = FileClassifier.classifyFile(longPath)
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements).toBeDefined()
      expect(enhancements.focusAreas.length).toBeGreaterThan(0)
    })
  })

  describe('Real-world Scenarios', () => {
    it('should provide comprehensive guidance for React test files', () => {
      const content = `
        import React from 'react';
        import { render } from '@testing-library/react';
      `
      const context = FileClassifier.classifyFile(
        'src/components/__tests__/Button.test.tsx',
        content
      )
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('test')
      expect(enhancements.additionalContext).toContain('React')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Test coverage'),
          expect.stringContaining('Hooks')
        ])
      )
    })

    it('should provide comprehensive guidance for API controller', () => {
      const content = `
        import express from 'express';
        import { User } from '../models/User';
      `
      const context = FileClassifier.classifyFile(
        'src/api/users/UsersController.ts',
        content
      )
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('Express')
      expect(enhancements.additionalContext).toContain('API route')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Authentication'),
          expect.stringContaining('Validation')
        ])
      )
    })

    it('should provide comprehensive guidance for database migrations', () => {
      const context = FileClassifier.classifyFile(
        'prisma/migrations/20230101_create_users.sql'
      )
      const enhancements = PromptTemplateEngine.generateEnhancements(context)

      expect(enhancements.additionalContext).toContain('migration')
      expect(enhancements.focusAreas).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Safety'),
          expect.stringContaining('Reversibility')
        ])
      )
      expect(enhancements.reviewGuidelines).toContain('idempotent')
    })
  })
})
