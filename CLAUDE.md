# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

**CodeReviewer** is a GitHub Action that provides AI-powered code review and PR
summarization using OpenAI's language models. It runs on pull requests and
delivers intelligent, contextual code reviews with incremental processing to
minimize costs.

## Test-Driven Development (TDD)

**CRITICAL: This project follows strict Test-Driven Development (TDD)
practices.**

### TDD Workflow (Red-Green-Refactor)

**ALWAYS follow this cycle when implementing new features or fixing bugs:**

1. **🔴 RED - Write a failing test first**

   - Write tests in `__tests__/` directory with `*.test.ts` naming pattern
   - Test should fail because the feature doesn't exist yet
   - Run `npm test` to verify the test fails
   - Commit the failing test

2. **🟢 GREEN - Write minimal code to make the test pass**

   - Implement only enough code to make the test pass
   - Don't add extra features or "nice-to-haves"
   - Run `npm test` to verify the test passes
   - Commit the implementation

3. **🔵 REFACTOR - Improve the code while keeping tests green**
   - Clean up code, improve readability, extract functions
   - Run `npm test` after each change to ensure tests still pass
   - Run `qlty fmt` and `qlty check` for code quality
   - Commit the refactored code

**Example TDD Session:**

```bash
# 1. RED: Write failing test
# Edit __tests__/new-feature.test.ts
npm test                           # Verify test fails
git add __tests__/new-feature.test.ts
git commit -m "test: add failing test for new feature"

# 2. GREEN: Implement feature
# Edit src/new-feature.ts
npm test                           # Verify test passes
git add src/new-feature.ts
git commit -m "feat: implement new feature to pass test"

# 3. REFACTOR: Clean up code
# Refactor src/new-feature.ts
npm test                           # Verify tests still pass
qlty fmt                          # Format code
git add src/new-feature.ts
git commit -m "refactor: improve new feature code quality"
```

### TDD Rules (NEVER VIOLATE THESE)

1. **❌ NEVER write production code without a failing test first**
2. **❌ NEVER write more than one failing test at a time**
3. **❌ NEVER write more production code than needed to pass the test**
4. **✅ ALWAYS commit after each RED-GREEN-REFACTOR cycle**
5. **✅ ALWAYS aim for 80%+ test coverage on new code**
6. **✅ ALWAYS run tests before committing**

### TDD Benefits

- **Confidence**: Know your code works before you write it
- **Design**: Tests force you to think about the API first
- **Documentation**: Tests serve as living documentation
- **Regression Prevention**: Catch bugs before they reach production
- **Refactoring Safety**: Change code confidently with test safety net

## Key Commands

### Development Workflow

```bash
# Install dependencies
npm install

# Build TypeScript and prepare distribution
npm run build           # Compiles TypeScript to lib/ and copies tiktoken WASM file
npm run package        # Bundles with ncc to dist/

# Full development build and package
npm run build && npm run package

# Code quality
npm run format         # Auto-format with Prettier
npm run format-check   # Check formatting without changes
npm run lint          # Run ESLint on src/**/*.ts

# Testing (ALWAYS RUN FIRST in TDD)
npm test              # Run Jest tests
npm run test:coverage # Run tests with coverage report

# Complete pipeline (build, format, lint, package, test)
npm run all
```

### Testing Workflow (TDD-First)

**ALWAYS start with tests:**

1. **Create test file first**: `__tests__/<feature>.test.ts`
2. **Write failing test**: Test the behavior you want to implement
3. **Run test**: `npx jest __tests__/<feature>.test.ts` (should fail)
4. **Implement code**: Write minimal code to pass the test
5. **Run test again**: Test should now pass
6. **Refactor**: Clean up code while keeping tests green
7. **Check coverage**: `npm run test:coverage` (target 80%+)

**Test file locations:**

- Tests are in `__tests__/` directory with `*.test.ts` naming pattern
- Jest configuration: `jest.config.json`
- Coverage reports: generated in `coverage/` directory
- Run single test: `npx jest __tests__/<test-file>.test.ts`
- Run tests in watch mode: `npx jest --watch` (useful during TDD)

### Quality Checks (REQUIRED Before Every Commit)

**ALWAYS run in this order:**

```bash
# 1. TESTS FIRST (TDD requirement)
npm test                                       # All tests must pass
npm run test:coverage                         # Check coverage (target 80%+)

# 2. Format code
qlty fmt                                      # Auto-format code

# 3. Lint and fix errors
qlty check <changed_files> --fix --level=low # Lint and fix errors

# 4. Check for code smells
qlty smells <changed_files>                   # Check for code smells

# 5. Full build validation
npm run all                                   # Build, format, lint, package, test
```

**Quick command to run all checks:**

```bash
npm test && qlty fmt && qlty check $(git diff --name-only | grep '\.ts$') --fix --level=low && qlty smells $(git diff --name-only | grep '\.ts$') && npm run all
```

### Local Testing with Act

```bash
npm run act  # Build, package, and run GitHub Action locally with Act
```

## Architecture Overview

### Entry Point and Flow

1. **main.ts**: Entry point that:

   - Creates two Bot instances: `lightBot` (gpt-3.5-turbo for summaries) and
     `heavyBot` (gpt-4 for reviews)
   - Routes to `codeReview()` for PR events or `handleReviewComment()` for
     comment events
   - Handles uncaught errors and rejections

2. **Review Flow** (review.ts):
   - Determines highest reviewed commit ID from previous summaries
   - Fetches incremental diff (base to current HEAD)
   - Filters files by path patterns and max_files limit
   - **Summary Phase** (lightBot): Summarizes each file, triages as
     NEEDS_REVIEW/APPROVED
   - **Review Phase** (heavyBot): Generates line-by-line review comments for
     files needing review
   - Posts summary comment and review comments to PR

### Core Components

**Bot (bot.ts)**

- Wraps ChatGPT API with retry logic (using `p-retry`)
- Manages conversation state (parentMessageId, conversationId)
- Enforces token limits and timeout settings
- Dual-model architecture: light model for summaries, heavy model for detailed
  reviews

**Commenter (commenter.ts)**

- Handles all GitHub comment operations via Octokit
- Manages HTML comment tags for tracking (SUMMARIZE_TAG, COMMENT_TAG, etc.)
- Updates in-progress status on PRs
- Tracks reviewed commit IDs in comment metadata
- Creates, updates, or replaces comments based on tags

**Options (options.ts)**

- Centralized configuration from action inputs
- Path filtering using `minimatch` patterns
- Token limits for light and heavy models
- Validation and logging of all configuration

**Prompts (prompts.ts)**

- Template rendering with variable substitution
- System message, summarization, and release notes prompts
- Review comment prompt generation with context

**Tokenizer (tokenizer.ts)**

- Uses `@dqbd/tiktoken` for accurate OpenAI token counting
- WASM file copied during build:
  `cp node_modules/@dqbd/tiktoken/tiktoken_bg.wasm dist/`

### Key Patterns

**Incremental Reviews**

- Tracks reviewed commit IDs in PR comments using HTML tags
- Only reviews changes between highest reviewed commit and current HEAD
- Reduces API costs and noise

**Concurrency Control**

- Uses `p-limit` for concurrent API calls
- Separate limits for OpenAI API and GitHub API
- Configurable via `openai_concurrency_limit` and `github_concurrency_limit`

**Error Handling**

- Graceful degradation: continue processing if individual files fail
- Clear error reporting in PR status messages
- Debug mode for verbose logging

## Configuration

### Action Inputs (action.yml)

Key configurable parameters:

- `openai_light_model` / `openai_heavy_model`: Model selection
- `system_message`: Custom system prompt for code reviews
- `path_filters`: Include/exclude patterns for files
- `review_simple_changes`: Review trivial changes (default: false)
- `review_comment_lgtm`: Comment when LGTM (default: false)
- `disable_review` / `disable_release_notes`: Control features
- `openai_base_url`: Support for custom OpenAI API endpoints

### Environment Variables

- `GITHUB_TOKEN`: Required for PR comment access
- `OPENAI_API_KEY`: Required for OpenAI API access
- `OPENAI_API_ORG`: Optional organization ID

## Important Constraints

### Review Philosophy

- Focus on **substance over style**: logic, security, performance, data races,
  error handling, best practices
- Skip minor issues: code style, missing comments/documentation, cosmetic
  changes
- Use dual-model approach: light model for summaries (cheap), heavy model for
  reviews (expensive but thorough)

### Response Format Requirements

- Review comments: `{startLine}-{endLine}: {comment}` separated by `---`
- Code blocks: Use language-specific fenced blocks (no line numbers)
- Fix suggestions: Use `diff` blocks (NOT GitHub suggestion blocks)

### Token Management

- Respect model-specific token limits (defined in limits.ts)
- Split large diffs when approaching limits
- Include existing comment chains within token budget

## Project Constitution

This project has a comprehensive constitution at
`.specify/memory/constitution.md` that defines:

- Core purpose and fundamental principles
- Architecture and design patterns
- Behavioral guidelines for reviews and summaries
- Configuration philosophy
- User privacy and security considerations
- Maintenance guidelines for legacy maintenance mode

Refer to the constitution for detailed guidance on architectural decisions and
implementation standards.

## Spec-Driven Development + TDD

The project combines spec-driven workflow with Test-Driven Development:

**Spec-Driven Planning:**

- Feature specifications under `specs/` with templates in `.specify/templates/`
- User stories and acceptance criteria
- Implementation plans with step-by-step tasks
- Checklists for requirements validation
- Task breakdowns with priorities

**TDD Implementation:**

1. Read the spec to understand requirements
2. Write tests based on acceptance criteria (RED)
3. Implement minimal code to pass tests (GREEN)
4. Refactor for quality (REFACTOR)
5. Repeat until all acceptance criteria are met

**Example workflow:**

```bash
# 1. Read spec at specs/new-feature.md
# 2. Write tests based on acceptance criteria
# 3. Implement using TDD cycle
# 4. Update spec with completion status
```

## TypeScript Configuration

- Target: ESNext
- Module: ESNext with bundler resolution
- Strict mode enabled
- Output: `lib/` (TypeScript compilation), `dist/` (ncc bundle)
- Test files excluded from compilation

## GitHub Actions Integration

The action is designed to run on:

- `pull_request` or `pull_request_target` events → triggers `codeReview()`
- `pull_request_review_comment` events → triggers `handleReviewComment()`

Main workflow file: `.github/workflows/openai-review.yml`

## Pre-Commit Checklist (TDD-First)

**CRITICAL: Follow this checklist before EVERY commit:**

1. **✅ Tests written FIRST** (TDD requirement)

   - Did you write a failing test before writing code?
   - Are all tests passing? Run `npm test`
   - Is coverage 80%+? Run `npm run test:coverage`

2. **✅ Code formatted**

   - Run `qlty fmt` to auto-format

3. **✅ No lint errors**

   - Run `qlty check <path_to_changed_files> --fix --level=low`
   - Replace `<path_to_changed_files>` with actual paths (use
     `git diff --name-only`)

4. **✅ No code smells**

   - Run `qlty smells <path_to_changed_files>`

5. **✅ Build successful**

   - Run `npm run all` (build, format, lint, package, test)

6. **✅ Commit message follows convention**
   - Use conventional commits: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`,
     `chore:`

**Remember: Test-Driven Development (TDD) is NOT optional. Write tests FIRST,
then code.**
