import {warning} from '@actions/core'
import {run} from './run'

process
  .on('unhandledRejection', (reason, p) => {
    warning(`Unhandled Rejection at Promise: ${reason}, promise is ${p}`)
  })
  .on('uncaughtException', (e: unknown) => {
    const stack = e instanceof Error ? e.stack : undefined
    warning(`Uncaught Exception thrown: ${String(e)}, backtrace: ${stack}`)
  })

await run()
