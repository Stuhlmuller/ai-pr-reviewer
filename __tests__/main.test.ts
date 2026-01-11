import {expect, test} from '@jest/globals'
import * as cp from 'child_process'
import * as path from 'path'
import * as process from 'process'

test('should execute main.js without errors', () => {
  process.env['INPUT_ACTION'] = 'code-review'
  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecFileSyncOptions = {
    env: process.env
  }
  const output = cp.execFileSync(np, [ip], options).toString()
  // Verify that the script starts executing and prints options
  expect(output).toContain('debug:')
})
