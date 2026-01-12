# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

**CodeReviewer** is a GitHub Action that provides AI-powered code review and PR
summarization using OpenAI's language models. It runs on pull requests and
delivers intelligent, contextual code reviews with incremental processing to
minimize costs.

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

# Testing
npm test              # Run Jest tests
npm run test:coverage # Run tests with coverage report

# Complete pipeline (build, format, lint, package, test)
npm run all
```

### Testing Workflow

- Tests are in `__tests__/` directory with `*.test.ts` naming pattern
- Jest configuration: `jest.config.json`
- Coverage reports: generated in `coverage/` directory
- Run single test: `npx jest __tests__/<test-file>.test.ts`

### Quality Checks (AGENTS.md requirements)

Before committing, always run:

```bash
qlty fmt                                        # Auto-format code
qlty check <changed_files> --fix --level=low  # Lint and fix errors
qlty smells <changed_files>                   # Check for code smells
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

## Spec-Driven Development

The project uses a spec-driven workflow under `specs/` with templates in
`.specify/templates/`:

- Feature specifications with user stories and acceptance criteria
- Implementation plans with step-by-step tasks
- Checklists for requirements validation
- Task breakdowns with priorities

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

- Before committing, ALWAYS run auto-formatting with `qlty fmt`
- Before finishing, ALWAYS run
  `qlty check <path_to_changed_files> --fix --level=low` and fix any lint
  errors. Replace `<path_to_changed_files>` with the actual path(s) to your
  changed files (you can use `git diff --name-only` to find changed files).
- Before finishing, ALWAYS run `qlty smells <path_to_changed_files>` and fix any
  alerts. Replace `<path_to_changed_files>` with the actual path(s) to your
  changed files (you can use `git diff --name-only` to find changed files).
