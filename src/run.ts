import {
  getBooleanInput,
  getInput,
  getMultilineInput,
  setFailed,
  warning
} from '@actions/core'
import {Bot} from './bot'
import {OpenAIOptions, Options} from './options'
import {Prompts} from './prompts'
import {codeReview} from './review'
import {handleReviewComment} from './review-comment'

function formatErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}, backtrace: ${error.stack}`
  }

  return String(error)
}

export async function run(): Promise<void> {
  const options: Options = new Options(
    getBooleanInput('debug'),
    getBooleanInput('disable_review'),
    getBooleanInput('disable_release_notes'),
    getInput('max_files'),
    getBooleanInput('review_simple_changes'),
    getBooleanInput('review_comment_lgtm'),
    getMultilineInput('path_filters'),
    getInput('system_message'),
    getInput('openai_light_model'),
    getInput('openai_heavy_model'),
    getInput('openai_model_temperature'),
    getInput('openai_retries'),
    getInput('openai_timeout_ms'),
    getInput('openai_concurrency_limit'),
    getInput('github_concurrency_limit'),
    getInput('openai_base_url'),
    getInput('language'),
    getBooleanInput('enable_security_scanner'),
    getBooleanInput('enable_performance_analyzer'),
    getBooleanInput('enable_complexity_analyzer'),
    getBooleanInput('smart_review_skip_generated'),
    getBooleanInput('smart_review_skip_trivial'),
    getBooleanInput('smart_review_skip_build_artifacts'),
    getBooleanInput('smart_review_skip_vendor'),
    getBooleanInput('smart_review_skip_snapshots'),
    getMultilineInput('smart_review_custom_patterns'),
    getInput('smart_review_min_lines'),
    getBooleanInput('enable_context_aware_prompts'),
    getInput('max_retry_attempts'),
    getBooleanInput('enable_resume')
  )

  options.print()

  const prompts: Prompts = new Prompts(
    getInput('summarize'),
    getInput('summarize_release_notes'),
    options.enableContextAwarePrompts
  )

  let lightBot: Bot | null = null
  try {
    lightBot = new Bot(
      options,
      new OpenAIOptions(options.openaiLightModel, options.lightTokenLimits)
    )
  } catch (e: unknown) {
    warning(
      `Skipped: failed to create summary bot, please check your openai_api_key: ${formatErrorDetails(e)}`
    )
    return
  }

  let heavyBot: Bot | null = null
  try {
    heavyBot = new Bot(
      options,
      new OpenAIOptions(options.openaiHeavyModel, options.heavyTokenLimits)
    )
  } catch (e: unknown) {
    warning(
      `Skipped: failed to create review bot, please check your openai_api_key: ${formatErrorDetails(e)}`
    )
    return
  }

  try {
    if (
      process.env.GITHUB_EVENT_NAME === 'pull_request' ||
      process.env.GITHUB_EVENT_NAME === 'pull_request_target'
    ) {
      await codeReview(lightBot, heavyBot, options, prompts)
    } else if (
      process.env.GITHUB_EVENT_NAME === 'pull_request_review_comment'
    ) {
      await handleReviewComment(heavyBot, options, prompts)
    } else {
      warning('Skipped: this action only works on push events or pull_request')
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      setFailed(`Failed to run: ${e.message}, backtrace: ${e.stack}`)
    } else {
      setFailed(`Failed to run: ${String(e)}`)
    }
  }
}
