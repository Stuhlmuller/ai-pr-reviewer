# AI PR Reviewer - Master Plan

## Project Overview

This is an AI-based PR reviewer that uses OpenAI's GPT models to review GitHub
pull requests, provide line-by-line feedback, and generate summaries.

**Current Status:**

- TypeScript codebase with GitHub Actions integration
- Tests passing (20% coverage)
- Core functionality: PR summarization, line-by-line reviews, incremental
  reviews
- Uses GPT-3.5-turbo for summaries, GPT-4 for detailed reviews

## Strategic Goals

### 1. Code Quality & Testing (Priority: HIGH)

- [ ] Increase test coverage from 20% to 80%+
- [ ] Add end-to-end tests for GitHub Actions workflow
- [ ] Add integration tests with OpenAI API (mocked)
- [ ] Test review.ts and review-comment.ts (complex files with low coverage)
- [ ] Add CI/CD checks for test coverage

### 2. Feature Enhancements (Priority: MEDIUM)

- [ ] Support for multiple AI providers (Anthropic Claude, Azure OpenAI, local
      models)
- [ ] Custom review rules/guidelines per repository
- [ ] Security vulnerability detection
- [ ] Performance analysis (complexity, best practices)
- [ ] Support for multiple languages/frameworks
- [ ] Configurable review depth/aggressiveness
- [ ] Review summary dashboard/metrics

### 3. User Experience (Priority: MEDIUM)

- [ ] Better documentation with examples
- [ ] Interactive configuration wizard
- [ ] Review quality feedback mechanism
- [ ] Customizable review templates
- [ ] Better error messages and debugging
- [ ] Rate limiting and retry logic improvements

### 4. Infrastructure & DevOps (Priority: HIGH)

- [ ] Automated releases with semantic versioning
- [ ] Better GitHub Actions workflow
- [ ] Performance monitoring
- [ ] Cost tracking for OpenAI API usage
- [ ] Automated dependency updates
- [ ] Security scanning

### 5. Code Improvements (Priority: MEDIUM)

- [ ] Refactor large files (commenter.ts, review.ts)
- [ ] Better error handling
- [ ] Improve type safety
- [ ] Add JSDoc comments
- [ ] Performance optimizations
- [ ] Better logging

## Immediate Next Steps

1. **Test Coverage** - Add comprehensive tests for core review logic
2. **Documentation** - Improve setup guides and examples
3. **Multi-provider Support** - Add Anthropic Claude support
4. **Security Scanning** - Add basic vulnerability detection
5. **CI/CD** - Improve GitHub Actions workflows

## Work Rules

- Commit and push after every file edit
- Open PRs when new features are complete and tests pass
- Store plans and todos in .agent/ directory
- Focus 80% on implementation, 20% on testing
- Use gh CLI for PR management

## Current Branch

- Working on: ralph
- Main branch: main
