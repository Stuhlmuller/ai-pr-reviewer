import {type Bot} from './bot'
import {type Commenter} from './commenter'
import {type Inputs} from './inputs'
import {type Options} from './options'
import {type Prompts} from './prompts'

export type ReviewPatch = [number, number, string]
export type FileChange = [string, string, string, ReviewPatch[]]
export type Summary = [string, string, boolean]

export type AsyncLimit = <T>(fn: () => Promise<T>) => Promise<T>

export interface ReviewComment {
  startLine: number
  endLine: number
  comment: string
}

export interface SummaryProcessorArgs {
  lightBot: Bot
  heavyBot: Bot
  inputs: Inputs
  prompts: Prompts
  options: Options
  filesAndChanges: FileChange[]
  openaiConcurrencyLimit: AsyncLimit
  summariesFailed: string[]
}

export interface ReviewProcessorArgs {
  heavyBot: Bot
  commenter: Commenter
  inputs: Inputs
  prompts: Prompts
  options: Options
  filesAndChanges: FileChange[]
  summaries: Summary[]
  openaiConcurrencyLimit: AsyncLimit
}

export interface ReviewProcessResult {
  reviewsFailed: string[]
  reviewsSkipped: string[]
  lgtmCount: number
  reviewCount: number
}

export interface ReviewFileRecord {
  filename: string
  patch: string | null | undefined
}

export interface DiffFilterResult {
  files: any[]
  commits: any[]
  filterSelectedFiles: any[]
  filterIgnoredFiles: any[]
}
