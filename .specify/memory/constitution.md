<!--
  Sync Impact Report:
  Version change: (none) → 1.0.0 (initial structured version)
  Added sections: Governance metadata header, Governance section
  Modified principles: None
  Templates requiring updates:
    - ✅ .specify/templates/plan-template.md (already references constitution)
    - ✅ .specify/templates/spec-template.md (no direct references)
    - ✅ .specify/templates/tasks-template.md (no direct references)
  Follow-up TODOs: None
-->

# CodeRabbit AI-PR-Reviewer Constitution

**Version**: 1.0.0  
**Ratified**: 2025-01-27  
**Last Amended**: 2025-01-27

## Project Identity

You are working on **CodeRabbit ai-pr-reviewer**, an AI-powered GitHub Action
that provides automated code review and PR summarization using OpenAI's language
models. This project is a GitHub Action designed to run on pull requests and
provide intelligent, contextual code reviews.

**Note**: This is a legacy/maintenance mode version. The project recommends
users upgrade to CodeRabbit Pro for enhanced features, but this codebase remains
functional and maintainable.

## Core Purpose

The primary mission is to provide:

1. **Automated PR Summarization**: Generate concise summaries and release notes
   for pull requests
2. **Intelligent Code Review**: Provide line-by-line code review with actionable
   suggestions
3. **Incremental Review Capability**: Only review new commits since the last
   review, reducing costs and noise
4. **Interactive Conversation**: Support chat-based interactions with the bot in
   the context of code changes
5. **Cost Optimization**: Use a dual-model approach (light model for summaries,
   heavy model for reviews) to balance quality and cost

## Fundamental Principles

### 1. Cost-Efficiency and Performance

- **Incremental Reviews**: Always track reviewed commit IDs and only process new
  changes
- **Dual-Model Architecture**: Use `gpt-3.5-turbo` (light) for summarization and
  `gpt-4` (heavy) for detailed reviews
- **Token Management**: Respect token limits for each model and split large
  diffs appropriately
- **Smart Filtering**: Skip reviews for trivial changes (typos, formatting)
  unless explicitly enabled
- **Concurrency Control**: Use configurable limits for both OpenAI and GitHub
  API calls

### 2. Focus on Substance Over Style

- **Review Philosophy**: Focus on logic, security, performance, data races,
  error handling, maintainability, and best practices
- **Skip Minor Issues**: Do not comment on minor code style issues, missing
  comments, or documentation unless they affect functionality
- **LGTM Recognition**: Skip posting comments when changes are approved (LGTM),
  unless explicitly configured otherwise

### 3. User Experience and Interactivity

- **Incremental Processing**: Show in-progress status updates on the PR
- **Conversational Interface**: Support replies to review comments and tag-based
  interactions (`@coderabbitai`)
- **Opt-Out Mechanism**: Respect `@coderabbitai: ignore` in PR descriptions
- **Clear Status Reporting**: Provide detailed status messages about files
  processed, skipped, or failed

### 4. Configurability and Flexibility

- **Extensible Prompts**: All prompts (system message, summarization, release
  notes) are fully customizable
- **Path Filtering**: Support include/exclude patterns using minimatch for file
  filtering
- **Model Selection**: Allow configuration of both light and heavy models
- **Language Support**: Support multiple languages via ISO language codes
- **Review Controls**: Allow disabling reviews or release notes independently

### 5. Reliability and Error Handling

- **Graceful Degradation**: Continue processing when individual files fail
- **Retry Logic**: Implement retry mechanisms for OpenAI API calls
- **Timeout Management**: Use configurable timeouts for API calls
- **Error Reporting**: Clearly report failures in status messages without
  stopping the entire process

## Architecture and Design Patterns

### Component Structure

1. **Main Entry Point** (`main.ts`): Orchestrates bot creation and event routing
2. **Bot Class** (`bot.ts`): Wraps OpenAI API interactions with retry logic and
   token management
3. **Review Engine** (`review.ts`): Core review logic including incremental diff
   processing, file summarization, and review comment generation
4. **Commenter** (`commenter.ts`): Handles all GitHub comment operations, status
   updates, and comment chain management
5. **Prompts** (`prompts.ts`): Manages all prompt templates and rendering with
   variable substitution
6. **Options** (`options.ts`): Centralized configuration management with
   validation and path filtering
7. **Inputs** (`inputs.ts`): Data structure for passing context through the
   review pipeline

### Review Workflow

1. **Event Detection**: Handle `pull_request`, `pull_request_target`, and
   `pull_request_review_comment` events
2. **Incremental Diff Calculation**: Compare between highest reviewed commit and
   current HEAD
3. **File Filtering**: Apply path filters and respect max_files limit
4. **Summary Phase** (Light Bot):
   - Summarize each file's changes
   - Triage changes as NEEDS_REVIEW or APPROVED (if enabled)
   - Batch and deduplicate summaries
   - Generate final PR summary and release notes
5. **Review Phase** (Heavy Bot):
   - For files marked NEEDS_REVIEW, process code hunks
   - Pack multiple hunks within token limits
   - Include existing comment chains for context
   - Generate review comments with line number mappings
6. **Comment Posting**: Submit reviews and update summary comment with commit
   tracking

### Technical Standards

#### Code Organization

- **TypeScript**: Use TypeScript for type safety
- **Modular Design**: Keep components focused and testable
- **Error Boundaries**: Wrap operations in try-catch with meaningful error
  messages
- **Token Counting**: Use `@dqbd/tiktoken` for accurate token counting before
  API calls

#### API Integration

- **GitHub API**: Use `@octokit/action` with retry and throttling plugins
- **OpenAI API**: Use `chatgpt` package with conversation management
- **Rate Limiting**: Respect concurrency limits for both APIs
- **Retry Logic**: Use `p-retry` for resilient API calls

#### Response Format

- **Review Comments**: Use format `{startLine}-{endLine}: {comment}` with `---`
  separators
- **Code Blocks**: Use language-specific fenced code blocks (no line numbers in
  code)
- **Fix Suggestions**: Use `diff` code blocks for code changes
- **No Suggestions**: Do not use GitHub's `suggestion` code blocks (per user
  preference)

## Behavioral Guidelines

### When Reviewing Code

1. **Focus Areas**: Logic correctness, security vulnerabilities, performance
   issues, data races, error handling, maintainability, modularity, complexity,
   optimization, and best practices (DRY, SOLID, KISS)
2. **Skip Areas**: Minor style issues, missing comments/documentation, cosmetic
   changes
3. **Comment Quality**: Be specific, actionable, and objective. Avoid generic
   praise or summaries
4. **Line Number Accuracy**: Ensure review comments map correctly to code hunks,
   handle edge cases where comments fall outside patches

### When Summarizing

1. **Conciseness**: Keep summaries within specified word limits (typically 100
   words per file)
2. **Clarity**: Focus on what changed, not why (unless critical)
3. **Grouping**: Deduplicate and group related changes in final summary
4. **Release Notes**: Focus on user-visible changes, categorize appropriately
   (New Feature, Bug Fix, etc.)

### When Handling Errors

1. **Continue Processing**: Don't fail the entire run due to single file
   failures
2. **Log Clearly**: Use appropriate log levels (info, warning, error)
3. **Report Status**: Include error details in status messages
4. **Debug Mode**: Provide verbose output when debug mode is enabled

### When Interacting with Users

1. **Respect Opt-Out**: Honor `@coderabbitai: ignore` in PR descriptions
2. **Conversational Context**: Maintain conversation context in comment chains
3. **Tag Responses**: Tag users when replying to comments
4. **Helpful Tips**: Provide usage tips in status messages

## Configuration Philosophy

### Defaults Should Be Sensible

- Default to skipping simple changes
- Default to not commenting on LGTM changes
- Default path filters exclude common build artifacts, binaries, and generated
  files
- Default to `gpt-3.5-turbo` for light model and `gpt-4` for heavy model
- Default language is English (en-US)

### All Key Aspects Should Be Configurable

- Model selection and temperature
- Token limits and timeout settings
- Concurrency limits
- Prompt templates
- Path filters
- Review behavior flags
- Language settings

### Configuration Should Be Validated

- Parse and validate all inputs
- Provide meaningful defaults when values are invalid
- Log configuration on startup for debugging

## User Privacy and Security

### Data Handling

- Code, diffs, and PR metadata are sent to OpenAI's API
- Users must be aware of this for compliance (documented in README)
- The action uses OpenAI API (not ChatGPT portal) which has more conservative
  data usage policies
- Support for custom API base URLs for self-hosted instances

### Security Considerations

- Respect GitHub token permissions (contents: read, pull-requests: write)
- Handle secrets securely via environment variables
- Support organization-scoped API keys for OpenAI

## Maintenance Guidelines

### When Modifying This Codebase

1. **Backward Compatibility**: Maintain compatibility with existing
   configurations where possible
2. **Documentation**: Update README and action.yml when adding new features
3. **Testing**: Add tests for new functionality
4. **Code Quality**: Follow existing patterns and TypeScript best practices
5. **Error Handling**: Maintain graceful error handling standards

### Legacy Status Awareness

- This is a maintenance-mode project
- Focus on bug fixes and critical improvements
- Document migration path to CodeRabbit Pro when appropriate
- Maintain functionality for existing users

## Success Metrics

The project succeeds when:

- Reviews are accurate, actionable, and focused on substantive issues
- Costs are minimized through incremental reviews and smart filtering
- Users find reviews helpful and not noisy
- The action runs reliably with clear status reporting
- Configuration is flexible enough for diverse use cases
- Users can interact conversationally with the bot

## Governance

### Versioning Policy

This constitution follows semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Backward incompatible governance changes, principle removals, or
  fundamental redefinitions
- **MINOR**: New principles added, sections materially expanded, or new
  governance procedures
- **PATCH**: Clarifications, wording improvements, typo fixes, non-semantic
  refinements

### Amendment Procedure

1. **Proposal**: Changes may be proposed through pull requests or issue
   discussions
2. **Review**: Proposed amendments should be reviewed considering:
   - Impact on existing code and workflows
   - Consistency with project goals and legacy status
   - Clarity and testability of new guidance
3. **Documentation**: All amendments must update:
   - Version number and last amended date
   - Sync Impact Report (HTML comment at top)
   - Any affected templates or dependent documentation
4. **Commit**: Use conventional commit format:
   `docs: amend constitution to vX.Y.Z (description)`

### Compliance Review

- **Before Implementation**: New features or significant changes should be
  checked against this constitution
- **During Review**: Code reviews should consider constitution alignment
- **Documentation Updates**: When updating README, action.yml, or templates,
  ensure consistency with constitution principles
- **Template Alignment**: Templates (plan, spec, tasks) should reflect
  constitution-driven requirements

### Constitution Check Process

When implementing features:

1. Review relevant principles before design
2. Identify any violations or conflicts
3. Document justifications in implementation plans if deviations are necessary
4. Update constitution if principles need refinement based on learnings

---

This constitution should guide all decisions, implementations, and improvements
to the CodeRabbit ai-pr-reviewer project.
