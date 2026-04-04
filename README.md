# Linewright

Line-by-line pull request review, summaries, and release notes for GitHub.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/github/last-commit/Stuhlmuller/ai-pr-reviewer/main?style=flat-square)](https://github.com/Stuhlmuller/ai-pr-reviewer/commits/main)
[![Coverage](https://img.shields.io/badge/coverage-20%25-red?style=flat-square)](https://github.com/Stuhlmuller/ai-pr-reviewer)

## Overview

Linewright is a line-by-line pull request reviewer and summarizer for GitHub. It
runs as a GitHub Action on pull requests and review-comment threads, reviews
incremental diffs, posts release notes, and keeps the conversation moving inside
review threads.

## Features

- **PR Summarization**: It generates a summary and release notes of the changes
  in the pull request.
- **Line-by-line code change suggestions**: Reviews the changes line by line and
  provides code change suggestions.
- **Continuous, incremental reviews**: Reviews are performed on each commit
  within a pull request, rather than a one-time review on the entire pull
  request.
- **Cost-effective and reduced noise**: Incremental reviews save on OpenAI costs
  and reduce noise by tracking changed files between commits and the base of the
  pull request.
- **Low-cost default model profile**: Defaults to `gpt-4o-mini` for both
  summarization and review so you can validate the workflow inexpensively, then
  override models later if you want deeper review quality.
- **Review-thread conversation**: Supports conversation with the reviewer in the
  context of lines of code or entire files, useful for providing context,
  generating test cases, and reducing code complexity.
- **Smart review skipping**: By default, skips in-depth review for simple
  changes (e.g. typo fixes) and when changes look good for the most part. It can
  be disabled by setting `review_simple_changes` and `review_comment_lgtm` to
  `true`.
- **Customizable prompts**: Tailor the `system_message`, `summarize`, and
  `summarize_release_notes` prompts to focus on specific aspects of the review
  process or even change the review objective.

To use this tool, you need to add the provided YAML file to your repository and
configure the required environment variables, such as `GITHUB_TOKEN` and
`OPENAI_API_KEY`. For more information on usage, examples, contributing, and
FAQs, you can refer to the sections below.

- [Overview](#overview)
- [Features](#features)
- [Install instructions](#install-instructions)
- [Conversation with Linewright](#conversation-with-linewright)
- [Examples](#examples)
- [Contribute](#contribute)
- [FAQs](#faqs)

## Install instructions

Linewright runs as a GitHub Action. Add the workflow below to your repository at
`.github/workflows/linewright-review.yml`.

```yaml
name: Linewright Review

permissions:
  contents: read
  pull-requests: write
  issues: write

on:
  pull_request_target:
    types: [opened, synchronize, reopened]
  pull_request_review_comment:
    types: [created]

concurrency:
  group:
    ${{ github.repository }}-${{ github.event.number || github.head_ref ||
    github.sha }}-${{ github.workflow }}-${{ github.event_name ==
    'pull_request_review_comment' && 'pr_comment' || 'pr' }}
  cancel-in-progress: ${{ github.event_name != 'pull_request_review_comment' }}

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: Stuhlmuller/ai-pr-reviewer@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        with:
          debug: false
          review_simple_changes: false
          review_comment_lgtm: false
          openai_light_model: gpt-4o-mini
          openai_heavy_model: gpt-4o-mini
```

Important: when you use `pull_request_target`, do not check out the pull request
head in this job. Keep this review workflow comment-only. If you need to build
or test forked code, do that in a separate `pull_request` workflow without
secrets.

#### Environment variables

- `GITHUB_TOKEN`: This should already be available to the GitHub Action
  environment. This is used to add comments to the pull request.
- `OPENAI_API_KEY`: use this to authenticate with OpenAI API. You can get one
  [here](https://platform.openai.com/account/api-keys). Please add this key to
  your GitHub Action secrets.
- `OPENAI_API_ORG`: (optional) use this to use the specified organization with
  OpenAI API if you have multiple. Please add this key to your GitHub Action
  secrets.

### Models: `gpt-4o-mini` by default

The default action configuration uses `gpt-4o-mini` for both
`openai_light_model` and `openai_heavy_model` so initial rollout is cheap and
simple.

If you want deeper review quality after rollout, a common next step is keeping
`gpt-4o-mini` for summaries and switching `openai_heavy_model` to `gpt-4o`.

### Prompts & Configuration

See: [action.yml](./action.yml)

Tip: You can change the reviewer personality by configuring the `system_message`
value. For example, to review docs/blog posts, you can use the following prompt:

<details>
<summary>Blog Reviewer Prompt</summary>

```yaml
system_message: |
  You are `@linewright` (aka `github-actions[bot]`), the review desk for
  this repository. Your purpose is to act as a highly experienced DevRel
  (developer relations) professional with focus on cloud-native
  infrastructure.

  Company context -
  Linewright provides crisp, line-by-line feedback on pull requests,
  highlights consequential changes, and helps teams keep review quality
  high without turning every comment into a lecture.

  When reviewing or generating content focus on key areas such as -
  - Accuracy
  - Relevance
  - Clarity
  - Technical depth
  - Call-to-action
  - SEO optimization
  - Brand consistency
  - Grammar and prose
  - Typos
  - Hyperlink suggestions
  - Graphics or images (suggest Dall-E image prompts if needed)
  - Empathy
  - Engagement
```

</details>

## Conversation with Linewright

You can reply to a review comment made by this action and get a response based
on the diff context. Additionally, you can invite the reviewer into a
conversation by tagging it in the comment (`@linewright`).

`@codereviewer` is still supported as a legacy alias.

Example:

> @linewright Please generate a test plan for this file.

Note: A review comment is a comment made on a diff or a file in the pull
request.

### Ignoring PRs

Sometimes it is useful to ignore a PR. For example, if you are using this action
to review documentation, you can ignore PRs that only change the documentation.
To ignore a PR, add the following keyword in the PR description:

```text
@linewright: ignore
```

`@codereviewer: ignore` is still supported for backwards compatibility.

## Examples

Any suggestions or pull requests for improving the prompts are highly
appreciated.

## Contribute

### Developing

> First, you'll need a reasonably modern version of Node.js handy, tested with
> Node.js 20+.

Install the dependencies

```bash
$ npm install
```

Build the typescript and package it for distribution

```bash
$ npm run build && npm run package
```

## FAQs

### Review pull requests from forks

GitHub Actions limits secret access on forked pull requests. To review forked
PRs, use `pull_request_target` for the review workflow and do not check out the
PR head in that job. Keep the job limited to calling the action and posting
comments:

```yaml
name: Linewright Review

permissions:
  contents: read
  pull-requests: write
  issues: write

on:
  pull_request_target:
    types: [opened, synchronize, reopened]
  pull_request_review_comment:
    types: [created]

concurrency:
  group:
    ${{ github.repository }}-${{ github.event.number || github.head_ref ||
    github.sha }}-${{ github.workflow }}-${{ github.event_name ==
    'pull_request_review_comment' && 'pr_comment' || 'pr' }}
  cancel-in-progress: ${{ github.event_name != 'pull_request_review_comment' }}

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: Stuhlmuller/ai-pr-reviewer@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        with:
          debug: false
          review_simple_changes: false
          review_comment_lgtm: false
          openai_light_model: gpt-4o-mini
          openai_heavy_model: gpt-4o-mini
```

If you also need to run tests against forked code, add a separate `pull_request`
workflow for build/test steps and keep that workflow isolated from secrets.

See also:
https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request_target

### Inspect model requests

Set `debug: true` in the workflow file to enable debug mode, which will show the
outbound model requests and responses.

### Disclaimer

- Your code (files, diff, PR title/description) will be sent to OpenAI's servers
  for processing. Please check with your compliance team before using this on
  your private code repositories.
- OpenAI's API is used instead of ChatGPT session on their portal. OpenAI API
  has a
  [more conservative data usage policy](https://openai.com/policies/api-data-usage-policies)
  compared to their ChatGPT offering.
- This action is not affiliated with OpenAI.
