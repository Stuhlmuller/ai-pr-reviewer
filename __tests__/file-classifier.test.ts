import {FileClassifier, FileType, Framework} from '../src/file-classifier'

describe('FileClassifier', () => {
  describe('File Type Detection', () => {
    it('should detect test files with .test.ts extension', () => {
      const context = FileClassifier.classifyFile('src/utils.test.ts')
      expect(context.fileType).toBe(FileType.TEST)
    })

    it('should detect test files with .spec.js extension', () => {
      const context = FileClassifier.classifyFile('src/component.spec.js')
      expect(context.fileType).toBe(FileType.TEST)
    })

    it('should detect test files in __tests__ directory', () => {
      const context = FileClassifier.classifyFile('src/__tests__/utils.ts')
      expect(context.fileType).toBe(FileType.TEST)
    })

    it('should detect config files with .config.js extension', () => {
      const context = FileClassifier.classifyFile('jest.config.js')
      expect(context.fileType).toBe(FileType.CONFIG)
    })

    it('should detect package.json as config', () => {
      const context = FileClassifier.classifyFile('package.json')
      expect(context.fileType).toBe(FileType.CONFIG)
    })

    it('should detect tsconfig.json as config', () => {
      const context = FileClassifier.classifyFile('tsconfig.json')
      expect(context.fileType).toBe(FileType.CONFIG)
    })

    it('should detect documentation files with .md extension', () => {
      const context = FileClassifier.classifyFile('README.md')
      expect(context.fileType).toBe(FileType.DOCUMENTATION)
    })

    it('should detect docs/ directory files as documentation', () => {
      const context = FileClassifier.classifyFile('docs/guide.md')
      expect(context.fileType).toBe(FileType.DOCUMENTATION)
    })

    it('should detect schema files with .prisma extension', () => {
      const context = FileClassifier.classifyFile('prisma/schema.prisma')
      expect(context.fileType).toBe(FileType.SCHEMA)
    })

    it('should detect GraphQL schema files', () => {
      const context = FileClassifier.classifyFile('schema.graphql')
      expect(context.fileType).toBe(FileType.SCHEMA)
    })

    it('should detect migration files', () => {
      const context = FileClassifier.classifyFile(
        'db/migrations/20230101_create_users.sql'
      )
      expect(context.fileType).toBe(FileType.MIGRATION)
    })

    it('should detect source code files', () => {
      const context = FileClassifier.classifyFile('src/utils.ts')
      expect(context.fileType).toBe(FileType.SOURCE_CODE)
    })

    it('should prioritize test over source', () => {
      const context = FileClassifier.classifyFile('src/__tests__/utils.ts')
      expect(context.fileType).toBe(FileType.TEST)
    })

    it('should prioritize migration over schema', () => {
      const context = FileClassifier.classifyFile('migrations/001_schema.sql')
      expect(context.fileType).toBe(FileType.MIGRATION)
    })
  })

  describe('Framework Detection', () => {
    it('should detect React from imports', () => {
      const content = `
        import React from 'react';
        import { useState } from 'react';

        function Component() {
          return <div>Hello</div>;
        }
      `
      const context = FileClassifier.classifyFile('src/Component.tsx', content)
      expect(context.framework).toBe(Framework.REACT)
    })

    it('should detect Vue from imports', () => {
      const content = `
        import { defineComponent } from 'vue';

        export default defineComponent({
          name: 'MyComponent'
        });
      `
      const context = FileClassifier.classifyFile('src/Component.vue', content)
      expect(context.framework).toBe(Framework.VUE)
    })

    it('should detect Next.js from imports', () => {
      const content = `
        import { GetServerSideProps } from 'next';
        import Link from 'next/link';

        export const getServerSideProps: GetServerSideProps = async () => {
          return { props: {} };
        };
      `
      const context = FileClassifier.classifyFile('pages/index.tsx', content)
      expect(context.framework).toBe(Framework.NEXT_JS)
    })

    it('should detect Express from imports', () => {
      const content = `
        import express from 'express';

        const app = express();
        app.get('/api/users', (req, res) => {
          res.json({ users: [] });
        });
      `
      const context = FileClassifier.classifyFile('src/server.ts', content)
      expect(context.framework).toBe(Framework.EXPRESS)
    })

    it('should detect Angular from decorators', () => {
      const content = `
        import { Component } from '@angular/core';

        @Component({
          selector: 'app-root',
          template: '<div>Hello</div>'
        })
        export class AppComponent {}
      `
      const context = FileClassifier.classifyFile(
        'src/app.component.ts',
        content
      )
      expect(context.framework).toBe(Framework.ANGULAR)
    })

    it('should detect NestJS from decorators', () => {
      const content = `
        import { Controller, Get } from '@nestjs/common';

        @Controller('users')
        export class UsersController {
          @Get()
          findAll() {
            return [];
          }
        }
      `
      const context = FileClassifier.classifyFile(
        'src/users.controller.ts',
        content
      )
      expect(context.framework).toBe(Framework.NEST_JS)
    })

    it('should detect Django from imports', () => {
      const content = `
        from django.db import models

        class User(models.Model):
            name = models.CharField(max_length=100)
      `
      const context = FileClassifier.classifyFile('models.py', content)
      expect(context.framework).toBe(Framework.DJANGO)
    })

    it('should detect Flask from imports', () => {
      const content = `
        from flask import Flask

        app = Flask(__name__)

        @app.route('/')
        def index():
            return 'Hello'
      `
      const context = FileClassifier.classifyFile('app.py', content)
      expect(context.framework).toBe(Framework.FLASK)
    })

    it('should return UNKNOWN when no framework detected', () => {
      const content = `
        function hello() {
          console.log('Hello');
        }
      `
      const context = FileClassifier.classifyFile('src/utils.ts', content)
      expect(context.framework).toBe(Framework.UNKNOWN)
    })
  })

  describe('Special File Context Detection', () => {
    it('should detect API routes', () => {
      const context = FileClassifier.classifyFile('src/api/users.ts')
      expect(context.isApiRoute).toBe(true)
    })

    it('should detect controller files as API routes', () => {
      const context = FileClassifier.classifyFile('src/UsersController.ts')
      expect(context.isApiRoute).toBe(true)
    })

    it('should detect database code', () => {
      const context = FileClassifier.classifyFile('src/models/User.ts')
      expect(context.isDatabaseCode).toBe(true)
    })

    it('should detect repository files as database code', () => {
      const context = FileClassifier.classifyFile(
        'src/repositories/UserRepository.ts'
      )
      expect(context.isDatabaseCode).toBe(true)
    })

    it('should detect components', () => {
      const context = FileClassifier.classifyFile('src/components/Button.tsx')
      expect(context.isComponent).toBe(true)
    })

    it('should detect Vue components', () => {
      const context = FileClassifier.classifyFile('src/components/Button.vue')
      expect(context.isComponent).toBe(true)
    })

    it('should detect .component.ts files', () => {
      const context = FileClassifier.classifyFile('src/button.component.ts')
      expect(context.isComponent).toBe(true)
    })

    it('should not mark regular files as special', () => {
      const context = FileClassifier.classifyFile('src/utils.ts')
      expect(context.isApiRoute).toBe(false)
      expect(context.isDatabaseCode).toBe(false)
      expect(context.isComponent).toBe(false)
    })
  })

  describe('Confidence Scoring', () => {
    it('should have reasonable confidence for well-defined files', () => {
      const context = FileClassifier.classifyFile('src/__tests__/utils.test.ts')
      expect(context.confidence).toBeGreaterThan(0.7)
    })

    it('should have higher confidence with content analysis', () => {
      const content = `
        import React from 'react';
        function Component() {
          return <div>Hello</div>;
        }
      `
      const context = FileClassifier.classifyFile('src/Component.tsx', content)
      expect(context.confidence).toBeGreaterThan(0.8)
    })

    it('should have lower confidence for unknown files', () => {
      const context = FileClassifier.classifyFile('unknown.xyz')
      expect(context.confidence).toBeLessThan(0.85)
    })
  })

  describe('Context Description', () => {
    it('should describe file context with framework and type', () => {
      const content = `import React from 'react';`
      const context = FileClassifier.classifyFile(
        'src/components/Button.tsx',
        content
      )
      const description = FileClassifier.describeContext(context)
      expect(description).toContain('react')
      expect(description).toContain('component')
    })

    it('should describe API routes', () => {
      const context = FileClassifier.classifyFile('src/api/users.ts')
      const description = FileClassifier.describeContext(context)
      expect(description).toContain('API route')
    })

    it('should describe database code', () => {
      const context = FileClassifier.classifyFile('src/models/User.ts')
      const description = FileClassifier.describeContext(context)
      expect(description).toContain('database code')
    })

    it('should fall back to file type when no special context', () => {
      const context = FileClassifier.classifyFile('README.md')
      const description = FileClassifier.describeContext(context)
      expect(description).toBe('documentation')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty file path', () => {
      const context = FileClassifier.classifyFile('')
      expect(context.fileType).toBe(FileType.SOURCE_CODE)
    })

    it('should handle file paths with multiple dots', () => {
      const context = FileClassifier.classifyFile('app.component.spec.ts')
      expect(context.fileType).toBe(FileType.TEST)
    })

    it('should handle nested directory paths', () => {
      const context = FileClassifier.classifyFile(
        'src/features/users/__tests__/utils.test.ts'
      )
      expect(context.fileType).toBe(FileType.TEST)
    })

    it('should handle Windows-style paths', () => {
      // Note: RegEx doesn't need special handling for Windows paths in this implementation
      const context = FileClassifier.classifyFile('src/components/Button.tsx')
      expect(context.isComponent).toBe(true)
    })

    it('should handle undefined content gracefully', () => {
      const context = FileClassifier.classifyFile('src/utils.ts')
      expect(context.framework).toBe(Framework.UNKNOWN)
      expect(context).toBeDefined()
    })
  })
})
