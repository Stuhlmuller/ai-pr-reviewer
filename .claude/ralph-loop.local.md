---
active: true
iteration: 1
max_iterations: 30
completion_promise: 'RESUME_RETRY_COMPLETE'
started_at: '2026-01-27T05:35:18Z'
---

# AI PR Reviewer - Phase 2b/2c: Resume & Retry Implementation

Read the PRD at `plans/prd.json` and implement Phase 2b (Resume Logic) and Phase
2c (Retry Logic) for the Resume & Retry capability.

## Context

- Phase 1 (State Management Foundation) is COMPLETE - see PR #34
- Phase 2a (Progress Display) is COMPLETE - see PR #35
- Phase 2b and 2c need implementation

## Phase 2b: Resume Logic

Implement the following in `src/review.ts`:

1. Detect incomplete reviews from previous runs (check for existing review
   state)
2. Skip already-completed files during summarization phase
3. Skip already-reviewed files during review phase
4. Resume from first pending/failed file
5. Preserve existing comments for completed files

## Phase 2c: Retry Logic

Implement the following:

1. Exponential backoff for failed files
2. Different retry strategies per error type (rate_limit, api_error, timeout,
   token_limit)
3. Maximum retry attempts configuration (add to action.yml and options.ts)
4. Display estimated time remaining in progress updates
5. Show retry status for failed files in PR comments

## Quality Requirements

- Run `qlty fmt` after each file modification
- Run `npm run build && npm run package` before committing
- Write comprehensive tests in `__tests__/`
- Target 80%+ test coverage for new code
- All existing tests must pass
- Follow existing code patterns from `src/review-state.ts`

## Completion Criteria

Output `<promise>RESUME_RETRY_COMPLETE</promise>` when:

- ✅ Resume logic implemented and working
- ✅ Retry logic implemented with exponential backoff
- ✅ Configuration options added to action.yml
- ✅ Comprehensive tests written (80%+ coverage)
- ✅ All tests passing (`npm test`)
- ✅ Build successful (`npm run all`)
- ✅ Code formatted (`qlty fmt`)
- ✅ Ready for PR creation

Work iteratively. Commit after each significant file change. Never bypass
pre-commit hooks.
