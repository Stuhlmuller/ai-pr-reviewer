export const splitPatch = (patch: string | null | undefined): string[] => {
  if (patch == null) {
    return []
  }

  const pattern = /(^@@ -(\d+),(\d+) \+(\d+),(\d+) @@).*$/gm
  const result: string[] = []
  let last = -1
  let match: RegExpExecArray | null

  while ((match = pattern.exec(patch)) !== null) {
    if (last === -1) {
      last = match.index
      continue
    }

    result.push(patch.substring(last, match.index))
    last = match.index
  }

  if (last !== -1) {
    result.push(patch.substring(last))
  }

  return result
}

export const patchStartEndLine = (
  patch: string
): {
  oldHunk: {startLine: number; endLine: number}
  newHunk: {startLine: number; endLine: number}
} | null => {
  const pattern = /(^@@ -(\d+),(\d+) \+(\d+),(\d+) @@)/gm
  const match = pattern.exec(patch)
  if (match == null) {
    return null
  }

  const oldBegin = parseInt(match[2], 10)
  const oldDiff = parseInt(match[3], 10)
  const newBegin = parseInt(match[4], 10)
  const newDiff = parseInt(match[5], 10)

  return {
    oldHunk: {
      startLine: oldBegin,
      endLine: oldBegin + oldDiff - 1
    },
    newHunk: {
      startLine: newBegin,
      endLine: newBegin + newDiff - 1
    }
  }
}

function normalizePatchLines(patch: string): string[] {
  const lines = patch.split('\n').slice(1)
  if (lines[lines.length - 1] === '') {
    lines.pop()
  }

  return lines
}

function shouldAddContextLineNumber(
  currentLine: number,
  totalLines: number,
  removalOnly: boolean
): boolean {
  if (removalOnly) {
    return true
  }

  const skipStart = 3
  const skipEnd = 3
  return currentLine > skipStart && currentLine <= totalLines - skipEnd
}

export const parsePatch = (
  patch: string
): {oldHunk: string; newHunk: string} | null => {
  const hunkInfo = patchStartEndLine(patch)
  if (hunkInfo == null) {
    return null
  }

  const oldHunkLines: string[] = []
  const newHunkLines: string[] = []
  let newLine = hunkInfo.newHunk.startLine
  const lines = normalizePatchLines(patch)
  const removalOnly = !lines.some(line => line.startsWith('+'))

  for (const [index, line] of lines.entries()) {
    const currentLine = index + 1

    if (line.startsWith('-')) {
      oldHunkLines.push(line.substring(1))
      continue
    }

    if (line.startsWith('+')) {
      newHunkLines.push(`${newLine}: ${line.substring(1)}`)
      newLine++
      continue
    }

    oldHunkLines.push(line)
    newHunkLines.push(
      shouldAddContextLineNumber(currentLine, lines.length, removalOnly)
        ? `${newLine}: ${line}`
        : line
    )
    newLine++
  }

  return {
    oldHunk: oldHunkLines.join('\n'),
    newHunk: newHunkLines.join('\n')
  }
}
